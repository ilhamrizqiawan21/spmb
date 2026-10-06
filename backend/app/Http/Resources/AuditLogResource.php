<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'user_id' => $this->resource->user_id,
            'user_name' => $this->resource->user?->name,
            'action' => $this->resource->action,
            'resource_type' => $this->resource->resource_type,
            'resource_id' => $this->resource->resource_id,
            'old_values' => $this->resource->old_values,
            'new_values' => $this->resource->new_values,
            'ip_address' => $this->resource->ip_address,
            'created_at' => $this->resource->created_at,
        ];
    }
}
