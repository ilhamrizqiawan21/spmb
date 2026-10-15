<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    public function test_super_admin_can_list_users_and_roles(): void
    {
        $admin = $this->makeUser('super_admin');

        $this->as($admin)->getJson(self::API.'/users')->assertOk()
            ->assertJsonStructure(['data', 'meta']);

        $this->getJson(self::API.'/users/roles')->assertOk()
            ->assertJsonFragment(['code' => 'verifier'])
            ->assertJsonFragment(['code' => 'finance']);
    }

    public function test_unauthorized_users_cannot_access_user_management(): void
    {
        $verifier = $this->makeUser('verifier');
        $parent = $this->makeUser('parent');

        $this->as($verifier)->getJson(self::API.'/users')->assertForbidden();
        $this->as($parent)->getJson(self::API.'/users')->assertForbidden();
    }

    public function test_super_admin_can_create_new_staff_user(): void
    {
        $admin = $this->makeUser('super_admin');

        $payload = [
            'name' => 'Budi Verifikator',
            'email' => 'budi.verif@sekolah.sch.id',
            'password' => 'SecurePass123!',
            'roles' => ['verifier'],
        ];

        $res = $this->as($admin)->postJson(self::API.'/users', $payload)->assertCreated();
        $res->assertJsonPath('name', 'Budi Verifikator');
        $res->assertJsonPath('roles.0.code', 'verifier');

        $created = User::where('email', 'budi.verif@sekolah.sch.id')->first();
        $this->assertNotNull($created);
        $this->assertTrue($created->roles()->where('code', 'verifier')->exists());

        // Verify audit log
        $log = AuditLog::where('action', 'user.created')->where('resource_id', $created->id)->first();
        $this->assertNotNull($log);
        $this->assertSame($admin->id, $log->user_id);
    }

    public function test_super_admin_can_update_user_and_roles(): void
    {
        $admin = $this->makeUser('super_admin');
        $staff = $this->makeUser('verifier');

        $payload = [
            'name' => 'Nama Baru Staf',
            'roles' => ['verifier', 'assessor'],
            'reason' => 'Penambahan tugas sebagai penilai',
        ];

        $this->as($admin)->patchJson(self::API."/users/{$staff->id}", $payload)->assertOk()
            ->assertJsonPath('name', 'Nama Baru Staf');

        $staff->refresh();
        $this->assertSame('Nama Baru Staf', $staff->name);
        $this->assertTrue($staff->roles()->where('code', 'assessor')->exists());

        // Verify audit log
        $log = AuditLog::where('action', 'user.updated')->where('resource_id', $staff->id)->first();
        $this->assertNotNull($log);
        $this->assertSame('Penambahan tugas sebagai penilai', $log->reason);
    }

    public function test_user_cannot_disable_self(): void
    {
        $admin = $this->makeUser('super_admin');

        $this->as($admin)->deleteJson(self::API."/users/{$admin->id}")->assertStatus(422);
    }

    public function test_super_admin_can_disable_user(): void
    {
        $admin = $this->makeUser('super_admin');
        $staff = $this->makeUser('verifier');

        $this->as($admin)->deleteJson(self::API."/users/{$staff->id}")->assertOk();

        $staff->refresh();
        $this->assertFalse($staff->is_active);

        $log = AuditLog::where('action', 'user.disabled')->where('resource_id', $staff->id)->first();
        $this->assertNotNull($log);
    }
}

