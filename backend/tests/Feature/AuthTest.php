<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_health_and_ready(): void
    {
        $this->getJson('/health')->assertOk()->assertJson(['status' => 'ok']);
        $this->getJson('/ready')->assertOk()->assertJson(['status' => 'ready']);
    }

    public function test_register_with_email_assigns_parent_role(): void
    {
        $res = $this->postJson(self::API.'/auth/register', [
            'name' => 'Ibu Siti', 'email' => 'Siti@Example.test', 'password' => 'Str0ng-Passw0rd!',
        ])->assertCreated();

        $res->assertJsonPath('email', 'siti@example.test')->assertJsonPath('roles', ['parent'])->assertJsonPath('permissions', []);
        $this->assertDatabaseHas('users', ['email' => 'siti@example.test']);
    }

    public function test_register_requires_identifier_and_rejects_duplicates_and_weak_passwords(): void
    {
        $this->postJson(self::API.'/auth/register', ['name' => 'X', 'password' => 'Str0ng-Passw0rd!'])
            ->assertStatus(400)->assertJsonPath('error.code', 'VALIDATION_ERROR')->assertJsonPath('error.details.identifier.0', 'Either email or phone number is required.');

        $this->postJson(self::API.'/auth/register', ['name' => 'X', 'phone' => '0812', 'password' => 'short'])->assertStatus(400);
        $this->postJson(self::API.'/auth/register', ['name' => 'X', 'phone' => '0812', 'password' => '1234567890'])->assertStatus(400);

        $this->postJson(self::API.'/auth/register', ['name' => 'X', 'phone' => '0812', 'password' => 'Str0ng-Passw0rd!'])->assertCreated();
        $this->postJson(self::API.'/auth/register', ['name' => 'Y', 'phone' => '0812', 'password' => 'Str0ng-Passw0rd!'])
            ->assertStatus(400)->assertJsonPath('error.details.phone.0', 'Phone number is already registered.');
    }

    public function test_login_me_and_logout(): void
    {
        $user = $this->makeUser('admission_admin', ['email' => 'admin@example.test', 'phone' => '0899']);

        $token = $this->postJson(self::API.'/auth/login', ['identifier' => 'ADMIN@example.test', 'password' => 'Str0ng-Passw0rd!'])
            ->assertOk()->assertJsonPath('token_type', 'Bearer')->assertJsonPath('user.roles', ['admission_admin'])->json('token');

        $this->withToken($token)->getJson(self::API.'/auth/me')->assertOk()
            ->assertJsonPath('id', $user->id)->assertJsonFragment(['application.override']);

        // login by phone also works
        $this->postJson(self::API.'/auth/login', ['identifier' => '0899', 'password' => 'Str0ng-Passw0rd!'])->assertOk();

        $this->withToken($token)->postJson(self::API.'/auth/logout')->assertNoContent();
        $this->assertDatabaseCount('personal_access_tokens', 1); // only the phone login token remains
    }

    public function test_me_requires_authentication_with_error_envelope(): void
    {
        $this->getJson(self::API.'/auth/me')->assertStatus(401)->assertJsonPath('error.code', 'AUTHENTICATION_REQUIRED');
    }

    public function test_invalid_credentials_and_lockout(): void
    {
        $this->makeUser('parent', ['email' => 'p@example.test']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson(self::API.'/auth/login', ['identifier' => 'p@example.test', 'password' => 'wrong'])
                ->assertStatus(401)->assertJsonPath('error.code', 'AUTHENTICATION_REQUIRED');
        }
        $this->postJson(self::API.'/auth/login', ['identifier' => 'p@example.test', 'password' => 'Str0ng-Passw0rd!'])
            ->assertStatus(429)->assertJsonPath('error.code', 'RATE_LIMIT_EXCEEDED');
    }

    public function test_inactive_user_cannot_login(): void
    {
        $this->makeUser('parent', ['email' => 'off@example.test', 'is_active' => false]);
        $this->postJson(self::API.'/auth/login', ['identifier' => 'off@example.test', 'password' => 'Str0ng-Passw0rd!'])->assertStatus(401);
    }

    public function test_rbac_permission_middleware(): void
    {
        $parent = $this->makeUser('parent');
        $admin = $this->makeUser('admission_admin');

        $payload = ['name' => '2027/2028', 'start_date' => '2027-07-01', 'end_date' => '2028-06-30'];
        $this->as($parent)->postJson(self::API.'/admission/academic-years', $payload)
            ->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->as($admin)->postJson(self::API.'/admission/academic-years', $payload)->assertCreated();
    }

    public function test_unknown_route_and_malformed_uuid_return_404_envelope(): void
    {
        $this->getJson(self::API.'/nope')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->getJson(self::API.'/admission/periods/not-a-uuid')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_super_admin_has_all_permissions(): void
    {
        $user = $this->makeUser('super_admin');
        $this->assertCount(12, $user->permissionCodes());
        $this->assertInstanceOf(User::class, $user);
    }
}
