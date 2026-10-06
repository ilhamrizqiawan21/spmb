<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordTest extends TestCase
{
    private const OLD = 'Str0ng-Passw0rd!';

    private const NEW = 'An0ther-Passw0rd!';

    private function login(User $user, string $password = self::OLD): string
    {
        $token = $this->postJson(self::API.'/auth/login', ['identifier' => $user->email, 'password' => $password])
            ->assertOk()->json('token');
        $this->app['auth']->forgetGuards();

        return $token;
    }

    private function me(string $token): int
    {
        $status = $this->withToken($token)->getJson(self::API.'/auth/me')->status();
        $this->app['auth']->forgetGuards();

        return $status;
    }

    public function test_forgot_password_answers_the_same_for_known_and_unknown_emails(): void
    {
        Notification::fake();
        $user = $this->makeUser('parent');

        $known = $this->postJson(self::API.'/auth/forgot-password', ['email' => strtoupper($user->email)]);
        $unknown = $this->postJson(self::API.'/auth/forgot-password', ['email' => 'nobody@example.test']);

        $known->assertStatus(202);
        $unknown->assertStatus(202);
        $this->assertSame($known->json(), $unknown->json());
        Notification::assertSentTo($user, ResetPasswordNotification::class);
        Notification::assertCount(1);
    }

    public function test_reset_flow_sets_new_password_revokes_tokens_and_is_single_use(): void
    {
        Notification::fake();
        $user = $this->makeUser('parent');
        $oldToken = $this->login($user);

        $this->postJson(self::API.'/auth/forgot-password', ['email' => $user->email])->assertStatus(202);
        $token = null;
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $payload = ['email' => $user->email, 'token' => $token, 'password' => self::NEW];
        $this->postJson(self::API.'/auth/reset-password', $payload)->assertOk();

        $this->assertSame(401, $this->me($oldToken), 'existing API tokens must be revoked');
        $this->postJson(self::API.'/auth/login', ['identifier' => $user->email, 'password' => self::OLD])->assertUnauthorized();
        $this->login($user, self::NEW);

        $this->postJson(self::API.'/auth/reset-password', $payload)->assertStatus(400)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->assertDatabaseCount('password_reset_tokens', 0);
        $this->assertSame(1, AuditLog::where('action', 'auth.password_reset')->where('resource_id', $user->id)->count());
    }

    public function test_reset_rejects_bad_token_and_weak_password(): void
    {
        $user = $this->makeUser('parent');

        $this->postJson(self::API.'/auth/reset-password', ['email' => $user->email, 'token' => 'nope', 'password' => self::NEW])
            ->assertStatus(400)->assertJsonPath('error.details.token.0', 'The reset link is invalid or has expired.');
        $this->postJson(self::API.'/auth/reset-password', ['email' => $user->email, 'token' => 'nope', 'password' => '12345678'])
            ->assertStatus(400);
        $this->assertTrue(password_verify(self::OLD, $user->fresh()->password));
    }

    public function test_change_password_requires_current_and_keeps_only_current_session(): void
    {
        $user = $this->makeUser('parent');
        $current = $this->login($user);
        $other = $this->login($user);

        $this->withToken($current)->postJson(self::API.'/auth/change-password', ['current_password' => 'wrong', 'password' => self::NEW])
            ->assertStatus(400)->assertJsonPath('error.details.current_password.0', 'The current password is incorrect.');
        $this->app['auth']->forgetGuards();

        $this->withToken($current)->postJson(self::API.'/auth/change-password', ['current_password' => self::OLD, 'password' => self::NEW])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $this->assertSame(200, $this->me($current));
        $this->assertSame(401, $this->me($other));
        $this->login($user, self::NEW);
        $this->assertSame(1, AuditLog::where('action', 'auth.password_changed')->count());
    }

    public function test_password_endpoints_are_rate_limited(): void
    {
        Notification::fake();

        foreach (range(1, 5) as $i) {
            $this->postJson(self::API.'/auth/forgot-password', ['email' => "u{$i}@example.test"])->assertStatus(202);
        }
        $this->postJson(self::API.'/auth/forgot-password', ['email' => 'u6@example.test'])->assertStatus(429);
    }
}
