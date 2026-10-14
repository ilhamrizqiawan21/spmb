<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationDecision;
use App\Models\ApplicationDocument;
use App\Models\AuditLog;
use App\Models\DocumentRequirement;
use App\Models\Invoice;
use App\Models\ReRegistration;
use App\Models\Student;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class EnrollmentTest extends TestCase
{
    private const ENR = self::API.'/enrollment';

    /** Application that finished re-registration: ACCEPTED decision, completed re-registration, no debts. */
    private function readyApplication(?User $parent = null, string $status = 'RE_REGISTRATION_VERIFIED'): Application
    {
        $app = $this->makeApplication($parent ?? $this->makeUser('parent'), null, $status);
        $app->applicant->update(['nisn' => '0141234567']);
        ApplicationDecision::create([
            'application_id' => $app->id, 'decision' => 'ACCEPTED', 'decided_by' => $this->makeUser('principal')->id,
        ]);
        ReRegistration::create(['application_id' => $app->id, 'status' => 'COMPLETED', 'completed_at' => now()]);

        return $app;
    }

    private function enroll(User $staff, Application $app, string $nis = '2026.001'): TestResponse
    {
        return $this->as($staff)->postJson(self::ENR."/applications/{$app->id}/enroll", ['student_number' => $nis, 'notes' => 'Lengkap']);
    }

    public function test_staff_enroll_ready_application_into_student_snapshot(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->readyApplication($parent);
        $admin = $this->makeUser('admission_admin');

        $this->as($admin)->getJson(self::ENR.'/eligible')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.application_id', $app->id);

        $res = $this->enroll($admin, $app, ' 2026.001 ')->assertCreated()
            ->assertJsonPath('student_number', '2026.001')
            ->assertJsonPath('nisn', '0141234567')
            ->assertJsonPath('full_name', 'Budi Santoso')
            ->assertJsonPath('birth_date', '2014-05-17')
            ->assertJsonPath('status', 'ACTIVE')
            ->assertJsonPath('enrollment.status', 'ACTIVE')
            ->assertJsonPath('enrollment.enrolled_by_name', $admin->name)
            ->assertJsonPath('academic_year_name', '2026/2027');

        $app->refresh();
        $this->assertSame('ENROLLED', $app->status);
        $this->assertNotNull($app->enrolled_at);
        $this->assertSame('ENROLLED', $app->statusHistories->last()->to_status);
        $this->assertNotNull(AuditLog::where('action', 'enrollment.created')->where('resource_id', $res->json('enrollment.id'))->first());

        // snapshot: later applicant edits do not rewrite the student record
        $app->applicant->update(['full_name' => 'Nama Lain']);
        $this->assertSame('Budi Santoso', Student::first()->full_name);

        $this->as($admin)->getJson(self::ENR.'/eligible')->assertOk()->assertJsonCount(0);
        $this->enroll($admin, $app, '2026.002')->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Application is already enrolled.');

        // owner sees the result in the portal; another parent does not
        $this->as($parent)->getJson(self::ENR."/applications/{$app->id}/student")->assertOk()->assertJsonPath('data.student_number', '2026.001');
        $this->as($this->makeUser('parent'))->getJson(self::ENR."/applications/{$app->id}/student")->assertForbidden();
    }

    public function test_enrollment_requires_permission(): void
    {
        $app = $this->readyApplication();

        foreach (['parent', 'finance', 'assessor', 'verifier', 'mpls_officer'] as $role) {
            $this->enroll($this->makeUser($role), $app)->assertForbidden();
        }
        $this->as($this->makeUser('verifier'))->getJson(self::ENR.'/eligible')->assertForbidden();
        $this->assertSame(0, Student::count());
        $this->assertSame('RE_REGISTRATION_VERIFIED', $app->fresh()->status);
    }

    public function test_enrollment_preconditions_are_enforced(): void
    {
        $admin = $this->makeUser('admission_admin');

        $accepted = $this->readyApplication(null, 'ACCEPTED');
        $this->enroll($admin, $accepted)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', "Only RE_REGISTRATION_VERIFIED applications can be enrolled. Current status: 'ACCEPTED'.");

        $notDone = $this->readyApplication();
        $notDone->reRegistration->update(['status' => 'IN_PROGRESS']);
        $this->enroll($admin, $notDone)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Re-registration must be completed before enrollment.');

        $noDecision = $this->readyApplication();
        $noDecision->decision->delete();
        $this->enroll($admin, $noDecision)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Enrollment requires an ACCEPTED decision.');

        // an invoice issued after re-registration still blocks enrollment until paid or waived
        $debt = $this->readyApplication();
        $invoice = Invoice::create([
            'application_id' => $debt->id, 'invoice_number' => 'INV-TEST-1', 'type' => 'SPP', 'amount' => '500000', 'status' => 'UNPAID',
        ]);
        $this->enroll($admin, $debt)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Outstanding invoices must be paid or waived before enrollment.');
        $invoice->update(['status' => 'CANCELLED']);
        $this->enroll($admin, $debt, 'W-1')->assertCreated();

        $badDoc = $this->readyApplication();
        $req = DocumentRequirement::create(['admission_period_id' => $badDoc->admission_period_id, 'name' => 'KK', 'code' => 'KK']);
        ApplicationDocument::create([
            'application_id' => $badDoc->id, 'requirement_id' => $req->id, 'storage_key' => 'k', 'original_filename' => 'f.pdf',
            'mime_type' => 'application/pdf', 'file_size' => 10, 'status' => 'REVISION_REQUIRED',
        ]);
        $this->enroll($admin, $badDoc)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'All documents must be valid before enrollment.');

        $this->assertSame(1, Student::count());
    }

    public function test_student_number_is_validated_and_unique_case_insensitively(): void
    {
        $admin = $this->makeUser('admission_admin');
        $first = $this->readyApplication();
        $second = $this->readyApplication();

        $this->enroll($admin, $first, 'abc-01')->assertCreated();
        $this->enroll($admin, $second, 'ABC-01')->assertStatus(400)
            ->assertJsonPath('error.details.student_number.0', "Student number 'ABC-01' is already in use.");
        $this->enroll($admin, $second, 'bad nis!')->assertStatus(400);
        $this->as($admin)->postJson(self::ENR."/applications/{$second->id}/enroll", [])->assertStatus(400);
        $this->assertSame('RE_REGISTRATION_VERIFIED', $second->fresh()->status, 'failed enrollment rolls back');
    }

    public function test_correcting_student_number_requires_reason_and_is_audited(): void
    {
        $admin = $this->makeUser('admission_admin');
        $id = $this->enroll($admin, $this->readyApplication(), 'X-1')->json('id');
        $this->enroll($admin, $this->readyApplication(), 'X-2')->assertCreated();

        $this->as($admin)->patchJson(self::ENR."/students/{$id}", ['student_number' => 'X-9'])->assertStatus(400);
        $this->patchJson(self::ENR."/students/{$id}", ['student_number' => 'x-2', 'reason' => 'salah ketik'])->assertStatus(400);
        $this->patchJson(self::ENR."/students/{$id}", ['student_number' => 'X-9', 'reason' => 'salah ketik'])
            ->assertOk()->assertJsonPath('student_number', 'X-9');

        $log = AuditLog::where('action', 'student.updated')->first();
        $this->assertSame(['student_number' => 'X-1'], $log->old_values);
        $this->assertSame('salah ketik', $log->reason);
        $this->as($this->makeUser('mpls_officer'))->patchJson(self::ENR."/students/{$id}", ['nisn' => '1', 'reason' => 'x'])->assertForbidden();
    }

    public function test_student_list_filters_paginates_and_exports_csv(): void
    {
        $admin = $this->makeUser('admission_admin');
        $this->enroll($admin, $this->readyApplication(), 'A-1')->assertCreated();
        $other = $this->readyApplication();
        $other->applicant->update(['full_name' => '=HYPERLINK("x")']);
        $this->enroll($admin, $other, 'A-2')->assertCreated();

        $mpls = $this->makeUser('mpls_officer');
        $this->as($mpls)->getJson(self::ENR.'/students')->assertOk()->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.student_number', 'A-1');
        $this->getJson(self::ENR.'/students?search=hyperlink')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson(self::ENR.'/students?per_page=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 2);
        $this->getJson(self::ENR.'/students?admission_period_id=not-a-uuid')->assertNotFound();
        $this->as($this->makeUser('parent'))->getJson(self::ENR.'/students')->assertForbidden();
        $this->as($this->makeUser('finance'))->get(self::ENR.'/students/export')->assertForbidden();

        $res = $this->as($admin)->get(self::ENR.'/students/export')->assertOk();
        $this->assertStringContainsString('text/csv', $res->headers->get('Content-Type'));
        $csv = $res->streamedContent();
        $this->assertStringContainsString('NIS,NISN,"Nama Lengkap"', $csv);
        $this->assertStringContainsString('A-1,0141234567,"Budi Santoso"', $csv);
        $this->assertStringContainsString('"\'=HYPERLINK(""x"")"', $csv, 'formula injection is neutralised');
    }
}
