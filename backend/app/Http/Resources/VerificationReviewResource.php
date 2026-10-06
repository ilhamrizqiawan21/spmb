<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VerificationReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'verifier_id' => $this->resource->verifier_id,
            'verifier_name' => $this->resource->verifier->name,
            'status' => $this->resource->status,
            'notes' => $this->resource->notes,
            'started_at' => $this->resource->started_at,
            'completed_at' => $this->resource->completed_at,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
