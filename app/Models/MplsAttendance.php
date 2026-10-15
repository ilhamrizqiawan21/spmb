<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MplsAttendance extends BaseModel
{
    protected function casts(): array
    {
        return ['checked_at' => 'datetime'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(MplsEvent::class, 'event_id');
    }

    public function participant(): BelongsTo
    {
        return $this->belongsTo(MplsParticipant::class, 'participant_id');
    }

    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
