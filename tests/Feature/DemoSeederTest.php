<?php

namespace Tests\Feature;

use Database\Seeders\DemoSeeder;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    public function test_seeder_is_idempotent_and_accounts_can_login(): void
    {
        $this->seed(DemoSeeder::class);
        $this->seed(DemoSeeder::class);

        $this->postJson(self::API.'/auth/login', ['identifier' => 'admission_admin@demo.test', 'password' => DemoSeeder::PASSWORD])
            ->assertOk()->assertJsonPath('user.roles', ['admission_admin']);
        $this->assertDatabaseCount('users', 8);
        $this->getJson(self::API.'/admission/periods')->assertOk()->assertJsonCount(1);
        $this->getJson(self::API.'/selection/components')->assertOk()->assertJsonCount(2);
    }
}
