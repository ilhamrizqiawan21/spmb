<?php

namespace App\Http\Resources;

use App\Models\Assessment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationScoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'registration_number' => $this->resource->application->registration_number,
            'applicant_name' => $this->resource->application->applicant->full_name,
            'raw_score' => $this->resource->raw_score,
            'final_score' => $this->resource->final_score,
            'rank' => $this->resource->rank,
            'calculated_at' => $this->resource->calculated_at,
            'assessments' => AssessmentResource::collection(Assessment::with(['component', 'assessor'])->where('application_id', $this->resource->application_id)->get())->resolve($request),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
