<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationStatusHistory extends BaseModel
{
    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
