<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReRegistrationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'registration_number' => $this->resource->application->registration_number,
            'applicant_name' => $this->resource->application->applicant->full_name,
            'status' => $this->resource->status,
            'confirmed_at' => $this->resource->confirmed_at,
            'completed_at' => $this->resource->completed_at,
            'notes' => $this->resource->notes,
            'items' => ReRegistrationItemResource::collection($this->resource->items->sortBy(fn ($i) => $i->requirement->sort_order)->values())->resolve($request),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
