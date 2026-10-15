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
}
