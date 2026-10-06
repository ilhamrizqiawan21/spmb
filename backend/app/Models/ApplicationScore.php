<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationScore extends BaseModel
{
    protected function casts(): array
    {
        return [
            'raw_score' => 'decimal:4',
            'final_score' => 'decimal:4',
            'rank' => 'integer',
            'calculated_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
