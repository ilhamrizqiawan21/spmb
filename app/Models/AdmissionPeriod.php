<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AdmissionPeriod extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'registration_start' => 'datetime',
            'registration_end' => 'datetime',
            'announcement_at' => 'datetime',
            'quota' => 'integer',
            'is_active' => 'boolean',
            'settings' => 'array',
        ];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }
}
