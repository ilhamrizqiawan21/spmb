<?php

namespace Tests\Feature;

use App\Models\ApplicationDocument;
use App\Models\DocumentRequirement;
use App\Models\VerificationAssignment;
use Tests\TestCase;

class VerificationTest extends TestCase
{
    private function addDoc($app, DocumentRequirement $req, string $status = 'VALID'): ApplicationDocument
    {
        return ApplicationDocument::create([
            'application_id' => $app->id, 'requirement_id' => $req->id, 'storage_key' => 'k', 'original_filename' => 'f.pdf',
            'mime_type' => 'application/pdf', 'file_size' => 10, 'status' => $status,
        ]);
    }

    public function test_queue_requires_permission_and_filters(): void
    {
        $verifier = $this->makeUser('verifier');
        $period = $this->makePeriod();
        $a = $this->makeApplication($this->makeUser('parent'), $period, 'SUBMITTED');
        $this->makeApplication($this->makeUser('parent'), $period, 'DRAFT');

        $this->as($this->makeUser('parent'))->getJson(self::API.'/verification/queue')->assertForbidden();

        $this->as($verifier)->getJson(self::API.'/verification/queue')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $a->id)->assertJsonPath('0.document_counts.total', 0)->assertJsonPath('0.assigned_verifier_id', null);
        $this->getJson(self::API.'/verification/queue?search=Budi')->assertJsonCount(1);
        $this->getJson(self::API.'/verification/queue?search=zzz')->assertJsonCount(0);
        $this->getJson(self::API.'/verification/queue?status=DRAFT')->assertJsonCount(1);
        $this->getJson(self::API.'/verification/queue?assignment=assigned_to_me')->assertJsonCount(0);
        $this->getJson(self::API.'/verification/queue?assignment=unassigned')->assertJsonCount(1);
        $this->getJson(self::API.'/verification/queue?admission_period_id=bad')->assertNotFound();
    }

    public function test_assign_moves_to_under_verification_and_reassignment_closes_previous(): void
    {
        $admin = $this->makeUser('admission_admin');
        $v1 = $this->makeUser('verifier');
        $v2 = $this->makeUser('verifier');
        $app = $this->makeApplication($this->makeUser('parent'), null, 'SUBMITTED');

        $this->as($v1)->postJson(self::API.'/verification/assignments', ['application_id' => $app->id, 'verifier_id' => $v1->id])->assertForbidden();

        $this->as($admin)->postJson(self::API.'/verification/assignments', ['application_id' => $app->id, 'verifier_id' => $v1->id])
            ->assertCreated()->assertJsonPath('verifier_name', $v1->name)->assertJsonPath('assigned_by_id', $admin->id);
        $this->assertSame('UNDER_VERIFICATION', $app->fresh()->status);

        $this->postJson(self::API.'/verification/assignments', ['application_id' => $app->id, 'verifier_id' => $v2->id])->assertCreated();
        $this->assertSame(1, VerificationAssignment::whereNull('completed_at')->count());

        $this->as($v2)->getJson(self::API.'/verification/queue?assignment=assigned_to_me')->assertJsonCount(1)->assertJsonPath('0.assigned_verifier_id', $v2->id);
        $this->postJson(self::API.'/verification/assignments', ['application_id' => '00000000-0000-4000-8000-000000000000', 'verifier_id' => $v1->id])->assertForbidden();
    }

    public function test_complete_verified_requires_documents_valid(): void
    {
        $verifier = $this->makeUser('verifier');
        $period = $this->makePeriod();
        $req = DocumentRequirement::create(['admission_period_id' => $period->id, 'name' => 'KK', 'code' => 'KK']);
        $app = $this->makeApplication($this->makeUser('parent'), $period, 'UNDER_VERIFICATION');
        $url = self::API."/verification/applications/{$app->id}/complete";

        $this->as($verifier)->postJson($url, ['to_status' => 'VERIFIED'])->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Cannot verify application. Missing required documents: KK.');

        $doc = $this->addDoc($app, $req, 'PENDING');
        $this->postJson($url, ['to_status' => 'VERIFIED'])->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Cannot verify application while documents are pending, invalid, or require revision.');

        $doc->update(['status' => 'VALID']);
        $this->postJson($url, ['to_status' => 'VERIFIED', 'notes' => 'All good'])->assertOk()
            ->assertJsonPath('status', 'VERIFIED')->assertJsonPath('verifier_id', $verifier->id);
        $this->assertSame('VERIFIED', $app->fresh()->status);
        $this->assertNotNull($app->fresh()->verified_at);

        $this->getJson(self::API."/verification/applications/{$app->id}/reviews")->assertOk()->assertJsonCount(1);
        $this->postJson($url, ['to_status' => 'BOGUS'])->assertStatus(400);
    }

    public function test_complete_revision_required_from_submitted_auto_transitions(): void
    {
        $verifier = $this->makeUser('verifier');
        $app = $this->makeApplication($this->makeUser('parent'), null, 'SUBMITTED');

        $this->as($verifier)->postJson(self::API."/verification/applications/{$app->id}/complete", ['to_status' => 'REVISION_REQUIRED', 'notes' => 'Fix docs'])
            ->assertOk()->assertJsonPath('status', 'REVISION_REQUIRED');
        $this->assertSame(['UNDER_VERIFICATION', 'REVISION_REQUIRED'], $app->fresh()->statusHistories->pluck('to_status')->all());
    }
}
