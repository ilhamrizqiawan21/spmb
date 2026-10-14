<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Assessment extends BaseModel
{
    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'weighted_score' => 'decimal:4',
            'assessed_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(SelectionComponent::class, 'component_id');
    }

    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessor_id');
    }
}
