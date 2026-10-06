<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaitingListEntry extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'status' => 'WAITING',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'score' => 'decimal:4',
            'promoted_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function promotedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'promoted_by');
    }
}
