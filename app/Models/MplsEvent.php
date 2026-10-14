<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MplsEvent extends BaseModel
{
    protected function casts(): array
    {
        return ['start_at' => 'datetime', 'end_at' => 'datetime', 'is_mandatory' => 'boolean'];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(MplsGroup::class, 'group_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(MplsAttendance::class, 'event_id');
    }

    /** Whether this event applies to a participant of the given group. */
    public function appliesToGroup(string $groupId): bool
    {
        return $this->group_id === null || $this->group_id === $groupId;
    }
}
