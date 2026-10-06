<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReRegistrationRequirement extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'is_required' => true,
        'sort_order' => 0,
    ];

    protected $table = 're_registration_requirements';

    protected function casts(): array
    {
        return ['is_required' => 'boolean', 'sort_order' => 'integer'];
    }

    public function admissionPeriod(): BelongsTo
    {
        return $this->belongsTo(AdmissionPeriod::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReRegistrationItem::class, 'requirement_id');
    }
}
