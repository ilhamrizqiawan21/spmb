<?php

namespace App\Exceptions;

use RuntimeException;

/** Domain/HTTP error rendered as the standard `{"error": {code, message, details}}` envelope. */
class ApiException extends RuntimeException
{
    /** @param array<string, mixed>|null $details */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?array $details = null,
    ) {
        parent::__construct($message);
    }

    /** @param array<string, string|list<string>> $errors field => message(s) */
    public static function validation(array $errors): self
    {
        $details = [];
        foreach ($errors as $field => $msgs) {
            $details[$field] = (array) $msgs;
        }

        return new self(400, 'VALIDATION_ERROR', self::firstMessage($details), $details);
    }

    public static function notFound(string $message = 'Not found.', string $field = 'detail'): self
    {
        return new self(404, 'NOT_FOUND', $message, [$field => $message]);
    }

    public static function forbidden(string $message = 'You do not have permission to perform this action.'): self
    {
        return new self(403, 'FORBIDDEN', $message, ['detail' => $message]);
    }

    public static function unauthenticated(string $message = 'Authentication credentials were not provided.'): self
    {
        return new self(401, 'AUTHENTICATION_REQUIRED', $message, ['detail' => $message]);
    }

    public static function tooManyRequests(string $message): self
    {
        return new self(429, 'RATE_LIMIT_EXCEEDED', $message, ['detail' => $message]);
    }

    /** @param array<string, list<string>> $details */
    private static function firstMessage(array $details): string
    {
        foreach ($details as $msgs) {
            return (string) ($msgs[0] ?? 'Invalid input.');
        }

        return 'Invalid input.';
    }
}
