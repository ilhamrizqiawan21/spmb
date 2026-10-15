<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** The QR token is only included when the caller explicitly asks for it (portal card, rotation). */
class MplsParticipantResource extends JsonResource
{
    private bool $withToken = false;

    public function withToken(): static
    {
        $this->withToken = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $p = $this->resource;

        return [
            'id' => $p->id,
            'student_id' => $p->student_id,
            'student_number' => $p->student->student_number,
            'full_name' => $p->student->full_name,
            'group_id' => $p->group_id,
            'group_name' => $p->group->name,
            'group_code' => $p->group->code,
            'mentor_name' => $p->group->mentor_name,
            'status' => $p->status,
            'joined_at' => $p->joined_at,
            'completed_at' => $p->completed_at,
            'attendance' => [
                'present' => (int) ($p->present_count ?? 0),
                'sick' => (int) ($p->sick_count ?? 0),
                'permitted' => (int) ($p->permitted_count ?? 0),
                'absent' => (int) ($p->absent_count ?? 0),
            ],
            $this->mergeWhen($this->withToken, fn () => ['qr_token' => $p->qr_token]),
        ];
    }
}
