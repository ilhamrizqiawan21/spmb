<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentSchedule extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'status' => 'SCHEDULED',
    ];

    protected function casts(): array
    {
        return ['scheduled_at' => 'datetime'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(SelectionComponent::class, 'component_id');
    }
}
