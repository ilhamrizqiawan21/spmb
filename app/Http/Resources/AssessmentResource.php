<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssessmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'component_id' => $this->resource->component_id,
            'component_name' => $this->resource->component->name,
            'component_code' => $this->resource->component->code,
            'assessor_id' => $this->resource->assessor_id,
            'assessor_name' => $this->resource->assessor->name,
            'score' => $this->resource->score,
            'weighted_score' => $this->resource->weighted_score,
            'notes' => $this->resource->notes,
            'assessed_at' => $this->resource->assessed_at,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
