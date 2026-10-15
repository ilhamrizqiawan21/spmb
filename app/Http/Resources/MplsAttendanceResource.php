<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MplsAttendanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->id,
            'event_id' => $a->event_id,
            'participant_id' => $a->participant_id,
            'full_name' => $a->relationLoaded('participant') ? $a->participant->student->full_name : null,
            'status' => $a->status,
            'checked_at' => $a->checked_at,
            'checked_by_name' => $a->relationLoaded('checkedBy') ? $a->checkedBy?->name : null,
            'notes' => $a->notes,
        ];
    }
}
