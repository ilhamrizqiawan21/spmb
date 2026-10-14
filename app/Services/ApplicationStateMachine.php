<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\ApplicationStatusHistory;
use App\Models\User;
use App\Support\ApplicationStatus as S;
use Illuminate\Support\Facades\DB;

/** Central state machine governing legal transitions, timestamps, and audit history. */
class ApplicationStateMachine
{
    public const LEGAL_TRANSITIONS = [
        S::DRAFT => [S::SUBMITTED],
        S::SUBMITTED => [S::UNDER_VERIFICATION],
        S::UNDER_VERIFICATION => [S::REVISION_REQUIRED, S::VERIFIED],
        S::REVISION_REQUIRED => [S::RESUBMITTED],
        S::RESUBMITTED => [S::UNDER_VERIFICATION, S::VERIFIED, S::REVISION_REQUIRED],
        S::VERIFIED => [S::ASSESSMENT_SCHEDULED, S::ASSESSED],
        S::ASSESSMENT_SCHEDULED => [S::ASSESSED],
        S::ASSESSED => [S::ACCEPTED, S::WAITLISTED, S::REJECTED],
        S::WAITLISTED => [S::ACCEPTED, S::REJECTED],
        S::ACCEPTED => [S::RE_REGISTRATION],
        S::RE_REGISTRATION => [S::RE_REGISTRATION_VERIFIED],
        S::RE_REGISTRATION_VERIFIED => [S::ENROLLED],
        S::ENROLLED => [S::MPLS_ACTIVE],
        S::MPLS_ACTIVE => [S::MPLS_COMPLETED],
        S::MPLS_COMPLETED => [S::COMPLETED],
    ];

    public static function isLegal(string $from, string $to): bool
    {
        return in_array($to, self::LEGAL_TRANSITIONS[$from] ?? [], true);
    }

    public static function transition(
        ?User $user,
        Application $application,
        string $to,
        ?string $reason = null,
        ?array $metadata = null,
    ): Application {
        return DB::transaction(function () use ($user, $application, $to, $reason, $metadata) {
            $from = $application->status;

            if (! ($user?->hasPermCode('application.override')) && ! self::isLegal($from, $to)) {
                throw ApiException::validation(['to_status' => "Transition from '{$from}' to '{$to}' is illegal."]);
            }

            $now = now();
            $application->status = $to;
            match (true) {
                $to === S::SUBMITTED => $application->submitted_at = $now,
                $to === S::VERIFIED => $application->verified_at = $now,
                $to === S::ASSESSED => $application->assessed_at = $now,
                in_array($to, [S::ACCEPTED, S::WAITLISTED, S::REJECTED], true) => $application->decided_at = $now,
                $to === S::ENROLLED => $application->enrolled_at = $now,
                default => null,
            };
            $application->save();

            ApplicationStatusHistory::create([
                'application_id' => $application->id,
                'from_status' => $from,
                'to_status' => $to,
                'changed_by' => $user?->id,
                'reason' => $reason,
                'metadata' => $metadata ?: new \stdClass,
            ]);

            AuditService::record($user, 'application.status_changed', 'application', $application->id, ['status' => $from], ['status' => $to], $reason);
            NotificationService::applicationStatusChanged($application, $to);

            $application->unsetRelation('statusHistories');

            return $application;
        });
    }
}
