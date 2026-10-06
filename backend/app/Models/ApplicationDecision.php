<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApplicationDecision extends BaseModel
{
    protected function casts(): array
    {
        return [
            'final_score' => 'decimal:4',
            'rank' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(DecisionHistory::class)->orderByDesc('created_at');
    }
}
