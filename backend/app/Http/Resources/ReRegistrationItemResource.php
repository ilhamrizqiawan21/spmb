<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReRegistrationItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            're_registration_id' => $this->resource->re_registration_id,
            'requirement_id' => $this->resource->requirement_id,
            'requirement_name' => $this->resource->requirement->name,
            'requirement_code' => $this->resource->requirement->code,
            'is_required' => $this->resource->requirement->is_required,
            'status' => $this->resource->status,
            'notes' => $this->resource->notes,
            'completed_at' => $this->resource->completed_at,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
