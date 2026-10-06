<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Guardian;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class GuardianService
{
    public static function listForApplicant(User $user, string $applicantId): Collection
    {
        $applicant = ApplicantService::getForUser($user, $applicantId);

        return Guardian::where('applicant_id', $applicant->id)->orderBy('created_at')->get();
    }

    public static function getForApplicant(User $user, string $applicantId, string $guardianId): Guardian
    {
        $applicant = ApplicantService::getForUser($user, $applicantId);

        return Guardian::where('applicant_id', $applicant->id)->find($guardianId)
            ?? throw ApiException::notFound('Guardian not found.');
    }

    public static function create(User $user, string $applicantId, array $data): Guardian
    {
        $applicant = ApplicantService::getForUser($user, $applicantId);
        ApplicantService::checkModify($user, $applicant);

        return DB::transaction(function () use ($user, $applicant, $data) {
            if (Guardian::where('applicant_id', $applicant->id)->where('relationship', $data['relationship'])->exists()) {
                throw ApiException::validation(['relationship' => "Guardian '{$data['relationship']}' already exists."]);
            }
            if (! empty($data['is_primary_contact'])) {
                Guardian::where('applicant_id', $applicant->id)->where('is_primary_contact', true)
                    ->update(['is_primary_contact' => false]);
            }

            $guardian = Guardian::create($data + ['applicant_id' => $applicant->id]);
            AuditService::log('guardian.created', $guardian, null, ['fields' => array_keys($data)], $user);

            return $guardian;
        });
    }

    public static function update(User $user, Guardian $guardian, array $data): Guardian
    {
        $applicant = ApplicantService::getForUser($user, $guardian->applicant_id);
        ApplicantService::checkModify($user, $applicant);

        return DB::transaction(function () use ($user, $guardian, $applicant, $data) {
            if (isset($data['relationship']) && $data['relationship'] !== $guardian->relationship
                && Guardian::where('applicant_id', $applicant->id)
                    ->where('relationship', $data['relationship'])->where('id', '!=', $guardian->id)->exists()) {
                throw ApiException::validation(['relationship' => "Guardian '{$data['relationship']}' already exists."]);
            }
            if (($data['is_primary_contact'] ?? null) === true) {
                Guardian::where('applicant_id', $applicant->id)->where('is_primary_contact', true)
                    ->where('id', '!=', $guardian->id)->update(['is_primary_contact' => false]);
            }
            $guardian->update($data);
            AuditService::log('guardian.updated', $guardian, null, ['fields' => array_keys($data)], $user);

            return $guardian;
        });
    }

    public static function delete(User $user, Guardian $guardian): void
    {
        $applicant = ApplicantService::getForUser($user, $guardian->applicant_id);
        ApplicantService::checkModify($user, $applicant);
        AuditService::log('guardian.deleted', $guardian, null, null, $user);
        $guardian->delete();
    }
}
