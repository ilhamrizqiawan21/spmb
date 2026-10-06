<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AdmissionPeriod;
use App\Models\Application;
use App\Models\ReRegistration;
use App\Models\ReRegistrationItem;
use App\Models\ReRegistrationRequirement;
use App\Models\User;
use App\Support\ApplicationStatus;
use App\Support\ReRegistrationItemStatus as ItemStatus;
use App\Support\ReRegistrationStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ReRegistrationService
{
    public static function listRequirements(?string $periodId = null): Collection
    {
        $q = ReRegistrationRequirement::with('admissionPeriod')->orderBy('sort_order')->orderBy('name');
        if ($periodId) {
            $q->where('admission_period_id', $periodId);
        }

        return $q->get();
    }

    public static function createRequirement(array $data): ReRegistrationRequirement
    {
        $period = AdmissionPeriod::find($data['admission_period_id'])
            ?? throw ApiException::notFound('Admission period not found.', 'admission_period_id');
        if (ReRegistrationRequirement::where('admission_period_id', $period->id)
            ->whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])->exists()) {
            throw ApiException::validation(['code' => "Requirement code '{$data['code']}' already exists for this period."]);
        }

        return ReRegistrationRequirement::create($data)->load('admissionPeriod');
    }

    public static function updateRequirement(ReRegistrationRequirement $req, array $data): ReRegistrationRequirement
    {
        if (isset($data['code']) && $data['code'] !== $req->code
            && ReRegistrationRequirement::where('admission_period_id', $req->admission_period_id)
                ->whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])->where('id', '!=', $req->id)->exists()) {
            throw ApiException::validation(['code' => "Requirement code '{$data['code']}' already exists."]);
        }
        $req->update($data);

        return $req->load('admissionPeriod');
    }

    public static function deleteRequirement(ReRegistrationRequirement $req): void
    {
        if ($req->items()->exists()) {
            throw ApiException::validation(['detail' => 'Cannot delete requirement that has existing re-registration items.']);
        }
        $req->delete();
    }

    public static function start(User $user, string $applicationId): ReRegistration
    {
        return DB::transaction(function () use ($user, $applicationId) {
            $application = Application::with(['applicant', 'admissionPeriod', 'reRegistration'])->find($applicationId)
                ?? throw ApiException::notFound('Application not found.');
            ApplicantService::checkModify($user, $application->applicant);

            if ($existing = $application->reRegistration) {
                return self::loadFull($existing);
            }
            if ($application->status !== ApplicationStatus::ACCEPTED) {
                throw ApiException::validation([
                    'detail' => "Only ACCEPTED applications can start re-registration. Current status: '{$application->status}'.",
                ]);
            }

            $reReg = ReRegistration::create([
                'application_id' => $application->id,
                'status' => ReRegistrationStatus::IN_PROGRESS,
                'confirmed_at' => now(),
            ]);

            foreach (ReRegistrationRequirement::where('admission_period_id', $application->admission_period_id)->get() as $req) {
                ReRegistrationItem::create([
                    're_registration_id' => $reReg->id,
                    'requirement_id' => $req->id,
                    'status' => ItemStatus::PENDING,
                ]);
            }

            ApplicationStateMachine::transition($user, $application, ApplicationStatus::RE_REGISTRATION, 'Started re-registration process.');

            return self::loadFull($reReg);
        });
    }

    public static function forApplication(User $user, string $applicationId): ReRegistration
    {
        $reReg = ReRegistration::with('application.applicant')->where('application_id', $applicationId)->first()
            ?? throw ApiException::notFound('Re-registration record not found for this application.');
        ApplicantService::checkAccess($user, $reReg->application->applicant);

        return self::loadFull($reReg);
    }

    public static function updateItem(User $user, string $itemId, string $status, ?string $notes): ReRegistrationItem
    {
        $item = ReRegistrationItem::with(['reRegistration.application.applicant', 'requirement'])->find($itemId)
            ?? throw ApiException::notFound('Re-registration item not found.');
        ApplicantService::checkModify($user, $item->reRegistration->application->applicant);

        if (! in_array($status, ItemStatus::ALL, true)) {
            throw ApiException::validation(['status' => "Invalid item status '{$status}'."]);
        }

        $item->update([
            'status' => $status,
            'notes' => $notes,
            'completed_at' => in_array($status, [ItemStatus::COMPLETED, ItemStatus::WAIVED], true) ? now() : null,
        ]);

        return $item;
    }

    public static function complete(User $user, string $reRegistrationId): ReRegistration
    {
        return DB::transaction(function () use ($user, $reRegistrationId) {
            $reReg = ReRegistration::with(['application.applicant', 'items.requirement'])->find($reRegistrationId)
                ?? throw ApiException::notFound('Re-registration record not found.');

            if (! $user->hasAnyPermCodes(['enrollment.manage', 'application.override'])) {
                ApplicantService::checkModify($user, $reReg->application->applicant);
            }

            $incomplete = $reReg->items->filter(
                fn ($i) => $i->requirement->is_required && ! in_array($i->status, [ItemStatus::COMPLETED, ItemStatus::WAIVED], true)
            );
            if ($incomplete->isNotEmpty()) {
                throw ApiException::validation([
                    'detail' => 'Cannot complete re-registration: mandatory items incomplete ('
                        .$incomplete->map(fn ($i) => $i->requirement->name)->implode(', ').').',
                ]);
            }

            $reReg->update(['status' => ReRegistrationStatus::COMPLETED, 'completed_at' => now()]);

            ApplicationStateMachine::transition($user, $reReg->application, ApplicationStatus::RE_REGISTRATION_VERIFIED, 'Re-registration completed and verified.');

            return self::loadFull($reReg);
        });
    }

    private static function loadFull(ReRegistration $reReg): ReRegistration
    {
        return $reReg->load(['application.applicant', 'items.requirement']);
    }
}
