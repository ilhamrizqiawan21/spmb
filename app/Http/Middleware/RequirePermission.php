<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;

/** Usage: `permission:application.verify,document.verify` (any-of). Run after auth:sanctum. */
class RequirePermission
{
    public function handle(Request $request, Closure $next, string ...$codes)
    {
        $user = $request->user();
        if (! $user) {
            throw ApiException::unauthenticated();
        }
        if (! $user->hasAnyPermCodes($codes)) {
            throw ApiException::forbidden(
                count($codes) === 1
                    ? "Permission '{$codes[0]}' is required for this action."
                    : 'One of permissions ['.implode(', ', $codes).'] is required for this action.'
            );
        }

        return $next($request);
    }
}
