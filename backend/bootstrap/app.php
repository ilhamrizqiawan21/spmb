<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\RequirePermission;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: null,
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['permission' => RequirePermission::class]);
        $middleware->api(append: [SecurityHeaders::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $envelope = fn (int $status, string $code, string $message, mixed $details = null) => response()->json(
            ['error' => ['code' => $code, 'message' => $message, 'details' => $details]],
            $status,
        );

        $exceptions->shouldRenderJsonWhen(fn (Request $request) => true);

        $exceptions->render(fn (ApiException $e) => $envelope($e->status, $e->errorCode, $e->getMessage(), $e->details));

        $exceptions->render(function (ValidationException $e) use ($envelope) {
            $errors = $e->errors();
            $first = collect($errors)->flatten()->first() ?? 'Invalid input.';

            return $envelope(400, 'VALIDATION_ERROR', (string) $first, $errors);
        });

        $exceptions->render(fn (AuthenticationException $e) => $envelope(
            401, 'AUTHENTICATION_REQUIRED', 'Authentication credentials were not provided.',
            ['detail' => 'Authentication credentials were not provided.'],
        ));

        $exceptions->render(fn (NotFoundHttpException $e) => $envelope(
            404, 'NOT_FOUND', 'Not found.', ['detail' => 'Not found.'],
        ));

        $exceptions->render(fn (TooManyRequestsHttpException $e) => $envelope(
            429, 'RATE_LIMIT_EXCEEDED', 'Too many requests.', ['detail' => 'Too many requests.'],
        ));

        $exceptions->render(function (HttpExceptionInterface $e) use ($envelope) {
            $status = $e->getStatusCode();
            $code = match ($status) {
                403 => 'FORBIDDEN',
                405 => 'METHOD_NOT_ALLOWED',
                409 => 'CONFLICT',
                default => 'HTTP_ERROR',
            };
            $message = $e->getMessage() !== '' ? $e->getMessage() : 'HTTP error.';

            return $envelope($status, $code, $message, ['detail' => $message]);
        });

        // Unhandled errors: never leak stack traces, SQL or paths in production.
        $exceptions->render(function (Throwable $e) use ($envelope) {
            if (config('app.debug')) {
                return null;
            }
            report($e);

            return $envelope(500, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred');
        });
    })->create();
