<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\ApplicationDecision;
use App\Models\DecisionHistory;
use App\Models\User;
use App\Models\WaitingListEntry;
use App\Support\ApplicationStatus;
use App\Support\DecisionType;
use App\Support\WaitingListStatus;
use Illuminate\Support\Facades\DB;

class DecisionService
{
    public const DECIDE_PERMS = ['assessment.approve', 'application.override'];

    public static function decide(User $user, string $applicationId, string $decision, ?string $reason): ApplicationDecision
    {
        if (! $user->hasAnyPermCodes(self::DECIDE_PERMS)) {
            throw ApiException::forbidden('You do not have permission to make admission decisions.');
        }

        return DB::transaction(function () use ($user, $applicationId, $decision, $reason) {
            $application = Application::with(['admissionPeriod', 'scoreSummary'])->find($applicationId)
                ?? throw ApiException::notFound('Application not found.');

            if (! in_array($decision, DecisionType::ALL, true)) {
                throw ApiException::validation(['decision' => "Invalid decision type '{$decision}'."]);
            }

            $summary = $application->scoreSummary;
            $finalScore = $summary?->final_score;
            $rank = $summary?->rank;

            $existing = ApplicationDecision::where('application_id', $application->id)->first();

            if ($existing) {
                if ($reason === null || trim($reason) === '') {
                    throw ApiException::validation(['reason' => 'A mandatory reason is required when overriding an existing decision.']);
                }
                DecisionHistory::create([
                    'application_decision_id' => $existing->id,
                    'old_decision' => $existing->decision,
                    'new_decision' => $decision,
                    'changed_by' => $user->id,
                    'reason' => $reason,
                ]);
                $existing->update([
                    'decision' => $decision,
                    'final_score' => $finalScore,
                    'rank' => $rank,
                    'decided_by' => $user->id,
                    'reason' => $reason,
                    'published_at' => now(),
                ]);
                $appDecision = $existing;
            } else {
                $appDecision = ApplicationDecision::create([
                    'application_id' => $application->id,
                    'decision' => $decision,
                    'final_score' => $finalScore,
                    'rank' => $rank,
                    'decided_by' => $user->id,
                    'reason' => $reason,
                    'published_at' => now(),
                ]);
            }

            $wl = WaitingListEntry::where('application_id', $application->id)->first();

            if ($decision === DecisionType::ACCEPTED) {
                if ($wl && $wl->status === WaitingListStatus::WAITING) {
                    $wl->update(['status' => WaitingListStatus::PROMOTED, 'promoted_at' => now(), 'promoted_by' => $user->id]);
                }
                ApplicationStateMachine::transition($user, $application, ApplicationStatus::ACCEPTED, $reason ?: 'Decision set to ACCEPTED.');
            } elseif ($decision === DecisionType::WAITLISTED) {
                if (! $wl) {
                    $last = (int) WaitingListEntry::whereHas('application', fn ($q) => $q->where('admission_period_id', $application->admission_period_id))
                        ->where('status', WaitingListStatus::WAITING)->max('position');
                    WaitingListEntry::create([
                        'application_id' => $application->id,
                        'position' => $rank ?? $last + 1,
                        'score' => $finalScore ?? '0.0000',
                        'status' => WaitingListStatus::WAITING,
                    ]);
                } else {
                    $wl->update(['status' => WaitingListStatus::WAITING, 'score' => $finalScore ?? '0.0000']);
                }
                ApplicationStateMachine::transition($user, $application, ApplicationStatus::WAITLISTED, $reason ?: 'Decision set to WAITLISTED.');
            } else {
                if ($wl && $wl->status === WaitingListStatus::WAITING) {
                    $wl->update(['status' => WaitingListStatus::CANCELLED]);
                }
                ApplicationStateMachine::transition($user, $application, ApplicationStatus::REJECTED, $reason ?: 'Decision set to REJECTED.');
            }

            return $appDecision->load(['application.applicant', 'decidedBy', 'histories.changedBy']);
        });
    }
}
