<?php

namespace Tests\Feature;

use App\Models\DocumentRequirement;
use App\Models\DocumentRevision;
use App\Support\PrivateStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('spmb.storage_disk'));
    }

    private function requirement(array $o = []): DocumentRequirement
    {
        return DocumentRequirement::create($o + [
            'name' => 'Akta Lahir', 'code' => 'AKTA', 'allowed_mime_types' => ['application/pdf'], 'max_file_size_bytes' => 1024,
        ]);
    }

    private function pdf(string $name = 'akta.pdf', int $pad = 0): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n".str_repeat('x', $pad)."\n%%EOF");
    }

    public function test_upload_versions_checksums_and_private_storage(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);
        $req = $this->requirement();
        $url = self::API."/admission/applications/{$app->id}/documents";

        $v1 = $this->as($parent)->postJson($url, ['requirement_id' => $req->id, 'file' => $this->pdf()])->assertCreated()
            ->assertJsonPath('version', 1)->assertJsonPath('status', 'PENDING')->assertJsonPath('mime_type', 'application/pdf')
            ->assertJsonPath('requirement_code', 'AKTA');
        $this->assertSame(hash('sha256', "%PDF-1.4\n\n%%EOF"), $v1->json('checksum'));
        Storage::disk(config('spmb.storage_disk'))->assertExists('documents/'.$v1->json('storage_key'));

        $this->postJson($url, ['requirement_id' => $req->id, 'file' => $this->pdf('v2.pdf')])->assertCreated()->assertJsonPath('version', 2);
        $this->getJson($url)->assertOk()->assertJsonCount(2)->assertJsonPath('0.version', 2);
    }

    public function test_upload_validation(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);
        $req = $this->requirement();
        $url = self::API."/admission/applications/{$app->id}/documents";

        $this->as($parent)->postJson($url, [])->assertStatus(400);
        $this->postJson($url, ['requirement_id' => 'nope', 'file' => $this->pdf()])->assertStatus(400);
        $this->postJson($url, ['requirement_id' => $req->id, 'file' => $this->pdf('big.pdf', 4096)])->assertStatus(400)->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->postJson($url, ['requirement_id' => $req->id, 'file' => UploadedFile::fake()->createWithContent('note.txt', 'hello')])
            ->assertStatus(400)->assertJsonPath('error.details.file.0', "MIME type 'text/plain' is not allowed.");
        $this->postJson($url, ['requirement_id' => '00000000-0000-4000-8000-000000000000', 'file' => $this->pdf()])->assertNotFound();

        $this->as($this->makeUser('parent'))->postJson($url, ['requirement_id' => $req->id, 'file' => $this->pdf()])->assertForbidden();
    }

    public function test_download_requires_access_or_valid_token(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);
        $req = $this->requirement();
        $doc = $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/documents", ['requirement_id' => $req->id, 'file' => $this->pdf()])->json();
        $url = self::API."/admission/documents/{$doc['id']}/download";

        $this->app['auth']->forgetGuards();
        $this->get($url, ['Accept' => 'application/json'])->assertStatus(401);
        $this->as($this->makeUser('parent'))->getJson($url)->assertForbidden();

        $res = $this->as($parent)->get($url)->assertOk();
        $this->assertStringContainsString('%PDF-1.4', $res->streamedContent());
        $this->assertSame('application/pdf', $res->headers->get('Content-Type'));
        $this->as($this->makeUser('verifier'))->get($url)->assertOk();

        $token = (new PrivateStorage)->signedToken($doc['storage_key']);
        $this->app['auth']->forgetGuards();
        $this->get("{$url}?token=".urlencode($token))->assertOk();
        $this->getJson("{$url}?token=garbage")->assertForbidden();
    }

    public function test_verify_and_request_revision_flow(): void
    {
        $parent = $this->makeUser('parent');
        $verifier = $this->makeUser('verifier');
        $app = $this->makeApplication($parent, null, 'UNDER_VERIFICATION');
        $req = $this->requirement();
        $doc = $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/documents", ['requirement_id' => $req->id, 'file' => $this->pdf()])->json();

        $this->postJson(self::API."/admission/documents/{$doc['id']}/verify", ['is_valid_doc' => true])->assertForbidden();

        $this->as($verifier)->postJson(self::API."/admission/documents/{$doc['id']}/verify", ['is_valid_doc' => true, 'verification_note' => 'ok'])
            ->assertOk()->assertJsonPath('status', 'VALID')->assertJsonPath('verified_by_id', $verifier->id);

        $this->postJson(self::API."/admission/documents/{$doc['id']}/request-revision", ['reason' => 'Blur'])->assertOk()
            ->assertJsonPath('status', 'REVISION_REQUIRED')->assertJsonPath('revisions.0.reason', 'Blur');
        $this->assertSame('REVISION_REQUIRED', $app->fresh()->status);

        // re-upload resolves open revisions
        $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/documents", ['requirement_id' => $req->id, 'file' => $this->pdf('b.pdf')])->assertCreated();
        $this->assertNotNull(DocumentRevision::first()->resolved_at);
    }

    public function test_requirement_soft_deactivation_when_in_use(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);
        $used = $this->requirement();
        $unused = $this->requirement(['code' => 'OTHER', 'name' => 'Other']);
        $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/documents", ['requirement_id' => $used->id, 'file' => $this->pdf()])->assertCreated();

        $this->as($this->makeUser('admission_admin'));
        $this->deleteJson(self::API."/admission/document-requirements/{$used->id}")->assertNoContent();
        $this->deleteJson(self::API."/admission/document-requirements/{$unused->id}")->assertNoContent();
        $this->assertFalse($used->fresh()->is_active);
        $this->assertNull(DocumentRequirement::find($unused->id));

        $this->getJson(self::API.'/admission/document-requirements')->assertJsonCount(0);
    }
}
