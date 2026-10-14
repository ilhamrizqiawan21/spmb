<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VerificationAssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'registration_number' => $this->resource->application->registration_number,
            'applicant_name' => $this->resource->application->applicant->full_name,
            'verifier_id' => $this->resource->verifier_id,
            'verifier_name' => $this->resource->verifier->name,
            'assigned_by_id' => $this->resource->assigned_by,
            'assigned_by_name' => $this->resource->assignedBy?->name,
            'assigned_at' => $this->resource->assigned_at,
            'completed_at' => $this->resource->completed_at,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
