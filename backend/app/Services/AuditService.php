<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Writes append-only audit entries for sensitive actions.
 *
 * Never pass secrets or raw personal data: values whose key looks like a credential are
 * dropped defensively, and personal-data edits should log field *names* only.
 */
class AuditService
{
    private const SECRET_KEY = '/password|token|secret|authorization/i';

    public static function log(
        string $action,
        ?Model $resource = null,
        ?array $old = null,
        ?array $new = null,
        ?User $user = null,
        ?string $resourceType = null,
        ?string $resourceId = null,
    ): AuditLog {
        $request = request();
        $actor = $user ?? $request->user();

        return AuditLog::create([
            'user_id' => $actor?->id,
            'action' => $action,
            'resource_type' => $resourceType ?? ($resource ? Str::snake(class_basename($resource)) : null),
            'resource_id' => $resourceId ?? $resource?->getKey(),
            'old_values' => $old === null ? null : self::scrub($old),
            'new_values' => $new === null ? null : self::scrub($new),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ? mb_substr($request->userAgent(), 0, 255) : null,
        ]);
    }

    /** Audit a create/update/delete of master data with the non-sensitive attribute values. */
    public static function master(string $verb, Model $model, ?array $old = null): void
    {
        $new = $verb === 'deleted' ? null : $model->only(array_keys($model->getAttributes()));
        self::log("master.{$verb}", $model, $old, $new);
    }

    /** @param array<string, mixed> $values */
    private static function scrub(array $values): array
    {
        foreach ($values as $key => $value) {
            if (is_string($key) && preg_match(self::SECRET_KEY, $key)) {
                unset($values[$key]);
            } elseif (is_array($value)) {
                $values[$key] = self::scrub($value);
            }
        }

        return $values;
    }
}
