<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\User;
use App\Models\VerificationAssignment;
use App\Models\VerificationReview;
use App\Support\ApplicationStatus as S;
use App\Support\DocumentStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class VerificationService
{
    public const VERIFY_PERMS = ['document.verify', 'application.verify', 'application.override'];

    public static function assign(User $by, string $applicationId, string $verifierId): VerificationAssignment
    {
        return DB::transaction(function () use ($by, $applicationId, $verifierId) {
            $application = Application::with(['applicant', 'admissionPeriod'])->find($applicationId)
                ?? throw ApiException::notFound('Application not found.', 'application_id');
            $verifier = User::find($verifierId) ?? throw ApiException::notFound('Verifier user not found.', 'verifier_id');

            VerificationAssignment::where('application_id', $application->id)->whereNull('completed_at')
                ->update(['completed_at' => now()]);

            $assignment = VerificationAssignment::create([
                'application_id' => $application->id,
                'verifier_id' => $verifier->id,
                'assigned_by' => $by->id,
                'assigned_at' => now(),
            ]);

            if (in_array($application->status, [S::SUBMITTED, S::RESUBMITTED], true)) {
                ApplicationStateMachine::transition($by, $application, S::UNDER_VERIFICATION, "Assigned to verifier {$verifier->name}.");
            }

            return $assignment->load(['application.applicant', 'verifier', 'assignedBy']);
        });
    }

    public static function queue(User $user, ?string $assignment, ?string $status, ?string $periodId, ?string $search): Collection
    {
        $q = Application::with(['applicant', 'admissionPeriod', 'documents'])
            ->orderByDesc('submitted_at')->orderByDesc('created_at');

        $status
            ? $q->where('status', $status)
            : $q->whereIn('status', [S::SUBMITTED, S::UNDER_VERIFICATION, S::REVISION_REQUIRED, S::RESUBMITTED, S::VERIFIED]);

        if ($periodId) {
            $q->where('admission_period_id', $periodId);
        }
        if ($search) {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $q->where(fn ($w) => $w->where('registration_number', 'like', $like)
                ->orWhereHas('applicant', fn ($a) => $a->where('full_name', 'like', $like)));
        }

        $active = VerificationAssignment::whereNull('completed_at');
        if ($assignment === 'unassigned') {
            $q->whereNotIn('id', (clone $active)->select('application_id'));
        } elseif ($assignment === 'assigned_to_me') {
            $q->whereIn('id', (clone $active)->where('verifier_id', $user->id)->select('application_id'));
        }

        $apps = $q->get();
        $assignments = VerificationAssignment::with('verifier')->whereNull('completed_at')
            ->whereIn('application_id', $apps->pluck('id'))->get()->keyBy('application_id');
        foreach ($apps as $app) {
            $app->setRelation('activeAssignment', $assignments->get($app->id));
        }

        return $apps;
    }

    public static function complete(User $user, string $applicationId, string $toStatus, ?string $notes): VerificationReview
    {
        return DB::transaction(function () use ($user, $applicationId, $toStatus, $notes) {
            $application = Application::with(['applicant', 'admissionPeriod', 'documents'])->find($applicationId)
                ?? throw ApiException::notFound('Application not found.');

            if (! $user->hasAnyPermCodes(self::VERIFY_PERMS)) {
                throw ApiException::forbidden('You do not have permission to verify applications.');
            }

            if ($toStatus === S::VERIFIED) {
                $docs = $application->documents;
                $uploaded = $docs->pluck('requirement_id')->all();
                $missing = ApplicationService::requiredRequirements($application->admission_period_id)
                    ->reject(fn ($r) => in_array($r->id, $uploaded, true));
                if ($missing->isNotEmpty()) {
                    throw ApiException::validation([
                        'detail' => 'Cannot verify application. Missing required documents: '.$missing->pluck('name')->implode(', ').'.',
                    ]);
                }
                $bad = [DocumentStatus::PENDING, DocumentStatus::INVALID, DocumentStatus::REVISION_REQUIRED];
                if ($docs->contains(fn ($d) => in_array($d->status, $bad, true))) {
                    throw ApiException::validation([
                        'detail' => 'Cannot verify application while documents are pending, invalid, or require revision.',
                    ]);
                }
            }

            if (in_array($application->status, [S::SUBMITTED, S::RESUBMITTED], true)) {
                $application = ApplicationStateMachine::transition(
                    $user, $application, S::UNDER_VERIFICATION, 'Auto-transition to UNDER_VERIFICATION upon review execution.'
                );
            }

            $application = ApplicationStateMachine::transition($user, $application, $toStatus, $notes ?: "Verification set to {$toStatus}.");

            $review = VerificationReview::create([
                'application_id' => $application->id,
                'verifier_id' => $user->id,
                'status' => $toStatus,
                'notes' => $notes,
                'started_at' => now(),
                'completed_at' => now(),
            ]);

            VerificationAssignment::where('application_id', $application->id)->whereNull('completed_at')
                ->update(['completed_at' => now()]);

            return $review->load('verifier');
        });
    }
}
