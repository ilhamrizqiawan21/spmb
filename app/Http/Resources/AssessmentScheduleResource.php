<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssessmentScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'registration_number' => $this->resource->application->registration_number,
            'applicant_name' => $this->resource->application->applicant->full_name,
            'component_id' => $this->resource->component_id,
            'component_name' => $this->resource->component->name,
            'component_code' => $this->resource->component->code,
            'scheduled_at' => $this->resource->scheduled_at,
            'location' => $this->resource->location,
            'room' => $this->resource->room,
            'notes' => $this->resource->notes,
            'status' => $this->resource->status,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
