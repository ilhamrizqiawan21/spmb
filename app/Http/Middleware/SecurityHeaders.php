<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Adds baseline security headers to every response; CSP only to the HTML shell of the SPA. */
class SecurityHeaders
{
    private const CSP = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'self' blob:",
        "frame-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        if ($request->isSecure() && app()->isProduction()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // The Vite dev server (HMR over localhost:5173 + WebSocket) is incompatible with a strict CSP.
        $isHtml = str_contains((string) $headers->get('Content-Type'), 'text/html');
        if ($isHtml && ! file_exists(public_path('hot'))) {
            $headers->set('Content-Security-Policy', implode('; ', self::CSP));
        }

        return $response;
    }
}
