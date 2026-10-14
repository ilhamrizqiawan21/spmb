<?php

namespace App\Support;

use App\Models\User;

/** Data minimisation for personal data in API responses (NIK, phone, email, income). */
final class Masking
{
    /** Permissions of roles that must see full personal data to do their job (verification, overrides). */
    public const FULL_ACCESS_PERMS = ['application.verify', 'document.verify', 'application.override'];

    /** The data owner and verifying/overriding staff see full values; everyone else gets masked values. */
    public static function canSeeFull(?User $viewer, ?string $ownerUserId): bool
    {
        if ($viewer === null) {
            return false;
        }

        return ($ownerUserId !== null && $viewer->id === $ownerUserId) || $viewer->hasAnyPermCodes(self::FULL_ACCESS_PERMS);
    }

    /** Keep the last $visible characters: 3273010101140001 → ************0001. */
    public static function value(?string $value, int $visible = 4): ?string
    {
        if ($value === null || $value === '') {
            return $value;
        }
        $length = mb_strlen($value);

        return $length <= $visible
            ? str_repeat('*', $length)
            : str_repeat('*', $length - $visible).mb_substr($value, -$visible);
    }

    /** ibu.budi@example.com → i***@example.com */
    public static function email(?string $email): ?string
    {
        if ($email === null || $email === '') {
            return $email;
        }
        if (! str_contains($email, '@')) {
            return self::value($email);
        }
        [$local, $domain] = explode('@', $email, 2);

        return mb_substr($local, 0, 1).'***@'.$domain;
    }
}
