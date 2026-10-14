<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Application extends BaseModel
{
    /** Mirrors column defaults so freshly created models serialize fully. */
    protected $attributes = [
        'status' => 'DRAFT',
        'current_step' => 1,
        'completion_percentage' => 0,
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'verified_at' => 'datetime',
            'assessed_at' => 'datetime',
            'decided_at' => 'datetime',
            'enrolled_at' => 'datetime',
            'current_step' => 'integer',
            'completion_percentage' => 'integer',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class);
    }

    public function admissionPeriod(): BelongsTo
    {
        return $this->belongsTo(AdmissionPeriod::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(ApplicationStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ApplicationDocument::class);
    }

    public function scoreSummary(): HasOne
    {
        return $this->hasOne(ApplicationScore::class);
    }

    public function decision(): HasOne
    {
        return $this->hasOne(ApplicationDecision::class);
    }

    public function waitingListEntry(): HasOne
    {
        return $this->hasOne(WaitingListEntry::class);
    }

    public function reRegistration(): HasOne
    {
        return $this->hasOne(ReRegistration::class);
    }
}
