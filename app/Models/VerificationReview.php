<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VerificationReview extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'status' => 'PENDING',
    ];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verifier_id');
    }
}
