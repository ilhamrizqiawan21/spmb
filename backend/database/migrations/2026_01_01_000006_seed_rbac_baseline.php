<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const ROLES = [
        'super_admin' => 'Super Admin',
        'admission_admin' => 'Admission Admin',
        'verifier' => 'Verifier',
        'finance' => 'Finance',
        'assessor' => 'Assessor',
        'principal' => 'Principal',
        'mpls_officer' => 'MPLS Officer',
        'parent' => 'Parent',
    ];

    private const PERMISSIONS = [
        'application.read', 'application.verify', 'application.override', 'document.verify',
        'payment.verify', 'assessment.input', 'assessment.approve', 'announcement.publish',
        'enrollment.manage', 'mpls.manage', 'user.manage', 'audit.read',
    ];

    private const ROLE_PERMISSIONS = [
        'super_admin' => ['*'],
        'admission_admin' => [
            'application.read', 'application.verify', 'application.override', 'document.verify',
            'announcement.publish', 'enrollment.manage', 'user.manage', 'audit.read',
        ],
        'verifier' => ['application.read', 'document.verify'],
        'finance' => ['application.read', 'payment.verify'],
        'assessor' => ['application.read', 'assessment.input'],
        'principal' => [
            'application.read', 'assessment.approve', 'application.override',
            'announcement.publish', 'audit.read',
        ],
        'mpls_officer' => ['application.read', 'mpls.manage'],
        'parent' => [],
    ];

    public function up(): void
    {
        $now = now();
        $roleIds = [];
        $permIds = [];

        foreach (self::ROLES as $code => $name) {
            $roleIds[$code] = (string) Str::uuid();
            DB::table('roles')->insert([
                'id' => $roleIds[$code], 'code' => $code, 'name' => $name,
                'is_system' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        foreach (self::PERMISSIONS as $code) {
            $permIds[$code] = (string) Str::uuid();
            DB::table('permissions')->insert([
                'id' => $permIds[$code], 'code' => $code,
                'name' => Str::title(str_replace(['.', '_'], ' ', $code)),
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        foreach (self::ROLE_PERMISSIONS as $role => $perms) {
            $perms = $perms === ['*'] ? self::PERMISSIONS : $perms;
            foreach ($perms as $perm) {
                DB::table('role_permissions')->insert([
                    'id' => (string) Str::uuid(),
                    'role_id' => $roleIds[$role],
                    'permission_id' => $permIds[$perm],
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->delete();
        DB::table('permissions')->whereIn('code', self::PERMISSIONS)->delete();
        DB::table('roles')->whereIn('code', array_keys(self::ROLES))->delete();
    }
};
