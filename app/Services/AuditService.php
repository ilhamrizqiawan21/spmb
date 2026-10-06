<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;

/** Writes append-only audit entries for sensitive operations (see AGENTS.md §20). */
class AuditService
{
    /**
     * @param  array<string, mixed>|null  $old  Previous values (never secrets or file contents).
     * @param  array<string, mixed>|null  $new  New values.
     */
    public static function record(
        ?User $user,
        string $action,
        string $resourceType,
        ?string $resourceId,
        ?array $old = null,
        ?array $new = null,
        ?string $reason = null,
    ): AuditLog {
        $request = request();

        return AuditLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'old_values' => $old,
            'new_values' => $new,
            'reason' => $reason,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'request_id' => $request->header('X-Request-Id') ? substr((string) $request->header('X-Request-Id'), 0, 100) : null,
            'created_at' => now(),
        ]);
    }
}
