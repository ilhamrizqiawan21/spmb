<?php

namespace App\Http\Controllers\Api;

use App\Models\Role;
use App\Models\User;
use App\Models\UserRole;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends ApiController
{
    /**
     * List all system users with search, role filtering, and status.
     * Accessible by users with `user.manage` or `application.override`.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'string', 'in:true,false,1,0'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::with('roles')
            ->when($data['search'] ?? null, function ($q, $term) {
                $term = trim($term);
                $q->where(function ($sub) use ($term) {
                    $sub->where('name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%")
                        ->orWhere('phone', 'like', "%{$term}%");
                });
            })
            ->when($data['role'] ?? null, function ($q, $role) {
                $q->whereHas('roles', fn ($r) => $r->where('code', $role));
            })
            ->when(isset($data['is_active']), function ($q) use ($data) {
                $active = in_array($data['is_active'], ['true', '1'], true);
                $q->where('is_active', $active);
            })
            ->orderBy('name');

        $page = $query->paginate((int) ($data['per_page'] ?? 20));

        return response()->json([
            'data' => $page->getCollection()->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'is_active' => $u->is_active,
                'last_login' => $u->last_login?->toIso8601String(),
                'created_at' => $u->created_at->toIso8601String(),
                'roles' => $u->roles->map(fn ($r) => [
                    'id' => $r->id,
                    'code' => $r->code,
                    'name' => $r->name,
                ])->values()->all(),
            ])->all(),
            'meta' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * List all available roles in the system.
     */
    public function roles(): JsonResponse
    {
        $roles = Role::orderBy('is_system', 'desc')->orderBy('name')->get();

        return response()->json($roles->map(fn (Role $r) => [
            'id' => $r->id,
            'code' => $r->code,
            'name' => $r->name,
            'description' => $r->description,
            'is_system' => $r->is_system,
        ])->all());
    }

    /**
     * Create a new staff or admin user.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:users,phone'],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', 'string', 'exists:roles,code'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $created = DB::transaction(function () use ($data, $request) {
            $user = User::create([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
                'is_active' => $data['is_active'] ?? true,
                'email_verified_at' => now(),
            ]);

            $roleIds = Role::whereIn('code', $data['roles'])->pluck('id');
            foreach ($roleIds as $roleId) {
                UserRole::create(['user_id' => $user->id, 'role_id' => $roleId]);
            }

            AuditService::record(
                $request->user(),
                'user.created',
                'user',
                $user->id,
                null,
                [
                    'name' => $user->name,
                    'email' => $user->email,
                    'roles' => $data['roles'],
                    'is_active' => $user->is_active,
                ],
                'User baru ditambahkan oleh admin'
            );

            return $user->load('roles');
        });

        return response()->json([
            'id' => $created->id,
            'name' => $created->name,
            'email' => $created->email,
            'phone' => $created->phone,
            'is_active' => $created->is_active,
            'roles' => $created->roles->map(fn ($r) => [
                'id' => $r->id,
                'code' => $r->code,
                'name' => $r->name,
            ])->values()->all(),
        ], 201);
    }

    /**
     * Update an existing user.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::with('roles')->findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'is_active' => ['sometimes', 'required', 'boolean'],
            'roles' => ['sometimes', 'required', 'array', 'min:1'],
            'roles.*' => ['required', 'string', 'exists:roles,code'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $oldRoles = $user->roles->pluck('code')->sort()->values()->all();
        $oldValues = [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => $user->is_active,
            'roles' => $oldRoles,
        ];

        DB::transaction(function () use ($user, $data, $oldValues, $request) {
            if (isset($data['name'])) {
                $user->name = $data['name'];
            }
            if (isset($data['email'])) {
                $user->email = strtolower($data['email']);
            }
            if (array_key_exists('phone', $data)) {
                $user->phone = $data['phone'];
            }
            if (isset($data['is_active'])) {
                $user->is_active = (bool) $data['is_active'];
            }
            if (! empty($data['password'])) {
                $user->password = $data['password'];
                // Revoke active sessions when password is changed by admin
                $user->tokens()->delete();
            }

            $user->save();

            if (isset($data['roles'])) {
                $roleIds = Role::whereIn('code', $data['roles'])->pluck('id')->all();
                UserRole::where('user_id', $user->id)->whereNotIn('role_id', $roleIds)->delete();
                foreach ($roleIds as $roleId) {
                    UserRole::firstOrCreate(['user_id' => $user->id, 'role_id' => $roleId]);
                }
            }

            $user->load('roles');
            $newRoles = $user->roles->pluck('code')->sort()->values()->all();

            $newValues = [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_active' => $user->is_active,
                'roles' => $newRoles,
            ];

            AuditService::record(
                $request->user(),
                'user.updated',
                'user',
                $user->id,
                $oldValues,
                $newValues,
                $data['reason'] ?? 'Diperbarui oleh administrator'
            );
        });

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => $user->is_active,
            'roles' => $user->roles->map(fn ($r) => [
                'id' => $r->id,
                'code' => $r->code,
                'name' => $r->name,
            ])->values()->all(),
        ]);
    }

    /**
     * Disable a user (cannot disable own account).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($request->user() && $request->user()->id === $user->id) {
            return response()->json(['message' => 'Anda tidak dapat menonaktifkan akun Anda sendiri.'], 422);
        }

        DB::transaction(function () use ($user, $request) {
            $user->update(['is_active' => false]);
            $user->tokens()->delete();

            AuditService::record(
                $request->user(),
                'user.disabled',
                'user',
                $user->id,
                ['is_active' => true],
                ['is_active' => false],
                $request->input('reason', 'Akun dinonaktifkan oleh administrator')
            );
        });

        return response()->json(['message' => 'Pengguna berhasil dinonaktifkan.']);
    }
}
