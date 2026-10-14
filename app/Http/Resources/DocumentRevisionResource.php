<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentRevisionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_document_id' => $this->resource->application_document_id,
            'requested_by_id' => $this->resource->requested_by,
            'requested_by_name' => $this->resource->requestedBy->name,
            'reason' => $this->resource->reason,
            'resolved_at' => $this->resource->resolved_at,
            'created_at' => $this->resource->created_at,
        ];
    }
}
