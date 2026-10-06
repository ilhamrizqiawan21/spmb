<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReRegistrationRequirementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'admission_period_id' => $this->resource->admission_period_id,
            'period_name' => $this->resource->admissionPeriod->name,
            'name' => $this->resource->name,
            'code' => $this->resource->code,
            'is_required' => $this->resource->is_required,
            'sort_order' => $this->resource->sort_order,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
