<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MplsGroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $g = $this->resource;

        return [
            'id' => $g->id,
            'academic_year_id' => $g->academic_year_id,
            'academic_year_name' => $g->academicYear?->name,
            'name' => $g->name,
            'code' => $g->code,
            'capacity' => $g->capacity,
            'participant_count' => (int) ($g->participants_count ?? 0),
            'mentor_name' => $g->mentor_name,
            'description' => $g->description,
            'created_at' => $g->created_at,
        ];
    }
}
