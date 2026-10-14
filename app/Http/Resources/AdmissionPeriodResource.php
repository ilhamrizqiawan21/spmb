<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdmissionPeriodResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'academic_year_id' => $this->resource->academic_year_id,
            'name' => $this->resource->name,
            'code' => $this->resource->code,
            'registration_start' => $this->resource->registration_start,
            'registration_end' => $this->resource->registration_end,
            'announcement_at' => $this->resource->announcement_at,
            'quota' => $this->resource->quota,
            'is_active' => $this->resource->is_active,
            'settings' => $this->resource->settings ?? new \stdClass,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
