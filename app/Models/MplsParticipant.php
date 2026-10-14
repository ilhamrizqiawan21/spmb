<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MplsParticipant extends BaseModel
{
    protected $hidden = ['qr_token'];

    protected function casts(): array
    {
        return ['joined_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(MplsGroup::class, 'group_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(MplsAttendance::class, 'participant_id');
    }
}
