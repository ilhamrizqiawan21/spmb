<?php

namespace App\Models;

class Role extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_system' => false,
    ];

    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }
}
