<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReRegistrationItem extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'status' => 'PENDING',
    ];

    protected $table = 're_registration_items';

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function reRegistration(): BelongsTo
    {
        return $this->belongsTo(ReRegistration::class, 're_registration_id');
    }

    public function requirement(): BelongsTo
    {
        return $this->belongsTo(ReRegistrationRequirement::class, 'requirement_id');
    }
}
