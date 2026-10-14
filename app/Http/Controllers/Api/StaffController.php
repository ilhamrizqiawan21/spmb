<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffController extends ApiController
{
    /**
     * Active staff accounts (any non-parent role), optionally filtered by role code.
     * Exposes only id, name and role codes; used for assignment pickers.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['role' => ['nullable', 'string', 'max:100', 'not_in:parent']]);

        $users = User::where('is_active', true)
            ->whereHas('roles', fn ($r) => $r->where('code', '!=', 'parent'))
            ->when($data['role'] ?? null, fn ($q, $role) => $q->whereHas('roles', fn ($r) => $r->where('code', $role)))
            ->with('roles')->orderBy('name')->get();

        return response()->json($users->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'roles' => $u->roles->pluck('code')->sort()->values()->all(),
        ])->all());
    }
}
