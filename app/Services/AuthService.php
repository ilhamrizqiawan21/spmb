<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Role;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    public const PARENT_ROLE = 'parent';

    /** @param array{name:string,email:?string,phone:?string,password:string} $data */
    public static function register(array $data): User
    {
        $user = User::create([
            'name' => trim($data['name']),
            'email' => $data['email'] ?: null,
            'phone' => $data['phone'] ?: null,
            'password' => $data['password'],
        ]);

        if ($role = Role::where('code', self::PARENT_ROLE)->first()) {
            UserRole::create(['user_id' => $user->id, 'role_id' => $role->id]);
        }

        return $user;
    }

    /** @return array{0:User,1:string} user and a fresh API token */
    public static function login(string $identifier, string $password): array
    {
        $ident = mb_strtolower(trim($identifier));
        $cacheKey = 'login_attempts:'.sha1($ident);
        $attempts = (int) Cache::get($cacheKey, 0);

        if ($attempts >= config('spmb.login_max_attempts')) {
            throw ApiException::tooManyRequests('Too many failed login attempts. Please try again in 15 minutes.');
        }

        $user = User::findByIdentifier($ident);
        if ($user === null || ! Hash::check($password, $user->password)) {
            Cache::put($cacheKey, $attempts + 1, config('spmb.login_window_seconds'));
            throw ApiException::unauthenticated('Invalid credentials.');
        }

        if (! $user->is_active) {
            throw ApiException::unauthenticated('This account is inactive.');
        }

        Cache::forget($cacheKey);
        $user->forceFill(['last_login' => now()])->save();

        return [$user, $user->createToken('api')->plainTextToken];
    }

    public static function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }

    /**
     * Email a reset link when the address belongs to an account. Callers must respond identically either way
     * so the endpoint cannot be used to discover which emails are registered.
     */
    public static function requestPasswordReset(string $email): void
    {
        Password::broker()->sendResetLink(['email' => mb_strtolower(trim($email))]);
    }

    public static function resetPassword(string $email, string $token, string $password): void
    {
        $user = null;
        $status = Password::broker()->reset(
            ['email' => mb_strtolower(trim($email)), 'token' => $token, 'password' => $password],
            function (User $u, string $newPassword) use (&$user) {
                $u->forceFill(['password' => $newPassword])->save();
                $u->tokens()->delete();
                $user = $u;
            },
        );

        if ($status !== Password::PASSWORD_RESET || $user === null) {
            throw ApiException::validation(['token' => 'The reset link is invalid or has expired.']);
        }

        AuditService::record($user, 'auth.password_reset', 'user', $user->id);
    }

    /** Change the password and sign out every other session/token of this user. */
    public static function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw ApiException::validation(['current_password' => 'The current password is incorrect.']);
        }

        $user->forceFill(['password' => $newPassword])->save();

        $current = $user->currentAccessToken();
        $others = $user->tokens();
        if ($current instanceof PersonalAccessToken) {
            $others->where('id', '!=', $current->id);
        }
        $others->delete();

        AuditService::record($user, 'auth.password_changed', 'user', $user->id);
    }
}
