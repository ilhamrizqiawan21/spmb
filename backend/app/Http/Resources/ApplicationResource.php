<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'applicant_id' => $this->resource->applicant_id,
            'applicant_name' => $this->resource->applicant->full_name,
            'admission_period_id' => $this->resource->admission_period_id,
            'period_name' => $this->resource->admissionPeriod->name,
            'registration_number' => $this->resource->registration_number,
            'status' => $this->resource->status,
            'submitted_at' => $this->resource->submitted_at,
            'verified_at' => $this->resource->verified_at,
            'assessed_at' => $this->resource->assessed_at,
            'decided_at' => $this->resource->decided_at,
            'enrolled_at' => $this->resource->enrolled_at,
            'current_step' => $this->resource->current_step,
            'completion_percentage' => $this->resource->completion_percentage,
            'status_histories' => ApplicationStatusHistoryResource::collection($this->resource->statusHistories)->resolve($request),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
