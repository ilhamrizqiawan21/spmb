<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AcademicYear;
use App\Models\Application;
use App\Models\MplsEvent;
use App\Models\MplsGroup;
use App\Models\MplsParticipant;
use App\Models\Student;
use App\Models\User;
use App\Support\ApplicationStatus;
use App\Support\MplsAttendanceStatus;
use App\Support\MplsParticipantStatus;
use App\Support\StudentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * MPLS groups, events and participants (ERD §15, PRD §10.14–10.16). Only enrolled students may
 * join; placing a student moves the application ENROLLED → MPLS_ACTIVE and completing it moves
 * it to MPLS_COMPLETED → COMPLETED. Completion is a staff decision (the PRD sets no attendance quota).
 */
class MplsService
{
    // ---- groups -------------------------------------------------------------

    /** @return Collection<int, MplsGroup> */
    public static function groups(?string $academicYearId): Collection
    {
        return MplsGroup::with('academicYear')
            ->withCount(['participants' => fn ($p) => $p->where('status', '!=', MplsParticipantStatus::WITHDRAWN)])
            ->when($academicYearId, fn ($q) => $q->where('academic_year_id', $academicYearId))
            ->orderBy('code')->get();
    }

    public static function createGroup(User $by, array $data): MplsGroup
    {
        AcademicYear::find($data['academic_year_id']) ?? throw ApiException::notFound('Academic year not found.', 'academic_year_id');
        self::assertGroupCodeFree($data['academic_year_id'], $data['code']);

        $group = MplsGroup::create($data);
        AuditService::record($by, 'mpls.group_created', 'mpls_group', $group->id, null, $data);

        return self::loadGroup($group);
    }

    public static function updateGroup(User $by, string $id, array $data): MplsGroup
    {
        return DB::transaction(function () use ($by, $id, $data) {
            $group = MplsGroup::lockForUpdate()->find($id) ?? throw ApiException::notFound('MPLS group not found.');
            if (isset($data['code'])) {
                self::assertGroupCodeFree($group->academic_year_id, $data['code'], $group->id);
            }
            if (array_key_exists('capacity', $data) && $data['capacity'] !== null && $data['capacity'] < self::occupancy($group)) {
                throw ApiException::validation(['capacity' => 'Capacity cannot be lower than the current number of participants.']);
            }
            $old = array_intersect_key($group->only(array_keys($data)), $data);
            $group->update($data);
            AuditService::record($by, 'mpls.group_updated', 'mpls_group', $group->id, $old, $data);

            return self::loadGroup($group);
        });
    }

    public static function deleteGroup(User $by, string $id): void
    {
        $group = MplsGroup::find($id) ?? throw ApiException::notFound('MPLS group not found.');
        if ($group->participants()->exists() || $group->events()->exists()) {
            throw ApiException::validation(['detail' => 'Cannot delete a group that has participants or events.']);
        }
        $group->delete();
        AuditService::record($by, 'mpls.group_deleted', 'mpls_group', $group->id, ['code' => $group->code, 'name' => $group->name]);
    }

    private static function assertGroupCodeFree(string $yearId, string $code, ?string $exceptId = null): void
    {
        $exists = MplsGroup::where('academic_year_id', $yearId)->whereRaw('LOWER(code) = ?', [mb_strtolower($code)])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))->exists();
        if ($exists) {
            throw ApiException::validation(['code' => "Group code '{$code}' already exists for this academic year."]);
        }
    }

    private static function occupancy(MplsGroup $group): int
    {
        return $group->participants()->where('status', '!=', MplsParticipantStatus::WITHDRAWN)->count();
    }

    private static function loadGroup(MplsGroup $group): MplsGroup
    {
        return $group->load('academicYear')->loadCount(['participants' => fn ($p) => $p->where('status', '!=', MplsParticipantStatus::WITHDRAWN)]);
    }

    // ---- events -------------------------------------------------------------

    /** @return Collection<int, MplsEvent> */
    public static function events(?string $academicYearId, ?string $groupId): Collection
    {
        return MplsEvent::with('group')
            ->when($academicYearId, fn ($q) => $q->where('academic_year_id', $academicYearId))
            ->when($groupId, fn ($q) => $q->where(fn ($e) => $e->whereNull('group_id')->orWhere('group_id', $groupId)))
            ->orderBy('start_at')->get();
    }

    public static function createEvent(User $by, array $data): MplsEvent
    {
        $data = self::resolveEventYear($data);
        $event = MplsEvent::create($data);
        AuditService::record($by, 'mpls.event_created', 'mpls_event', $event->id, null, array_diff_key($data, ['description' => 1]));

        return $event->load('group');
    }

    public static function updateEvent(User $by, string $id, array $data): MplsEvent
    {
        $event = MplsEvent::find($id) ?? throw ApiException::notFound('MPLS event not found.');
        $merged = self::resolveEventYear(array_merge($event->only(['academic_year_id', 'group_id', 'start_at', 'end_at']), $data));
        if ($merged['academic_year_id'] !== $event->academic_year_id) {
            throw ApiException::validation(['group_id' => 'An event cannot move to another academic year.']);
        }
        $event->update($data);
        AuditService::record($by, 'mpls.event_updated', 'mpls_event', $event->id, null, array_diff_key($data, ['description' => 1]));

        return $event->load('group');
    }

    public static function deleteEvent(User $by, string $id): void
    {
        $event = MplsEvent::find($id) ?? throw ApiException::notFound('MPLS event not found.');
        if ($event->attendances()->exists()) {
            throw ApiException::validation(['detail' => 'Cannot delete an event that already has attendance records.']);
        }
        $event->delete();
        AuditService::record($by, 'mpls.event_deleted', 'mpls_event', $event->id, ['title' => $event->title]);
    }

    /** A group-specific event inherits the group's academic year; a global event must name one. */
    private static function resolveEventYear(array $data): array
    {
        if (! empty($data['group_id'])) {
            $group = MplsGroup::find($data['group_id']) ?? throw ApiException::notFound('MPLS group not found.', 'group_id');
            if (! empty($data['academic_year_id']) && $data['academic_year_id'] !== $group->academic_year_id) {
                throw ApiException::validation(['group_id' => 'The group belongs to another academic year.']);
            }
            $data['academic_year_id'] = $group->academic_year_id;
        } elseif (empty($data['academic_year_id']) || ! AcademicYear::whereKey($data['academic_year_id'])->exists()) {
            throw ApiException::validation(['academic_year_id' => 'An academic year is required for an event without a group.']);
        }
        if (isset($data['start_at'], $data['end_at']) && ! $data['end_at']->gt($data['start_at'])) {
            throw ApiException::validation(['end_at' => 'The end time must be after the start time.']);
        }

        return $data;
    }

    // ---- participants -------------------------------------------------------

    public static function participantsQuery(?string $academicYearId, ?string $groupId, ?string $search): Builder
    {
        // select() must come before withCount(), otherwise it drops the count columns.
        $q = MplsParticipant::with(['student', 'group'])
            ->join('students', 'students.id', '=', 'mpls_participants.student_id')
            ->select('mpls_participants.*')->withCount(self::attendanceCounts())->orderBy('students.full_name');
        if ($groupId) {
            $q->where('group_id', $groupId);
        }
        if ($academicYearId) {
            $q->whereHas('group', fn ($g) => $g->where('academic_year_id', $academicYearId));
        }
        if ($search = trim((string) $search)) {
            $like = '%'.addcslashes(mb_strtolower($search), '%_\\').'%';
            $q->where(fn ($s) => $s->whereRaw('LOWER(students.full_name) LIKE ?', [$like])->orWhereRaw('LOWER(students.student_number) LIKE ?', [$like]));
        }

        return $q;
    }

    /** @return array<string, \Closure> withCount definitions for each attendance status. */
    public static function attendanceCounts(): array
    {
        $counts = [];
        foreach (MplsAttendanceStatus::ALL as $status) {
            $counts['attendances as '.strtolower($status).'_count'] = fn ($a) => $a->where('status', $status);
        }

        return $counts;
    }

    /** Enrolled students of the academic year not yet placed in a group. */
    public static function unassignedQuery(?string $academicYearId): Builder
    {
        return Student::with(['enrollment.application.admissionPeriod.academicYear', 'enrollment.enrolledBy'])
            ->where('status', StudentStatus::ACTIVE)
            ->whereDoesntHave('mplsParticipant')
            ->whereHas('enrollment.application', function ($a) use ($academicYearId) {
                $a->where('status', ApplicationStatus::ENROLLED);
                if ($academicYearId) {
                    $a->whereHas('admissionPeriod', fn ($p) => $p->where('academic_year_id', $academicYearId));
                }
            })
            ->orderBy('full_name');
    }

    /** Place a student in a group, or move an active participant to another group. */
    public static function assign(User $by, string $studentId, string $groupId): MplsParticipant
    {
        return DB::transaction(function () use ($by, $studentId, $groupId) {
            $student = Student::with(['enrollment.application.admissionPeriod', 'mplsParticipant'])->lockForUpdate()->find($studentId)
                ?? throw ApiException::notFound('Student not found.', 'student_id');
            $group = MplsGroup::lockForUpdate()->find($groupId) ?? throw ApiException::notFound('MPLS group not found.', 'group_id');
            $application = $student->enrollment->application;

            if ($group->academic_year_id !== $application->admissionPeriod->academic_year_id) {
                throw ApiException::validation(['group_id' => "The group belongs to another academic year than the student's admission."]);
            }

            if ($participant = $student->mplsParticipant) {
                return self::move($by, $participant, $group);
            }
            if ($student->status !== StudentStatus::ACTIVE || $application->status !== ApplicationStatus::ENROLLED) {
                throw ApiException::validation(['student_id' => 'Only active, enrolled students can join MPLS.']);
            }
            self::assertCapacity($group);

            $participant = MplsParticipant::create([
                'student_id' => $student->id,
                'group_id' => $group->id,
                'qr_token' => self::newToken(),
                'status' => MplsParticipantStatus::ACTIVE,
                'joined_at' => now(),
            ]);
            ApplicationStateMachine::transition($by, $application, ApplicationStatus::MPLS_ACTIVE, "Placed in MPLS group {$group->code}.");
            AuditService::record($by, 'mpls.participant_assigned', 'mpls_participant', $participant->id, null, [
                'student_id' => $student->id, 'group_id' => $group->id,
            ]);

            return self::loadParticipant($participant);
        });
    }

    private static function move(User $by, MplsParticipant $participant, MplsGroup $group): MplsParticipant
    {
        if ($participant->status !== MplsParticipantStatus::ACTIVE) {
            throw ApiException::validation(['student_id' => "Participant is {$participant->status} and cannot change group."]);
        }
        if ($participant->group_id === $group->id) {
            return self::loadParticipant($participant);
        }
        self::assertCapacity($group);

        $old = $participant->group_id;
        $participant->update(['group_id' => $group->id]);
        AuditService::record($by, 'mpls.participant_moved', 'mpls_participant', $participant->id, ['group_id' => $old], ['group_id' => $group->id]);

        return self::loadParticipant($participant);
    }

    private static function assertCapacity(MplsGroup $group): void
    {
        if ($group->capacity !== null && self::occupancy($group) >= $group->capacity) {
            throw ApiException::validation(['group_id' => "Group {$group->code} is full (capacity {$group->capacity})."]);
        }
    }

    /**
     * Automatic balancing (PRD §10.15): each unassigned student goes to the group with the fewest
     * participants that still has room. Returns how many were placed and how many did not fit.
     *
     * @return array{assigned:int, unplaced:int}
     */
    public static function autoAssign(User $by, string $academicYearId): array
    {
        return DB::transaction(function () use ($by, $academicYearId) {
            $groups = MplsGroup::where('academic_year_id', $academicYearId)->lockForUpdate()->get();
            if ($groups->isEmpty()) {
                throw ApiException::validation(['academic_year_id' => 'Create MPLS groups for this academic year first.']);
            }
            $load = $groups->mapWithKeys(fn (MplsGroup $g) => [$g->id => self::occupancy($g)])->all();

            $assigned = 0;
            $unplaced = 0;
            foreach (self::unassignedQuery($academicYearId)->get() as $student) {
                $open = $groups->filter(fn (MplsGroup $g) => $g->capacity === null || $load[$g->id] < $g->capacity);
                if ($open->isEmpty()) {
                    $unplaced++;

                    continue;
                }
                $target = $open->sortBy([fn ($a, $b) => $load[$a->id] <=> $load[$b->id], fn ($a, $b) => strcmp($a->code, $b->code)])->first();
                self::assign($by, $student->id, $target->id);
                $load[$target->id]++;
                $assigned++;
            }
            AuditService::record($by, 'mpls.auto_assigned', 'academic_year', $academicYearId, null, compact('assigned', 'unplaced'));

            return compact('assigned', 'unplaced');
        });
    }

    /** Issue a new QR token (e.g. after a printed card was lost); the old one stops working. */
    public static function rotateToken(User $by, string $participantId): MplsParticipant
    {
        $participant = MplsParticipant::find($participantId) ?? throw ApiException::notFound('MPLS participant not found.');
        $participant->update(['qr_token' => self::newToken()]);
        AuditService::record($by, 'mpls.qr_rotated', 'mpls_participant', $participant->id);

        return self::loadParticipant($participant);
    }

    public static function complete(User $by, string $participantId, ?string $notes): MplsParticipant
    {
        return DB::transaction(function () use ($by, $participantId, $notes) {
            $participant = MplsParticipant::with('student.enrollment.application')->lockForUpdate()->find($participantId)
                ?? throw ApiException::notFound('MPLS participant not found.');
            if ($participant->status !== MplsParticipantStatus::ACTIVE) {
                throw ApiException::validation(['status' => "Participant is already {$participant->status}."]);
            }

            $participant->update(['status' => MplsParticipantStatus::COMPLETED, 'completed_at' => now()]);
            $application = $participant->student->enrollment->application;
            ApplicationStateMachine::transition($by, $application, ApplicationStatus::MPLS_COMPLETED, $notes ?: 'MPLS completed.');
            ApplicationStateMachine::transition($by, $application, ApplicationStatus::COMPLETED, 'Admission journey completed.');
            AuditService::record($by, 'mpls.participant_completed', 'mpls_participant', $participant->id,
                ['status' => MplsParticipantStatus::ACTIVE], ['status' => MplsParticipantStatus::COMPLETED], $notes);

            return self::loadParticipant($participant);
        });
    }

    private static function newToken(): string
    {
        do {
            $token = Str::random(40);
        } while (MplsParticipant::where('qr_token', $token)->exists());

        return $token;
    }

    public static function loadParticipant(MplsParticipant $participant): MplsParticipant
    {
        return $participant->load(['student', 'group'])->loadCount(self::attendanceCounts());
    }

    // ---- parent portal ------------------------------------------------------

    /**
     * MPLS information for the owner of an application (or staff): group, QR token, events and
     * the participant's own attendance. Null while the student is not placed yet.
     *
     * @return array{participant: MplsParticipant, events: Collection<int, MplsEvent>}|null
     */
    public static function forApplication(User $user, string $applicationId): ?array
    {
        $application = Application::with(['applicant', 'enrollment.student.mplsParticipant'])->find($applicationId)
            ?? throw ApiException::notFound('Application not found.');
        $isOwner = $application->applicant->owner_user_id === $user->id;
        if (! $isOwner && ! $user->hasAnyPermCodes(['mpls.manage', 'application.override'])) {
            throw ApiException::forbidden('You do not have permission to view this MPLS information.');
        }
        $participant = $application->enrollment?->student?->mplsParticipant;
        if (! $participant) {
            return null;
        }
        $participant = self::loadParticipant($participant)->load('attendances');
        $events = MplsEvent::where('academic_year_id', $participant->group->academic_year_id)
            ->where(fn ($e) => $e->whereNull('group_id')->orWhere('group_id', $participant->group_id))
            ->orderBy('start_at')->get();

        return ['participant' => $participant, 'events' => $events];
    }
}
