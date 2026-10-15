<?php

namespace Tests\Feature;

use App\Models\AdmissionPeriod;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    public function test_super_admin_can_access_admin_dashboard_stats(): void
    {
        $admin = $this->makeUser('super_admin');
        $this->makePeriod();

        $res = $this->as($admin)->getJson(self::API.'/system/admin-dashboard')->assertOk();
        $res->assertJsonStructure([
            'health' => ['database', 'cache', 'environment', 'queue', 'notifications', 'storage'],
            'alerts',
            'governance' => ['total_users', 'active_users', 'roles'],
            'academic_year',
            'periods',
            'recent_audits',
        ]);
        $res->assertJsonPath('health.database', 'ok');
    }

    public function test_non_override_users_cannot_access_admin_dashboard(): void
    {
        $verifier = $this->makeUser('verifier');
        $parent = $this->makeUser('parent');

        $this->as($verifier)->getJson(self::API.'/system/admin-dashboard')->assertForbidden();
        $this->as($parent)->getJson(self::API.'/system/admin-dashboard')->assertForbidden();
    }

    public function test_super_admin_can_clear_cache(): void
    {
        $admin = $this->makeUser('super_admin');

        $res = $this->as($admin)->postJson(self::API.'/system/actions/clear-cache');
        $res->assertOk();
        $res->assertJsonFragment(['message' => 'Cache aplikasi dan data sementara berhasil dibersihkan.']);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'SYSTEM_CLEAR_CACHE',
            'resource_type' => 'System',
        ]);
    }

    public function test_super_admin_can_retry_and_flush_failed_jobs(): void
    {
        $admin = $this->makeUser('super_admin');

        // Retry jobs
        $retryRes = $this->as($admin)->postJson(self::API.'/system/actions/retry-jobs');
        $retryRes->assertOk();

        // Flush jobs
        $flushRes = $this->as($admin)->postJson(self::API.'/system/actions/flush-failed-jobs');
        $flushRes->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'SYSTEM_FLUSH_FAILED_JOBS',
            'resource_type' => 'Queue',
        ]);
    }

    public function test_super_admin_can_toggle_admission_period(): void
    {
        $admin = $this->makeUser('super_admin');
        $period = $this->makePeriod();
        $this->assertTrue($period->is_active);

        // Toggle to inactive
        $res = $this->as($admin)->postJson(self::API."/system/actions/toggle-period/{$period->id}");
        $res->assertOk();
        $res->assertJsonPath('period.is_active', false);
        $this->assertFalse($period->fresh()->is_active);

        // Toggle back to active
        $res2 = $this->as($admin)->postJson(self::API."/system/actions/toggle-period/{$period->id}");
        $res2->assertOk();
        $res2->assertJsonPath('period.is_active', true);
        $this->assertTrue($period->fresh()->is_active);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'resource_type' => 'AdmissionPeriod',
            'resource_id' => $period->id,
        ]);
    }

    public function test_unauthorized_user_cannot_perform_system_actions(): void
    {
        $verifier = $this->makeUser('verifier');

        $this->as($verifier)->postJson(self::API.'/system/actions/clear-cache')->assertForbidden();
        $this->as($verifier)->postJson(self::API.'/system/actions/retry-jobs')->assertForbidden();
    }
}

