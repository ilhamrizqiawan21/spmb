<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Resources\UserProfileResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class AuthController extends ApiController
{
    private const PASSWORD_MESSAGES = ['password.regex' => 'This password is entirely numeric.'];

    /** @return list<mixed> */
    private static function passwordRules(): array
    {
        return ['required', 'string', Password::min(8), 'regex:/\D/'];
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => self::passwordRules(),
        ], self::PASSWORD_MESSAGES);

        $email = isset($data['email']) ? mb_strtolower(trim($data['email'])) : null;
        $phone = isset($data['phone']) ? trim($data['phone']) : null;

        if (! $email && ! $phone) {
            throw ApiException::validation(['identifier' => 'Either email or phone number is required.']);
        }
        if ($email && User::whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw ApiException::validation(['email' => 'Email is already registered.']);
        }
        if ($phone && User::where('phone', $phone)->exists()) {
            throw ApiException::validation(['phone' => 'Phone number is already registered.']);
        }

        $user = AuthService::register([
            'name' => $data['name'], 'email' => $email, 'phone' => $phone, 'password' => $data['password'],
        ]);

        return $this->created(new UserProfileResource($user));
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        [$user, $token] = AuthService::login($data['identifier'], $data['password']);

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => (new UserProfileResource($user))->resolve(),
        ]);
    }

    public function logout(Request $request)
    {
        AuthService::logout($request->user());

        return $this->noContent();
    }

    /** Always 202, whether or not the email is registered (no account enumeration). */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:255']]);

        AuthService::requestPasswordReset($data['email']);

        return response()->json(['message' => 'If the email is registered, a reset link has been sent.'], 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'token' => ['required', 'string'],
            'password' => self::passwordRules(),
        ], self::PASSWORD_MESSAGES);

        AuthService::resetPassword($data['email'], $data['token'], $data['password']);

        return response()->json(['message' => 'Password has been reset. Please sign in again.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => self::passwordRules(),
        ], self::PASSWORD_MESSAGES);

        AuthService::changePassword($request->user(), $data['current_password'], $data['password']);

        return response()->json(['message' => 'Password has been changed.']);
    }

    public function me(Request $request): UserProfileResource
    {
        return new UserProfileResource($request->user());
    }
}
