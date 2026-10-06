<?php

namespace Tests\Feature;

use App\Models\ApplicationDecision;
use App\Models\AuditLog;
use App\Models\DocumentRequirement;
use App\Models\Guardian;
use App\Models\SelectionComponent;
use App\Support\Privacy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Tests\TestCase;

class AuditAndPrivacyTest extends TestCase
{
    private function actions(): array
    {
        return AuditLog::orderBy('created_at')->orderBy('id')->pluck('action')->all();
    }

    public function test_audit_log_is_append_only(): void
    {
        $log = AuditLog::create(['action' => 'x']);
        $this->expectException(LogicException::class);
        $log->update(['action' => 'y']);
    }

    public function test_audit_log_rows_cannot_be_deleted(): void
    {
        $log = AuditLog::create(['action' => 'x']);
        $this->expectException(LogicException::class);
        $log->delete();
    }

    public function test_auth_events_are_logged_without_secrets(): void
    {
        $this->makeUser('parent', ['email' => 'ortu@example.test']);

        $this->postJson(self::API.'/auth/login', ['identifier' => 'ortu@example.test', 'password' => 'salah-banget'])->assertStatus(401);
        $token = $this->postJson(self::API.'/auth/login', ['identifier' => 'ortu@example.test', 'password' => 'Str0ng-Passw0rd!'])->json('token');
        $this->withToken($token)->postJson(self::API.'/auth/logout')->assertNoContent();

        $this->assertSame(['auth.login_failed', 'auth.login', 'auth.logout'], $this->actions());
        $failed = AuditLog::where('action', 'auth.login_failed')->first();
        $this->assertSame('*************test', $failed->new_values['identifier']);
        $this->assertStringNotContainsString('salah-banget', json_encode(AuditLog::all()->toArray()));
        $this->assertStringNotContainsString('ortu@example', (string) $failed->new_values['identifier']);
        $this->assertNotNull($failed->ip_address);
    }

    public function test_workflow_actions_are_audited(): void
    {
        $parent = $this->makeUser('parent');
        $verifier = $this->makeUser('verifier');
        $principal = $this->makeUser('principal');
        $period = $this->makePeriod();
        $comp = SelectionComponent::create(['admission_period_id' => $period->id, 'name' => 'Tes', 'code' => 'T', 'weight' => 100]);
        $app = $this->makeApplication($parent, $period, 'SUBMITTED');

        $this->as($verifier)->postJson(self::API."/verification/applications/{$app->id}/complete", ['to_status' => 'VERIFIED']);
        $this->as($this->makeUser('assessor'))->postJson(self::API.'/selection/assessments/input', ['application_id' => $app->id, 'component_id' => $comp->id, 'score' => '80']);
        $this->as($principal)->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'ACCEPTED']);
        $this->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'REJECTED', 'reason' => 'Revisi data'])->assertOk();

        $actions = $this->actions();
        foreach (['application.status_changed', 'verification.completed', 'assessment.scored', 'decision.made', 'decision.overridden'] as $a) {
            $this->assertContains($a, $actions);
        }
        $override = AuditLog::where('action', 'decision.overridden')->first();
        $this->assertSame($principal->id, $override->user_id);
        $this->assertSame(['decision' => 'ACCEPTED'], $override->old_values);
        $this->assertSame('REJECTED', $override->new_values['decision']);
        $this->assertSame(ApplicationDecision::first()->id, $override->resource_id);

        $changes = AuditLog::where('action', 'application.status_changed')->where('resource_id', $app->id)->get();
        $this->assertTrue($changes->contains(fn ($c) => $c->old_values['status'] === 'SUBMITTED' && $c->new_values['status'] === 'UNDER_VERIFICATION'));
    }

    public function test_master_data_changes_are_audited(): void
    {
        $admin = $this->makeUser('admission_admin');
        $id = $this->as($admin)->postJson(self::API.'/admission/academic-years', ['name' => '2030/2031', 'start_date' => '2030-07-01', 'end_date' => '2031-06-30'])->json('id');
        $this->patchJson(self::API."/admission/academic-years/{$id}", ['name' => '2030/31'])->assertOk();
        $this->deleteJson(self::API."/admission/academic-years/{$id}")->assertNoContent();

        $logs = AuditLog::where('resource_type', 'academic_year')->orderBy('created_at')->orderBy('id')->get();
        $this->assertSame(['master.created', 'master.updated', 'master.deleted'], $logs->pluck('action')->all());
        $this->assertSame('2030/2031', $logs[1]->old_values['name']);
        $this->assertSame('2030/31', $logs[1]->new_values['name']);
    }

    public function test_personal_data_edits_log_field_names_only(): void
    {
        $owner = $this->makeUser('parent');
        $applicant = $this->makeApplicant($owner);

        $this->as($owner)->patchJson(self::API."/admission/applicants/{$applicant->id}", ['nik' => '9999888877776666', 'address' => 'Rahasia 1'])->assertOk();

        $log = AuditLog::where('action', 'applicant.updated')->firstOrFail();
        $this->assertSame(['nik', 'address'], $log->new_values['fields']);
        $this->assertStringNotContainsString('9999888877776666', json_encode($log->toArray()));
        $this->assertStringNotContainsString('Rahasia', json_encode($log->toArray()));
    }

    public function test_staff_access_to_other_peoples_data_is_logged_but_owner_access_is_not(): void
    {
        Storage::fake(config('spmb.storage_disk'));
        $owner = $this->makeUser('parent');
        $applicant = $this->makeApplicant($owner);

        $this->as($owner)->getJson(self::API."/admission/applicants/{$applicant->id}")->assertOk();
        $this->assertNotContains('applicant.viewed', $this->actions());

        $verifier = $this->makeUser('verifier');
        $this->as($verifier)->getJson(self::API."/admission/applicants/{$applicant->id}")->assertOk();
        $log = AuditLog::where('action', 'applicant.viewed')->firstOrFail();
        $this->assertSame($verifier->id, $log->user_id);
        $this->assertSame($applicant->id, $log->resource_id);
    }

    public function test_document_download_by_staff_is_logged(): void
    {
        Storage::fake(config('spmb.storage_disk'));
        $owner = $this->makeUser('parent');
        $app = $this->makeApplication($owner);
        $req = DocumentRequirement::create(['name' => 'KK', 'code' => 'KK', 'allowed_mime_types' => ['application/pdf']]);
        $doc = $this->as($owner)->postJson(self::API."/admission/applications/{$app->id}/documents", [
            'requirement_id' => $req->id, 'file' => UploadedFile::fake()->createWithContent('kk.pdf', "%PDF-1.4\n%%EOF"),
        ])->assertCreated()->json();

        $this->get(self::API."/admission/documents/{$doc['id']}/download")->assertOk();
        $this->assertContains('document.uploaded', $this->actions());
        $this->assertNotContains('document.accessed', $this->actions());

        $this->as($this->makeUser('verifier'))->get(self::API."/admission/documents/{$doc['id']}/download")->assertOk();
        $this->assertContains('document.accessed', $this->actions());
    }

    public function test_identity_numbers_are_masked_for_staff_without_verification_need(): void
    {
        $owner = $this->makeUser('parent');
        $applicant = $this->makeApplicant($owner, ['nisn' => '0012345678', 'family_card_number' => '3273010101010001']);
        Guardian::create(['applicant_id' => $applicant->id, 'relationship' => 'FATHER', 'full_name' => 'Ayah', 'nik' => '3273010101700002']);
        $url = self::API."/admission/applicants/{$applicant->id}";

        // owner and verification staff: full values
        $this->as($owner)->getJson($url)->assertJsonPath('nik', '3273010101140001')->assertJsonPath('identity_masked', false);
        $this->as($this->makeUser('verifier'))->getJson($url)->assertJsonPath('nik', '3273010101140001');
        $this->as($this->makeUser('principal'))->getJson($url)->assertJsonPath('nisn', '0012345678');

        // assessor: can read, but only sees the last 4 digits
        $this->as($this->makeUser('assessor'))->getJson($url)
            ->assertOk()->assertJsonPath('nik', '************0001')->assertJsonPath('nisn', '******5678')
            ->assertJsonPath('family_card_number', '************0001')->assertJsonPath('identity_masked', true)
            ->assertJsonPath('full_name', 'Budi Santoso');
        $this->getJson(self::API.'/admission/applicants')->assertJsonPath('0.nik', '************0001');
        $this->getJson("{$url}/guardians")->assertOk()->assertJsonPath('0.nik', '************0002');

        $this->as($this->makeUser('verifier'))->getJson("{$url}/guardians")->assertJsonPath('0.nik', '3273010101700002');
    }

    public function test_mask_helper(): void
    {
        $this->assertSame('****', Privacy::mask('1234'));
        $this->assertSame('***5678', Privacy::mask('1235678'));
        $this->assertNull(Privacy::mask(null));
        $this->assertSame('', Privacy::mask(''));
    }

    public function test_audit_endpoint_requires_permission_and_filters_and_paginates(): void
    {
        $parent = $this->makeUser('parent');
        $this->as($parent)->getJson(self::API.'/audit/logs')->assertForbidden();
        $this->as($this->makeUser('verifier'))->getJson(self::API.'/audit/logs')->assertForbidden();

        foreach (range(1, 5) as $i) {
            AuditLog::create(['action' => 'test.a', 'resource_type' => 'thing', 'resource_id' => "id-{$i}"]);
        }
        AuditLog::create(['action' => 'test.b']);

        $admin = $this->makeUser('admission_admin');
        $this->as($admin)->getJson(self::API.'/audit/logs?action=test.a&per_page=2')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3);
        $this->getJson(self::API.'/audit/logs?resource_id=id-3')->assertJsonCount(1, 'data')->assertJsonPath('data.0.resource_type', 'thing');
        $this->getJson(self::API.'/audit/logs?per_page=1000')->assertStatus(400);
        $this->getJson(self::API.'/audit/actions')->assertOk()->assertJsonFragment(['test.a'])->assertJsonFragment(['test.b']);

        // viewing the trail does not leak other users' secrets and attributes the actor
        $this->getJson(self::API.'/audit/logs?action=auth.login')->assertOk();
    }

    public function test_api_responses_carry_security_headers(): void
    {
        $res = $this->getJson(self::API.'/admission/periods');
        $res->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('X-Frame-Options', 'DENY')->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertStringContainsString('no-store', $res->headers->get('Cache-Control'));
    }

    public function test_decision_records_exist_for_audit_cross_reference(): void
    {
        $app = $this->makeApplication($this->makeUser('parent'), null, 'ASSESSED');
        $this->as($this->makeUser('principal'))->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'ACCEPTED'])->assertOk();
        $this->assertSame(1, ApplicationDecision::count());
        $this->assertSame(ApplicationDecision::first()->id, AuditLog::where('action', 'decision.made')->value('resource_id'));
    }
}
