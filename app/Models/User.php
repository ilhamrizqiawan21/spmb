<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected $guarded = [];

    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $hidden = ['password'];

    /** @var list<string>|null */
    private ?array $permissionCache = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_login' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')->withTimestamps();
    }

    public function userRoles(): HasMany
    {
        return $this->hasMany(UserRole::class);
    }

    /** Find a user by email (case-insensitive) or phone. */
    public static function findByIdentifier(string $identifier): ?self
    {
        $ident = trim($identifier);

        return static::whereRaw('LOWER(email) = ?', [mb_strtolower($ident)])->first()
            ?? static::where('phone', $ident)->first();
    }

    /** @return list<string> */
    public function permissionCodes(): array
    {
        return $this->permissionCache ??= DB::table('permissions')
            ->join('role_permissions', 'role_permissions.permission_id', '=', 'permissions.id')
            ->join('user_roles', 'user_roles.role_id', '=', 'role_permissions.role_id')
            ->where('user_roles.user_id', $this->id)
            ->distinct()
            ->pluck('permissions.code')
            ->all();
    }

    public function hasPermCode(string $code): bool
    {
        return in_array($code, $this->permissionCodes(), true);
    }

    /** @param  iterable<string>  $codes */
    public function hasAnyPermCodes(iterable $codes): bool
    {
        $granted = $this->permissionCodes();
        foreach ($codes as $code) {
            if (in_array($code, $granted, true)) {
                return true;
            }
        }

        return false;
    }
}
