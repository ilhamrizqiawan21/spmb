<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SelectionComponent extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'max_score' => '100.00',
        'sort_order' => 0,
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'weight' => 'decimal:2',
            'max_score' => 'decimal:2',
            'minimum_score' => 'decimal:2',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function admissionPeriod(): BelongsTo
    {
        return $this->belongsTo(AdmissionPeriod::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(AssessmentSchedule::class, 'component_id');
    }

    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class, 'component_id');
    }
}
