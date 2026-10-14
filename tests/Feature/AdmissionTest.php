<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Application;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdmissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Uploads in these tests must never touch the real private storage.
        Storage::fake(config('spmb.storage_disk'));
    }

    private function yearPayload(array $o = []): array
    {
        return $o + ['name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30'];
    }

    public function test_academic_year_crud_and_single_active(): void
    {
        $admin = $this->makeUser('admission_admin');

        $a = $this->as($admin)->postJson(self::API.'/admission/academic-years', $this->yearPayload(['is_active' => true]))->assertCreated()->json('id');
        $b = $this->as($admin)->postJson(self::API.'/admission/academic-years', $this->yearPayload(['name' => '2028/2029', 'start_date' => '2028-07-01', 'end_date' => '2029-06-30', 'is_active' => true]))
            ->assertCreated()->json('id');

        $this->assertFalse(AcademicYear::find($a)->is_active);
        $this->assertTrue(AcademicYear::find($b)->is_active);

        $this->postJson(self::API.'/admission/academic-years', $this->yearPayload())->assertStatus(400)->assertJsonPath('error.details.name.0', 'Academic year with this name already exists.');
        $this->postJson(self::API.'/admission/academic-years', $this->yearPayload(['name' => 'Bad', 'start_date' => '2030-01-01', 'end_date' => '2029-01-01']))->assertStatus(400);

        $this->patchJson(self::API."/admission/academic-years/{$a}", ['is_active' => true])->assertOk()->assertJsonPath('is_active', true);
        $this->assertFalse(AcademicYear::find($b)->is_active);
        $this->getJson(self::API.'/admission/academic-years')->assertOk()->assertJsonCount(2);
        $this->deleteJson(self::API."/admission/academic-years/{$a}")->assertNoContent();
    }

    public function test_cannot_delete_year_with_periods(): void
    {
        $period = $this->makePeriod();
        $this->as($this->makeUser('admission_admin'))
            ->deleteJson(self::API.'/admission/academic-years/'.$period->academic_year_id)->assertStatus(400);
    }

    public function test_period_validation_and_public_read(): void
    {
        $admin = $this->makeUser('admission_admin');
        $year = AcademicYear::create(['name' => '2026/2027', 'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
        $base = [
            'academic_year_id' => $year->id, 'name' => 'Gelombang 1', 'code' => 'G1',
            'registration_start' => '2026-01-01T00:00:00+07:00', 'registration_end' => '2026-03-01T00:00:00Z',
            'announcement_at' => '2026-03-15T00:00:00Z', 'quota' => 100,
        ];

        $id = $this->as($admin)->postJson(self::API.'/admission/periods', $base)->assertCreated()
            ->assertJsonPath('registration_start', '2025-12-31T17:00:00.000000Z')->json('id');

        $this->postJson(self::API.'/admission/periods', $base)->assertStatus(400)->assertJsonPath('error.details.code.0', 'Admission period code already exists in this academic year.');
        $this->postJson(self::API.'/admission/periods', ['code' => 'G2', 'registration_start' => '2026-04-01', 'registration_end' => '2026-03-01'] + $base)->assertStatus(400);
        $this->postJson(self::API.'/admission/periods', ['code' => 'G3', 'announcement_at' => '2026-02-01'] + $base)->assertStatus(400);
        $this->postJson(self::API.'/admission/periods', ['code' => 'G4', 'quota' => -1] + $base)->assertStatus(400);

        // public reads (no token)
        $this->app['auth']->forgetGuards();
        $this->getJson(self::API."/admission/periods/{$id}")->assertOk()->assertJsonPath('code', 'G1');
        $this->getJson(self::API.'/admission/periods?is_active=true')->assertOk()->assertJsonCount(1);
        $this->getJson(self::API.'/admission/periods?academic_year_id=zzz')->assertNotFound();
    }

    public function test_availability_states(): void
    {
        $open = $this->makePeriod();
        $this->getJson(self::API."/admission/periods/{$open->id}/availability")->assertOk()
            ->assertJsonPath('status', 'OPEN')->assertJsonPath('is_open', true);

        $before = $this->makePeriod(['registration_start' => now()->addDay(), 'registration_end' => now()->addDays(5)]);
        $this->getJson(self::API."/admission/periods/{$before->id}/availability")->assertJsonPath('status', 'BEFORE_OPENING');

        $closed = $this->makePeriod(['registration_start' => now()->subDays(5), 'registration_end' => now()->subDay()]);
        $this->getJson(self::API."/admission/periods/{$closed->id}/availability")->assertJsonPath('status', 'CLOSED');

        $inactive = $this->makePeriod(['is_active' => false]);
        $this->getJson(self::API."/admission/periods/{$inactive->id}/availability")->assertJsonPath('status', 'PERIOD_INACTIVE');

        AcademicYear::query()->update(['is_active' => false]);
        $this->getJson(self::API."/admission/periods/{$open->id}/availability")->assertJsonPath('status', 'ACADEMIC_YEAR_INACTIVE');
    }

    public function test_applicant_ownership_and_guardians(): void
    {
        $owner = $this->makeUser('parent');
        $other = $this->makeUser('parent');
        $verifier = $this->makeUser('verifier');

        $payload = ['full_name' => 'Ani', 'gender' => 'FEMALE', 'birth_place' => 'Jakarta', 'birth_date' => '2014-01-02', 'address' => 'Jl. A'];
        $id = $this->as($owner)->postJson(self::API.'/admission/applicants', $payload)->assertCreated()
            ->assertJsonPath('owner_user_id', $owner->id)->assertJsonPath('nationality', 'Indonesia')->assertJsonPath('birth_date', '2014-01-02')->json('id');

        $this->postJson(self::API.'/admission/applicants', ['full_name' => 'x'])->assertStatus(400);
        $this->getJson(self::API.'/admission/applicants')->assertJsonCount(1);

        $this->as($other)->getJson(self::API."/admission/applicants/{$id}")->assertForbidden();
        $this->getJson(self::API.'/admission/applicants')->assertJsonCount(0);
        $this->as($verifier)->getJson(self::API."/admission/applicants/{$id}")->assertOk();
        $this->patchJson(self::API."/admission/applicants/{$id}", ['full_name' => 'Hack'])->assertForbidden();

        $this->as($owner)->patchJson(self::API."/admission/applicants/{$id}", ['full_name' => 'Ani Lestari'])->assertOk()->assertJsonPath('full_name', 'Ani Lestari');

        $g = $this->postJson(self::API."/admission/applicants/{$id}/guardians", ['relationship' => 'FATHER', 'full_name' => 'Ayah', 'is_primary_contact' => true, 'monthly_income' => '5000000.50'])
            ->assertCreated()->assertJsonPath('monthly_income', '5000000.50')->json('id');
        $this->postJson(self::API."/admission/applicants/{$id}/guardians", ['relationship' => 'FATHER', 'full_name' => 'Dup'])->assertStatus(400);
        $this->postJson(self::API."/admission/applicants/{$id}/guardians", ['relationship' => 'COUSIN', 'full_name' => 'X'])->assertStatus(400);
        $m = $this->postJson(self::API."/admission/applicants/{$id}/guardians", ['relationship' => 'MOTHER', 'full_name' => 'Ibu', 'is_primary_contact' => true])->assertCreated()->json('id');

        $this->getJson(self::API."/admission/applicants/{$id}/guardians/{$g}")->assertJsonPath('is_primary_contact', false);
        $this->patchJson(self::API."/admission/applicants/{$id}/guardians/{$m}", ['phone' => '0811'])->assertOk();
        $this->deleteJson(self::API."/admission/applicants/{$id}/guardians/{$g}")->assertNoContent();
        $this->getJson(self::API."/admission/applicants/{$id}/guardians")->assertJsonCount(1);
        $this->deleteJson(self::API."/admission/applicants/{$id}")->assertNoContent();
    }

    public function test_draft_creation_generates_registration_number_and_tracks_completion(): void
    {
        $parent = $this->makeUser('parent');
        $period = $this->makePeriod();
        $applicant = $this->makeApplicant($parent);

        $res = $this->as($parent)->postJson(self::API.'/admission/applications', ['applicant_id' => $applicant->id, 'admission_period_id' => $period->id])
            ->assertCreated()->assertJsonPath('status', 'DRAFT')->assertJsonPath('registration_number', 'REG-2026-000001')
            ->assertJsonPath('completion_percentage', 80)->assertJsonCount(1, 'status_histories');
        $this->assertNotNull($res->json('id'));

        $this->postJson(self::API.'/admission/applications', ['applicant_id' => $applicant->id, 'admission_period_id' => $period->id])->assertStatus(400);

        $second = $this->makeApplicant($parent);
        $this->postJson(self::API.'/admission/applications', ['applicant_id' => $second->id, 'admission_period_id' => $period->id])
            ->assertCreated()->assertJsonPath('registration_number', 'REG-2026-000002');
    }

    public function test_draft_blocked_when_registration_closed(): void
    {
        $parent = $this->makeUser('parent');
        $closed = $this->makePeriod(['registration_start' => now()->subDays(5), 'registration_end' => now()->subDay()]);
        $this->as($parent)->postJson(self::API.'/admission/applications', ['applicant_id' => $this->makeApplicant($parent)->id, 'admission_period_id' => $closed->id])
            ->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_submit_requires_guardian_and_documents_then_transitions(): void
    {
        $parent = $this->makeUser('parent');
        $period = $this->makePeriod();
        $applicant = $this->makeApplicant($parent);
        $app = Application::create(['applicant_id' => $applicant->id, 'admission_period_id' => $period->id, 'registration_number' => 'REG-2026-000099']);

        $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/submit")->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Application cannot be submitted without at least one guardian.');

        $this->postJson(self::API."/admission/applicants/{$applicant->id}/guardians", ['relationship' => 'FATHER', 'full_name' => 'Ayah'])->assertCreated();
        $req = $this->as($this->makeUser('admission_admin'))->postJson(self::API.'/admission/document-requirements', [
            'admission_period_id' => $period->id, 'name' => 'Kartu Keluarga', 'code' => 'KK', 'allowed_mime_types' => ['application/pdf'],
        ])->assertCreated()->json('id');

        $this->as($parent)->postJson(self::API."/admission/applications/{$app->id}/submit")->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Application missing required documents: Kartu Keluarga.');

        $this->postJson(self::API."/admission/applications/{$app->id}/documents", ['requirement_id' => $req, 'file' => UploadedFile::fake()->createWithContent('kk.pdf', "%PDF-1.4\n%%EOF")])->assertCreated();

        $this->postJson(self::API."/admission/applications/{$app->id}/submit")->assertOk()
            ->assertJsonPath('status', 'SUBMITTED')->assertJsonCount(1, 'status_histories');
        $this->assertNotNull($app->fresh()->submitted_at);

        // owner cannot drive the state machine
        $this->postJson(self::API."/admission/applications/{$app->id}/transition", ['to_status' => 'VERIFIED'])->assertForbidden();
    }

    public function test_state_machine_transition_rules(): void
    {
        $app = $this->makeApplication($this->makeUser('parent'), null, 'SUBMITTED');
        $verifier = $this->makeUser('verifier');
        $admin = $this->makeUser('admission_admin');

        // verifier has document.verify -> may call the endpoint, but illegal jumps are rejected
        $this->as($verifier)->postJson(self::API."/admission/applications/{$app->id}/transition", ['to_status' => 'ACCEPTED'])
            ->assertStatus(400)->assertJsonPath('error.details.to_status.0', "Transition from 'SUBMITTED' to 'ACCEPTED' is illegal.");
        $this->postJson(self::API."/admission/applications/{$app->id}/transition", ['to_status' => 'BOGUS'])->assertStatus(400);
        $this->postJson(self::API."/admission/applications/{$app->id}/transition", ['to_status' => 'UNDER_VERIFICATION', 'reason' => 'start'])
            ->assertOk()->assertJsonPath('status', 'UNDER_VERIFICATION')->assertJsonPath('status_histories.0.changed_by_id', $verifier->id);

        // application.override bypasses the legal-transition table
        $this->as($admin)->postJson(self::API."/admission/applications/{$app->id}/transition", ['to_status' => 'ACCEPTED'])
            ->assertOk()->assertJsonPath('status', 'ACCEPTED');
        $this->assertNotNull($app->fresh()->decided_at);
    }

    public function test_application_listing_is_scoped_to_owner(): void
    {
        $a = $this->makeUser('parent');
        $b = $this->makeUser('parent');
        $this->makeApplication($a);
        $mine = $this->makeApplication($b);

        $this->as($b)->getJson(self::API.'/admission/applications')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $mine->id);
        $this->as($this->makeUser('verifier'))->getJson(self::API.'/admission/applications')->assertJsonCount(2);
        $this->as($a)->getJson(self::API."/admission/applications/{$mine->id}")->assertForbidden();
    }
}
