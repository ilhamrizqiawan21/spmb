<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationStatusHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'from_status' => $this->resource->from_status,
            'to_status' => $this->resource->to_status,
            'changed_by_id' => $this->resource->changed_by,
            'changed_by_name' => $this->resource->changedBy?->name,
            'reason' => $this->resource->reason,
            'metadata' => $this->resource->metadata ?: new \stdClass,
            'created_at' => $this->resource->created_at,
        ];
    }
}
