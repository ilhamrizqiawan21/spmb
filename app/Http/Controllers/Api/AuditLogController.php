<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends ApiController
{
    /** Read-only, newest first. Requires `audit.read` (enforced by route middleware). */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'resource_type' => ['nullable', 'string', 'max:100'],
            'resource_id' => ['nullable', 'string'],
            'user_id' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $page = AuditLog::with('user:id,name')
            ->when($data['action'] ?? null, fn ($q, $v) => $q->where('action', $v))
            ->when($data['resource_type'] ?? null, fn ($q, $v) => $q->where('resource_type', $v))
            ->when($this->uuidQuery($data['resource_id'] ?? null, 'resource_id'), fn ($q, $v) => $q->where('resource_id', $v))
            ->when($this->uuidQuery($data['user_id'] ?? null, 'user_id'), fn ($q, $v) => $q->where('user_id', $v))
            ->when($data['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', $v))
            ->when($data['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<=', $v))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate((int) ($data['per_page'] ?? 50));

        return response()->json([
            'data' => $page->getCollection()->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'resource_type' => $log->resource_type,
                'resource_id' => $log->resource_id,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'reason' => $log->reason,
                'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name] : null,
                'ip_address' => $log->ip_address,
                'request_id' => $log->request_id,
                'created_at' => $log->created_at->toIso8601String(),
            ])->all(),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }
}
