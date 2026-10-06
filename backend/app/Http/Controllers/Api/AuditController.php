<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $f = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'resource_type' => ['nullable', 'string', 'max:100'],
            'resource_id' => ['nullable', 'string', 'max:36'],
            'user_id' => ['nullable', 'uuid'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $q = AuditLog::with('user')->orderByDesc('created_at')->orderByDesc('id');
        foreach (['action', 'resource_type', 'resource_id', 'user_id'] as $col) {
            if (! empty($f[$col])) {
                $q->where($col, $f[$col]);
            }
        }
        if (! empty($f['from'])) {
            $q->where('created_at', '>=', $this->dt($f['from']));
        }
        if (! empty($f['to'])) {
            $q->where('created_at', '<=', $this->dt($f['to']));
        }

        $page = $q->paginate($f['per_page'] ?? 25);

        return response()->json([
            'data' => AuditLogResource::collection($page->items())->resolve($request),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    /** Distinct action names, for filter dropdowns. */
    public function actions(): JsonResponse
    {
        return response()->json(AuditLog::query()->distinct()->orderBy('action')->pluck('action')->all());
    }
}
