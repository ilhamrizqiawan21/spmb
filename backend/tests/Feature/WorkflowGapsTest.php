<?php

namespace Tests\Feature;

use App\Models\ApplicationDocument;
use App\Models\DocumentRequirement;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorkflowGapsTest extends TestCase
{
    public function test_unhandled_errors_return_a_safe_500_without_internals(): void
    {
        config(['app.debug' => false]);
        Route::get('/api/v1/_boom', fn () => throw new \RuntimeException('SQLSTATE secret /var/www/path'));

        $res = $this->getJson('/api/v1/_boom')->assertStatus(500)
            ->assertJsonPath('error.code', 'INTERNAL_SERVER_ERROR')->assertJsonPath('error.details', null);
        $this->assertStringNotContainsString('SQLSTATE', $res->getContent());
        $this->assertStringNotContainsString('/var/www', $res->getContent());
    }

    public function test_repeating_a_transition_is_rejected(): void
    {
        $verifier = $this->makeUser('verifier');
        $app = $this->makeApplication($this->makeUser('parent'), null, 'SUBMITTED');
        $url = self::API."/admission/applications/{$app->id}/transition";

        $this->as($verifier)->postJson($url, ['to_status' => 'UNDER_VERIFICATION'])->assertOk();
        $this->postJson($url, ['to_status' => 'UNDER_VERIFICATION'])->assertStatus(400)
            ->assertJsonPath('error.details.to_status.0', "Transition from 'UNDER_VERIFICATION' to 'UNDER_VERIFICATION' is illegal.");
    }

    public function test_revision_loop_requires_fixed_documents_and_works_after_registration_closes(): void
    {
        Storage::fake(config('spmb.storage_disk'));
        $parent = $this->makeUser('parent');
        $verifier = $this->makeUser('verifier');
        $period = $this->makePeriod();
        $req = DocumentRequirement::create(['admission_period_id' => $period->id, 'name' => 'KK', 'code' => 'KK', 'allowed_mime_types' => ['application/pdf']]);
        $app = $this->makeApplication($parent, $period);
        $upload = fn () => $this->postJson(self::API."/admission/applications/{$app->id}/documents", [
            'requirement_id' => $req->id, 'file' => UploadedFile::fake()->createWithContent('kk.pdf', "%PDF-1.4\n%%EOF"),
        ]);

        $doc = $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/documents", [
            'requirement_id' => $req->id, 'file' => UploadedFile::fake()->createWithContent('kk.pdf', "%PDF-1.4\n%%EOF"),
        ])->assertCreated()->json('id');
        $this->postJson(self::API."/admission/applications/{$app->id}/submit")->assertOk()->assertJsonPath('status', 'SUBMITTED');

        // cannot submit twice
        $this->postJson(self::API."/admission/applications/{$app->id}/submit")->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', "Application cannot be submitted from status 'SUBMITTED'.");

        $this->as($verifier)->postJson(self::API."/verification/applications/{$app->id}/complete", ['to_status' => 'REVISION_REQUIRED', 'notes' => 'KK buram'])->assertOk();
        $this->postJson(self::API."/admission/documents/{$doc}/request-revision", ['reason' => 'KK buram'])->assertOk();

        // registration closes while the parent is fixing the document
        $period->update(['registration_end' => now()->subHour(), 'registration_start' => now()->subDays(3)]);

        // still flagged -> blocked
        $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/submit")->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Documents still need correction: KK.');

        $upload()->assertCreated()->assertJsonPath('version', 2);
        $this->postJson(self::API."/admission/applications/{$app->id}/submit")->assertOk()->assertJsonPath('status', 'RESUBMITTED');
        $this->assertSame(2, ApplicationDocument::where('application_id', $app->id)->count());

        // a verifier can pick it up again
        $this->as($verifier)->getJson(self::API.'/verification/queue?status=RESUBMITTED')->assertOk()->assertJsonCount(1);
    }

    public function test_decision_stays_private_until_published(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent, null, 'ASSESSED');
        $url = self::API."/selection/applications/{$app->id}/announcement";

        $this->as($this->makeUser('principal'))->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'ACCEPTED'])
            ->assertOk()->assertJsonPath('published_at', null);

        $this->as($parent)->getJson($url)->assertOk()->assertJsonPath('is_published', false)->assertJsonMissingPath('decision');
        $this->postJson(self::API.'/selection/announcements/lookup', ['registration_number' => $app->registration_number, 'birth_date' => '2014-05-17'])
            ->assertOk()->assertJsonPath('is_published', false);

        $this->as($this->makeUser('admission_admin'))->postJson(self::API."/selection/periods/{$app->admission_period_id}/publish-announcement")
            ->assertOk()->assertJsonPath('published_count', 1);
        $this->as($parent)->getJson($url)->assertJsonPath('is_published', true)->assertJsonPath('decision', 'ACCEPTED');
    }
}
