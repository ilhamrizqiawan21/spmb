<?php

namespace App\Http\Resources;

use App\Support\Privacy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GuardianResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $full = Privacy::canSeeIdentity($request->user(), $this->resource->applicant->owner_user_id);

        return [
            'id' => $this->resource->id,
            'applicant_id' => $this->resource->applicant_id,
            'relationship' => $this->resource->relationship,
            'full_name' => $this->resource->full_name,
            'nik' => $full ? $this->resource->nik : Privacy::mask($this->resource->nik),
            'phone' => $this->resource->phone,
            'email' => $this->resource->email,
            'occupation' => $this->resource->occupation,
            'education' => $this->resource->education,
            'monthly_income' => $this->resource->monthly_income,
            'address' => $this->resource->address,
            'is_primary_contact' => $this->resource->is_primary_contact,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
