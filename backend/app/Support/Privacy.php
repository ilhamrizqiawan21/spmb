<?php

namespace App\Support;

use App\Models\User;

/** Masking of national identity numbers (NIK/NISN/KK) for staff without a verification need. */
final class Privacy
{
    /** Permissions that legitimately need the full identity numbers. */
    public const FULL_ACCESS_PERMS = ['application.verify', 'document.verify', 'application.override'];

    public static function canSeeIdentity(?User $viewer, ?string $ownerId): bool
    {
        if (! $viewer) {
            return false;
        }

        return $viewer->id === $ownerId || $viewer->hasAnyPermCodes(self::FULL_ACCESS_PERMS);
    }

    /** Keep the last 4 characters: 3273010101140001 → ************0001. */
    public static function mask(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return $value;
        }
        $len = mb_strlen($value);

        return $len <= 4 ? str_repeat('*', $len) : str_repeat('*', $len - 4).mb_substr($value, -4);
    }
}
