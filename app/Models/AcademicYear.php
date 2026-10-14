<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicYear extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_active' => false,
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'is_active' => 'boolean',
        ];
    }

    public function admissionPeriods(): HasMany
    {
        return $this->hasMany(AdmissionPeriod::class);
    }
}
