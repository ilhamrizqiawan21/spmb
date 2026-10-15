<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use Tests\TestCase;

class AccountTest extends TestCase
{
    private const ME = self::API.'/auth/me';

    public function test_user_updates_own_name_and_phone_with_audit(): void
    {
        $user = $this->makeUser('parent', ['phone' => '081200000001']);
        $oldName = $user->name;

        $this->as($user)->patchJson(self::ME, ['name' => '  Ibu Sari  ', 'phone' => '0812 3456 7890'])->assertOk()
            ->assertJsonPath('name', 'Ibu Sari')->assertJsonPath('phone', '0812 3456 7890');
        $log = AuditLog::where('action', 'auth.profile_updated')->sole();
        $this->assertSame(['name' => $oldName, 'phone' => '081200000001'], $log->old_values);

        $this->patchJson(self::ME, ['email' => 'other@example.test'])->assertOk();
        $this->assertNotSame('other@example.test', $user->fresh()->email, 'email is not editable here');
    }

    public function test_phone_rules(): void
    {
        $this->makeUser('parent', ['phone' => '081299999999']);
        $user = $this->makeUser('parent');

        $this->as($user)->patchJson(self::ME, ['phone' => '081299999999'])->assertStatus(400)
            ->assertJsonPath('error.details.phone.0', 'Phone number is already registered.');
        $this->patchJson(self::ME, ['phone' => 'bukan nomor'])->assertStatus(400);
        $this->patchJson(self::ME, ['name' => ''])->assertStatus(400);
        $this->patchJson(self::ME, ['phone' => ''])->assertOk()->assertJsonPath('phone', null);

        $phoneOnly = $this->makeUser('parent', ['email' => null, 'phone' => '081277777777']);
        $this->as($phoneOnly)->patchJson(self::ME, ['phone' => null])->assertStatus(400)
            ->assertJsonPath('error.details.phone.0', 'Phone number is required for an account without email.');
    }

    public function test_requires_authentication(): void
    {
        $this->patchJson(self::ME, ['name' => 'X'])->assertUnauthorized();
    }

    public function test_public_school_info_hides_empty_values(): void
    {
        config(['spmb.school' => ['name' => 'SMP Contoh', 'phone' => '', 'email' => 'spmb@contoh.sch.id']]);

        $this->getJson(self::API.'/public/school')->assertOk()
            ->assertExactJson(['name' => 'SMP Contoh', 'phone' => null, 'email' => 'spmb@contoh.sch.id']);
    }
}
