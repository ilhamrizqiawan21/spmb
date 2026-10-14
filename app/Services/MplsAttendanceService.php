<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\MplsAttendance;
use App\Models\MplsEvent;
use App\Models\MplsParticipant;
use App\Models\User;
use App\Support\MplsAttendanceStatus;
use App\Support\MplsParticipantStatus;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** MPLS attendance: one record per (event, participant), set manually or by scanning the QR token. */
class MplsAttendanceService
{
    /**
     * Every participant the event applies to, with their attendance (null = not recorded yet).
     *
     * @return array{event: MplsEvent, rows: Collection<int, array{participant: MplsParticipant, attendance: ?MplsAttendance}>}
     */
    public static function roster(string $eventId): array
    {
        $event = MplsEvent::with('group')->find($eventId) ?? throw ApiException::notFound('MPLS event not found.');
        $participants = MplsParticipant::with(['student', 'group'])
            ->join('students', 'students.id', '=', 'mpls_participants.student_id')->select('mpls_participants.*')
            ->where('mpls_participants.status', '!=', MplsParticipantStatus::WITHDRAWN)
            ->whereHas('group', fn ($g) => $g->where('academic_year_id', $event->academic_year_id))
            ->when($event->group_id, fn ($q) => $q->where('group_id', $event->group_id))
            ->orderBy('students.full_name')->get();
        $attendance = MplsAttendance::with('checkedBy')->where('event_id', $event->id)->get()->keyBy('participant_id');

        return [
            'event' => $event,
            'rows' => $participants->map(fn (MplsParticipant $p) => ['participant' => $p, 'attendance' => $attendance->get($p->id)]),
        ];
    }

    /** Set (or correct) the attendance status of one participant; corrections are audited. */
    public static function record(User $by, string $eventId, string $participantId, string $status, ?string $notes): MplsAttendance
    {
        return DB::transaction(function () use ($by, $eventId, $participantId, $status, $notes) {
            [$event, $participant] = self::resolve($eventId, MplsParticipant::lockForUpdate()->find($participantId));
            $existing = MplsAttendance::where('event_id', $event->id)->where('participant_id', $participant->id)->lockForUpdate()->first();

            $old = $existing ? ['status' => $existing->status] : null;
            $values = ['status' => $status, 'notes' => $notes, 'checked_by' => $by->id, 'checked_at' => now()];
            $attendance = $existing ? tap($existing)->update($values)
                : MplsAttendance::create($values + ['event_id' => $event->id, 'participant_id' => $participant->id]);
            AuditService::record($by, 'mpls.attendance_recorded', 'mpls_attendance', $attendance->id, $old, ['status' => $status], $notes);

            return $attendance->load(['participant.student', 'checkedBy']);
        });
    }

    /**
     * QR check-in. The token identifies the participant without carrying personal data. Scanning
     * twice is harmless: an existing record is returned unchanged (with `already_recorded`).
     *
     * @return array{attendance: MplsAttendance, already_recorded: bool}
     */
    public static function scan(User $by, string $eventId, string $token): array
    {
        return DB::transaction(function () use ($by, $eventId, $token) {
            $participant = MplsParticipant::where('qr_token', $token)->lockForUpdate()->first()
                ?? throw ApiException::notFound('QR code not recognised.', 'qr_token');
            [$event, $participant] = self::resolve($eventId, $participant);

            $existing = MplsAttendance::with(['participant.student', 'checkedBy'])
                ->where('event_id', $event->id)->where('participant_id', $participant->id)->first();
            if ($existing) {
                return ['attendance' => $existing, 'already_recorded' => true];
            }

            $attendance = MplsAttendance::create([
                'event_id' => $event->id, 'participant_id' => $participant->id, 'status' => MplsAttendanceStatus::PRESENT,
                'checked_at' => now(), 'checked_by' => $by->id,
            ]);
            AuditService::record($by, 'mpls.attendance_scanned', 'mpls_attendance', $attendance->id, null, ['status' => MplsAttendanceStatus::PRESENT]);

            return ['attendance' => $attendance->load(['participant.student', 'checkedBy']), 'already_recorded' => false];
        });
    }

    /** @return array{0: MplsEvent, 1: MplsParticipant} */
    private static function resolve(string $eventId, ?MplsParticipant $participant): array
    {
        $event = MplsEvent::find($eventId) ?? throw ApiException::notFound('MPLS event not found.', 'event_id');
        $participant ?? throw ApiException::notFound('MPLS participant not found.', 'participant_id');
        $participant->loadMissing('group');

        if ($participant->group->academic_year_id !== $event->academic_year_id || ! $event->appliesToGroup($participant->group_id)) {
            throw ApiException::validation(['participant_id' => 'This event does not apply to the participant\'s group.']);
        }
        if ($participant->status !== MplsParticipantStatus::ACTIVE) {
            throw ApiException::validation(['participant_id' => "Attendance cannot be recorded for a {$participant->status} participant."]);
        }

        return [$event, $participant];
    }
}
