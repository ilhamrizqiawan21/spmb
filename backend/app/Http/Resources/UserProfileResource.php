<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'is_active' => $this->resource->is_active,
            'roles' => $this->resource->roles()->orderBy('code')->pluck('code')->all(),
            'permissions' => collect($this->resource->permissionCodes())->sort()->values()->all(),
        ];
    }
}
