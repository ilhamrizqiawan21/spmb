<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WaitingListEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'registration_number' => $this->resource->application->registration_number,
            'applicant_name' => $this->resource->application->applicant->full_name,
            'position' => $this->resource->position,
            'score' => $this->resource->score,
            'status' => $this->resource->status,
            'promoted_at' => $this->resource->promoted_at,
            'promoted_by_id' => $this->resource->promoted_by,
            'promoted_by_name' => $this->resource->promotedBy?->name,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
