<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MplsGroup extends BaseModel
{
    protected function casts(): array
    {
        return ['capacity' => 'integer'];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(MplsParticipant::class, 'group_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(MplsEvent::class, 'group_id');
    }
}
