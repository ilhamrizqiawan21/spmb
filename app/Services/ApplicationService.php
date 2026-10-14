<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AdmissionPeriod;
use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\ApplicationStatusHistory;
use App\Models\DocumentRequirement;
use App\Models\User;
use App\Support\ApplicationStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ApplicationService
{
    public static function listForUser(User $user): Builder
    {
        $q = Application::with(['applicant', 'admissionPeriod', 'statusHistories.changedBy'])->orderByDesc('created_at');

        return $user->hasAnyPermCodes(['application.read', 'application.override'])
            ? $q
            : $q->whereHas('applicant', fn ($a) => $a->where('owner_user_id', $user->id));
    }

    public static function getForUser(User $user, string $id): Application
    {
        $application = Application::with(['applicant', 'admissionPeriod', 'statusHistories.changedBy'])->find($id)
            ?? throw ApiException::notFound('Application not found.');
        ApplicantService::checkAccess($user, $application->applicant);

        return $application;
    }

    /** @return array{0:int,1:int} completion percentage and current step */
    public static function completion(Application $application): array
    {
        $a = $application->applicant;
        $points = 0;
        $total = 5;

        if ($a->full_name && $a->gender && $a->birth_date) {
            $points++;
        }
        if ($a->birth_place && $a->religion) {
            $points++;
        }
        if ($a->address) {
            $points++;
        }
        if ($a->nik || $a->nisn || $a->family_card_number) {
            $points++;
        }
        if ($a->guardians()->count() >= 1) {
            $points++;
        }

        return [intdiv($points * 100, $total), min($points + 1, $total)];
    }

    public static function generateRegistrationNumber(AdmissionPeriod $period): string
    {
        $prefix = 'REG-'.$period->academicYear->start_date->year.'-';
        $last = Application::where('registration_number', 'like', $prefix.'%')
            ->orderByDesc('registration_number')->lockForUpdate()->first();
        $seq = $last ? ((int) substr($last->registration_number, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
    }

    public static function createDraft(User $user, string $applicantId, string $periodId): Application
    {
        $applicant = ApplicantService::getForUser($user, $applicantId);
        ApplicantService::checkModify($user, $applicant);

        $period = AdmissionPeriod::with('academicYear')->find($periodId)
            ?? throw ApiException::notFound('Admission period not found.', 'admission_period_id');

        RegistrationAvailabilityService::assertCanCreateDraft($period);

        return DB::transaction(function () use ($user, $applicant, $period) {
            if (Application::where('applicant_id', $applicant->id)->where('admission_period_id', $period->id)->exists()) {
                throw ApiException::validation(['detail' => 'Application for this applicant and admission period already exists.']);
            }

            $application = Application::create([
                'applicant_id' => $applicant->id,
                'admission_period_id' => $period->id,
                'registration_number' => self::generateRegistrationNumber($period),
                'status' => ApplicationStatus::DRAFT,
                'current_step' => 1,
                'completion_percentage' => 0,
            ]);
            $application->setRelation('applicant', $applicant);

            [$perc, $step] = self::completion($application);
            $application->update(['completion_percentage' => $perc, 'current_step' => $step]);

            ApplicationStatusHistory::create([
                'application_id' => $application->id,
                'from_status' => null,
                'to_status' => ApplicationStatus::DRAFT,
                'changed_by' => $user->id,
                'reason' => 'Application draft created.',
                'metadata' => new \stdClass,
            ]);

            return $application->load(['applicant', 'admissionPeriod', 'statusHistories.changedBy']);
        });
    }

    public static function submit(User $user, string $id): Application
    {
        return DB::transaction(function () use ($user, $id) {
            $application = self::getForUser($user, $id);
            ApplicantService::checkModify($user, $application->applicant);
            RegistrationAvailabilityService::assertCanSubmit($application->admissionPeriod->load('academicYear'));

            [$perc, $step] = self::completion($application);
            $application->completion_percentage = $perc;
            $application->current_step = $step;

            $applicant = $application->applicant;
            if ($applicant->guardians()->count() < 1) {
                throw ApiException::validation(['detail' => 'Application cannot be submitted without at least one guardian.']);
            }
            if (! $applicant->full_name || ! $applicant->address) {
                throw ApiException::validation(['detail' => 'Application cannot be submitted with missing applicant fields.']);
            }

            $required = self::requiredRequirements($application->admission_period_id);
            if ($required->isNotEmpty()) {
                $uploaded = ApplicationDocument::where('application_id', $application->id)->pluck('requirement_id')->all();
                $missing = $required->reject(fn ($r) => in_array($r->id, $uploaded, true));
                if ($missing->isNotEmpty()) {
                    throw ApiException::validation([
                        'detail' => 'Application missing required documents: '.$missing->pluck('name')->implode(', ').'.',
                    ]);
                }
            }

            return ApplicationStateMachine::transition($user, $application, ApplicationStatus::SUBMITTED, 'Submitted by applicant owner.');
        });
    }

    /** Active, required document requirements for a period (global ones included). */
    public static function requiredRequirements(string $periodId)
    {
        return DocumentRequirement::where(fn ($q) => $q->where('admission_period_id', $periodId)->orWhereNull('admission_period_id'))
            ->where('is_required', true)->where('is_active', true)->get();
    }
}
