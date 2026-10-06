<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DecisionHistory extends BaseModel
{
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
