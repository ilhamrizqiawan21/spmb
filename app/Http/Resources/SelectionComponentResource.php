<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SelectionComponentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'admission_period_id' => $this->resource->admission_period_id,
            'period_name' => $this->resource->admissionPeriod->name,
            'name' => $this->resource->name,
            'code' => $this->resource->code,
            'description' => $this->resource->description,
            'weight' => $this->resource->weight,
            'max_score' => $this->resource->max_score,
            'minimum_score' => $this->resource->minimum_score,
            'sort_order' => $this->resource->sort_order,
            'is_active' => $this->resource->is_active,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
