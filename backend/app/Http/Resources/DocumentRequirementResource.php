<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentRequirementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'admission_period_id' => $this->resource->admission_period_id,
            'name' => $this->resource->name,
            'code' => $this->resource->code,
            'description' => $this->resource->description,
            'is_required' => $this->resource->is_required,
            'allowed_mime_types' => $this->resource->allowed_mime_types,
            'max_file_size_bytes' => $this->resource->max_file_size_bytes,
            'is_active' => $this->resource->is_active,
            'sort_order' => $this->resource->sort_order,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
