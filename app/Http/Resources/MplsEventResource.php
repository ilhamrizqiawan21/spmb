<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MplsEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $e = $this->resource;

        return [
            'id' => $e->id,
            'academic_year_id' => $e->academic_year_id,
            'group_id' => $e->group_id,
            'group_name' => $e->relationLoaded('group') ? $e->group?->name : null,
            'title' => $e->title,
            'description' => $e->description,
            'start_at' => $e->start_at,
            'end_at' => $e->end_at,
            'location' => $e->location,
            'is_mandatory' => $e->is_mandatory,
        ];
    }
}
