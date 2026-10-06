<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guardian extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_primary_contact' => false,
    ];

    protected function casts(): array
    {
        return [
            'monthly_income' => 'decimal:2',
            'is_primary_contact' => 'boolean',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class);
    }
}
