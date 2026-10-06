<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const CODE = 'payment.read';

    /** Roles that may view invoices and payment proofs (PRD §7.4 finance officer, plus admin). */
    private const ROLES = ['finance', 'admission_admin', 'super_admin'];

    public function up(): void
    {
        $now = now();
        $permissionId = DB::table('permissions')->where('code', self::CODE)->value('id');
        if (! $permissionId) {
            $permissionId = (string) Str::uuid();
            DB::table('permissions')->insert([
                'id' => $permissionId, 'code' => self::CODE, 'name' => 'Payment Read',
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        foreach (DB::table('roles')->whereIn('code', self::ROLES)->pluck('id') as $roleId) {
            $exists = DB::table('role_permissions')->where('role_id', $roleId)->where('permission_id', $permissionId)->exists();
            if (! $exists) {
                DB::table('role_permissions')->insert([
                    'id' => (string) Str::uuid(), 'role_id' => $roleId, 'permission_id' => $permissionId,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('code', self::CODE)->value('id');
        if ($permissionId) {
            DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }
};
