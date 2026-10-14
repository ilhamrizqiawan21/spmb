<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Student extends BaseModel
{
    protected function casts(): array
    {
        return ['birth_date' => 'date'];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }
}
