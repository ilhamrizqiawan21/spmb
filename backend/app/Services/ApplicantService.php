<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Applicant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class ApplicantService
{
    public static function checkAccess(User $user, Applicant $applicant): void
    {
        if ($applicant->owner_user_id === $user->id
            || $user->hasAnyPermCodes(['application.read', 'application.override'])) {
            return;
        }
        throw ApiException::forbidden('You do not have permission to access this applicant.');
    }

    public static function checkModify(User $user, Applicant $applicant): void
    {
        if ($applicant->owner_user_id === $user->id || $user->hasPermCode('application.override')) {
            return;
        }
        throw ApiException::forbidden('You do not have permission to modify this applicant.');
    }

    public static function listForUser(User $user): Builder
    {
        $q = Applicant::query()->orderByDesc('created_at');

        return $user->hasAnyPermCodes(['application.read', 'application.override'])
            ? $q
            : $q->where('owner_user_id', $user->id);
    }

    public static function getForUser(User $user, string $id): Applicant
    {
        $applicant = Applicant::find($id) ?? throw ApiException::notFound('Applicant not found.');
        self::checkAccess($user, $applicant);

        return $applicant;
    }

    public static function create(User $user, array $data): Applicant
    {
        return Applicant::create($data + ['owner_user_id' => $user->id]);
    }

    public static function update(User $user, Applicant $applicant, array $data): Applicant
    {
        self::checkModify($user, $applicant);
        $applicant->update($data);

        return $applicant;
    }

    public static function delete(User $user, Applicant $applicant): void
    {
        self::checkModify($user, $applicant);
        $applicant->delete();
    }
}
