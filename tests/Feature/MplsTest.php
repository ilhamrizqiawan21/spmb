<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\Enrollment;
use App\Models\MplsParticipant;
use App\Models\Student;
use App\Models\User;
use Tests\TestCase;

class MplsTest extends TestCase
{
    private const MPLS = self::API.'/mpls';

    private User $officer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->officer = $this->makeUser('mpls_officer');
    }

    private function year(): AcademicYear
    {
        return AcademicYear::firstOrCreate(['name' => '2026/2027'], ['start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true]);
    }

    /** An enrolled student (application ENROLLED) of the 2026/2027 year. */
    private function student(?User $parent = null, string $name = 'Budi Santoso'): Student
    {
        static $n = 0;
        $n++;
        $app = $this->makeApplication($parent ?? $this->makeUser('parent'), null, 'ENROLLED');
        $enrollment = Enrollment::create(['application_id' => $app->id, 'status' => 'ACTIVE', 'enrolled_at' => now()]);

        return Student::create([
            'enrollment_id' => $enrollment->id, 'student_number' => "NIS-{$n}", 'full_name' => $name,
            'gender' => 'MALE', 'birth_place' => 'Bandung', 'birth_date' => '2014-05-17', 'status' => 'ACTIVE',
        ]);
    }

    private function group(string $code = 'A', ?int $capacity = null): string
    {
        return $this->as($this->officer)->postJson(self::MPLS.'/groups', [
            'academic_year_id' => $this->year()->id, 'name' => "Kelompok {$code}", 'code' => $code,
            'capacity' => $capacity, 'mentor_name' => 'Bu Sari',
        ])->assertCreated()->json('id');
    }

    private function event(?string $groupId = null, array $extra = []): string
    {
        return $this->as($this->officer)->postJson(self::MPLS.'/events', $extra + [
            'academic_year_id' => $this->year()->id, 'group_id' => $groupId, 'title' => 'Pengenalan sekolah',
            'start_at' => '2026-07-13T07:00:00+07:00', 'end_at' => '2026-07-13T10:00:00+07:00',
        ])->assertCreated()->json('id');
    }

    private function assign(Student $student, string $groupId)
    {
        return $this->as($this->officer)->postJson(self::MPLS.'/participants', ['student_id' => $student->id, 'group_id' => $groupId]);
    }

    public function test_groups_crud_requires_mpls_permission_and_unique_code(): void
    {
        $body = ['academic_year_id' => $this->year()->id, 'name' => 'Kelompok A', 'code' => 'A'];
        foreach (['parent', 'verifier', 'finance'] as $role) {
            $this->as($this->makeUser($role))->postJson(self::MPLS.'/groups', $body)->assertForbidden();
        }
        $id = $this->group('A', 2);
        $this->as($this->officer)->postJson(self::MPLS.'/groups', ['code' => 'a'] + $body)->assertStatus(400)
            ->assertJsonPath('error.details.code.0', "Group code 'a' already exists for this academic year.");
        $this->patchJson(self::MPLS."/groups/{$id}", ['mentor_name' => 'Pak Dedi'])->assertOk()->assertJsonPath('mentor_name', 'Pak Dedi');
        $this->getJson(self::MPLS.'/groups')->assertOk()->assertJsonCount(1)->assertJsonPath('0.participant_count', 0);
        $this->assertNotNull(AuditLog::where('action', 'mpls.group_created')->first());

        $this->assign($this->student(), $id)->assertOk();
        $this->as($this->officer)->deleteJson(self::MPLS."/groups/{$id}")->assertStatus(400);
        $this->patchJson(self::MPLS."/groups/{$id}", ['capacity' => 0])->assertStatus(400);
    }

    public function test_events_validate_time_and_year(): void
    {
        $g = $this->group();
        $this->event($g);
        $this->as($this->officer)->postJson(self::MPLS.'/events', [
            'title' => 'X', 'start_at' => '2026-07-13T10:00:00Z', 'end_at' => '2026-07-13T09:00:00Z', 'group_id' => $g,
        ])->assertStatus(400)->assertJsonPath('error.details.end_at.0', 'The end time must be after the start time.');
        $this->postJson(self::MPLS.'/events', ['title' => 'X', 'start_at' => '2026-07-13T08:00:00Z', 'end_at' => '2026-07-13T09:00:00Z'])
            ->assertStatus(400)->assertJsonPath('error.details.academic_year_id.0', 'An academic year is required for an event without a group.');
        $this->getJson(self::MPLS."/events?group_id={$g}")->assertOk()->assertJsonCount(1);
    }

    public function test_only_enrolled_students_join_and_application_becomes_mpls_active(): void
    {
        $g = $this->group();
        $student = $this->student();

        $this->as($this->officer)->getJson(self::MPLS.'/participants/unassigned')->assertOk()->assertJsonCount(1);
        $res = $this->assign($student, $g)->assertOk()->assertJsonPath('status', 'ACTIVE')->assertJsonPath('group_code', 'A');
        $this->assertArrayNotHasKey('qr_token', $res->json(), 'tokens are not exposed in staff responses');
        $this->assertSame('MPLS_ACTIVE', $student->enrollment->application->fresh()->status);
        $this->assertSame(40, strlen(MplsParticipant::first()->qr_token));
        $this->getJson(self::MPLS.'/participants/unassigned')->assertOk()->assertJsonCount(0);

        // not enrolled (still re-registering) → refused
        $other = $this->student();
        $other->enrollment->application->update(['status' => 'RE_REGISTRATION_VERIFIED']);
        $this->assign($other, $g)->assertStatus(400)->assertJsonPath('error.details.student_id.0', 'Only active, enrolled students can join MPLS.');

        // group of another academic year → refused
        $nextYear = AcademicYear::create(['name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30', 'is_active' => false]);
        $foreign = $this->as($this->officer)->postJson(self::MPLS.'/groups', ['academic_year_id' => $nextYear->id, 'name' => 'B', 'code' => 'B'])->json('id');
        $this->assign($this->student(), $foreign)->assertStatus(400);
    }

    public function test_capacity_move_and_auto_balancing(): void
    {
        $a = $this->group('A', 1);
        $b = $this->group('B', 3);
        $first = $this->student();
        $this->assign($first, $a)->assertOk();
        $this->assign($this->student(), $a)->assertStatus(400)->assertJsonPath('error.details.group_id.0', 'Group A is full (capacity 1).');

        $this->assign($first, $b)->assertOk()->assertJsonPath('group_code', 'B');
        $this->assertNotNull(AuditLog::where('action', 'mpls.participant_moved')->first());

        // 4 unassigned students; room left: A=1, B=2 → 3 placed (balanced), 1 left over
        foreach (range(1, 3) as $i) {
            $this->student();
        }
        $this->as($this->officer)->postJson(self::MPLS.'/participants/auto-assign', ['academic_year_id' => $this->year()->id])
            ->assertOk()->assertExactJson(['assigned' => 3, 'unplaced' => 1]);
        $this->assertSame(1, MplsParticipant::where('group_id', $a)->count());
        $this->assertSame(3, MplsParticipant::where('group_id', $b)->count());
    }

    public function test_attendance_manual_and_qr_scan(): void
    {
        $a = $this->group('A');
        $b = $this->group('B');
        $student = $this->student();
        $participant = $this->assign($student, $a)->json('id');
        $token = MplsParticipant::find($participant)->qr_token;
        $global = $this->event();
        $onlyB = $this->event($b);

        $this->as($this->officer)->postJson(self::MPLS.'/attendance/scan', ['event_id' => $global, 'qr_token' => $token])
            ->assertCreated()->assertJsonPath('already_recorded', false)->assertJsonPath('attendance.status', 'PRESENT');
        $this->postJson(self::MPLS.'/attendance/scan', ['event_id' => $global, 'qr_token' => $token])
            ->assertOk()->assertJsonPath('already_recorded', true);
        $this->postJson(self::MPLS.'/attendance/scan', ['event_id' => $global, 'qr_token' => 'unknown'])->assertNotFound();
        $this->postJson(self::MPLS.'/attendance/scan', ['event_id' => $onlyB, 'qr_token' => $token])->assertStatus(400);

        // manual correction is audited with the old status
        $this->postJson(self::MPLS.'/attendance', ['event_id' => $global, 'participant_id' => $participant, 'status' => 'SICK', 'notes' => 'surat dokter'])
            ->assertOk()->assertJsonPath('status', 'SICK');
        $log = AuditLog::where('action', 'mpls.attendance_recorded')->first();
        $this->assertSame(['status' => 'PRESENT'], $log->old_values);
        $this->postJson(self::MPLS.'/attendance', ['event_id' => $global, 'participant_id' => $participant, 'status' => 'LATE'])->assertStatus(400);

        $roster = $this->getJson(self::MPLS."/events/{$global}/attendance")->assertOk();
        $this->assertSame('SICK', $roster->json('rows.0.attendance.status'));
        $this->getJson(self::MPLS.'/participants')->assertOk()->assertJsonPath('data.0.attendance.sick', 1);

        // rotating the token invalidates the old QR
        $new = $this->postJson(self::MPLS."/participants/{$participant}/rotate-qr")->assertOk()->json('qr_token');
        $this->assertNotSame($token, $new);
        $this->postJson(self::MPLS.'/attendance/scan', ['event_id' => $global, 'qr_token' => $token])->assertNotFound();
    }

    public function test_completion_closes_the_journey_and_blocks_further_changes(): void
    {
        $g = $this->group();
        $student = $this->student();
        $participant = $this->assign($student, $g)->json('id');

        $this->as($this->officer)->postJson(self::MPLS."/participants/{$participant}/complete", ['notes' => 'Lulus MPLS'])
            ->assertOk()->assertJsonPath('status', 'COMPLETED');
        $app = $student->enrollment->application->fresh();
        $this->assertSame('COMPLETED', $app->status);
        $this->assertSame(['MPLS_ACTIVE', 'MPLS_COMPLETED', 'COMPLETED'], $app->statusHistories->pluck('to_status')->all());

        $this->postJson(self::MPLS."/participants/{$participant}/complete")->assertStatus(400);
        $this->postJson(self::MPLS.'/attendance', ['event_id' => $this->event(), 'participant_id' => $participant, 'status' => 'PRESENT'])
            ->assertStatus(400);
        $this->assign($student, $this->group('B'))->assertStatus(400);
    }

    public function test_parent_sees_own_group_events_and_qr_only(): void
    {
        $parent = $this->makeUser('parent');
        $student = $this->student($parent);
        $appId = $student->enrollment->application_id;

        $this->as($parent)->getJson(self::MPLS."/applications/{$appId}")->assertOk()->assertJsonPath('data', null);

        $g = $this->group();
        $this->assign($student, $g);
        $this->event();
        $this->event($this->group('B'), ['title' => 'Khusus kelompok B']);

        $res = $this->as($parent)->getJson(self::MPLS."/applications/{$appId}")->assertOk()
            ->assertJsonPath('data.participant.group_code', 'A')
            ->assertJsonPath('data.participant.mentor_name', 'Bu Sari')
            ->assertJsonCount(1, 'data.events');
        $this->assertSame(MplsParticipant::first()->qr_token, $res->json('data.participant.qr_token'));

        $this->as($this->makeUser('parent'))->getJson(self::MPLS."/applications/{$appId}")->assertForbidden();
        $this->as($parent)->getJson(self::MPLS.'/groups')->assertForbidden();
    }

    public function test_participant_export_contains_attendance_counts(): void
    {
        $g = $this->group();
        $p = $this->assign($this->student(null, '@SUM(A1)'), $g)->json('id');
        $this->as($this->officer)->postJson(self::MPLS.'/attendance', ['event_id' => $this->event(), 'participant_id' => $p, 'status' => 'PRESENT']);

        $csv = $this->get(self::MPLS.'/participants/export')->assertOk()->streamedContent();
        $this->assertStringContainsString('NIS,Nama,"Kode Kelompok"', $csv);
        $this->assertStringContainsString(",'@SUM(A1),A,\"Kelompok A\",ACTIVE,1,0,0,0,", $csv, 'formula escaped; counts present');
    }
}
