<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

abstract class ApiController extends Controller
{
    protected function created(JsonResource $resource): JsonResponse
    {
        return $resource->response()->setStatusCode(201);
    }

    /** Force 200 (Laravel auto-returns 201 for resources wrapping a freshly created model). */
    protected function ok(JsonResource $resource): JsonResponse
    {
        return $resource->response()->setStatusCode(200);
    }

    protected function noContent(): Response
    {
        return response()->noContent();
    }

    /** Parse an optional UUID query parameter; malformed values are reported as 404 (like unknown ids). */
    protected function uuidQuery(?string $value, string $field): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! Str::isUuid($value)) {
            throw ApiException::notFound("Invalid {$field} format.", $field);
        }

        return strtolower($value);
    }

    /** Normalise any ISO-8601 input (with or without offset) to the application timezone. */
    protected function dt(?string $value): ?Carbon
    {
        return $value === null || $value === '' ? null : Carbon::parse($value)->setTimezone(config('app.timezone'));
    }
}
