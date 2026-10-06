<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationDecisionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'registration_number' => $this->resource->application->registration_number,
            'applicant_name' => $this->resource->application->applicant->full_name,
            'decision' => $this->resource->decision,
            'final_score' => $this->resource->final_score,
            'rank' => $this->resource->rank,
            'decided_by_id' => $this->resource->decided_by,
            'decided_by_name' => $this->resource->decidedBy->name,
            'reason' => $this->resource->reason,
            'published_at' => $this->resource->published_at,
            'histories' => DecisionHistoryResource::collection($this->resource->histories)->resolve($request),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
