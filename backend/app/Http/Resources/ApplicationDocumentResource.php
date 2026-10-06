<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'application_id' => $this->resource->application_id,
            'requirement_id' => $this->resource->requirement_id,
            'requirement_name' => $this->resource->requirement->name,
            'requirement_code' => $this->resource->requirement->code,
            'storage_key' => $this->resource->storage_key,
            'original_filename' => $this->resource->original_filename,
            'mime_type' => $this->resource->mime_type,
            'file_size' => $this->resource->file_size,
            'checksum' => $this->resource->checksum,
            'status' => $this->resource->status,
            'uploaded_at' => $this->resource->uploaded_at,
            'verified_at' => $this->resource->verified_at,
            'verified_by_id' => $this->resource->verified_by,
            'verified_by_name' => $this->resource->verifiedBy?->name,
            'verification_note' => $this->resource->verification_note,
            'version' => $this->resource->version,
            'revisions' => DocumentRevisionResource::collection($this->resource->revisions)->resolve($request),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
