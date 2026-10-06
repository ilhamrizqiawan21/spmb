<?php

namespace App\Http\Resources;

use App\Support\Masking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $full = Masking::canSeeFull($request->user(), $this->resource->owner_user_id);

        return [
            'id' => $this->resource->id,
            'owner_user_id' => $this->resource->owner_user_id,
            'nisn' => $this->resource->nisn,
            'full_name' => $this->resource->full_name,
            'nickname' => $this->resource->nickname,
            'gender' => $this->resource->gender,
            'birth_place' => $this->resource->birth_place,
            'birth_date' => $this->resource->birth_date?->format('Y-m-d'),
            'religion' => $this->resource->religion,
            'nationality' => $this->resource->nationality,
            'nik' => $full ? $this->resource->nik : Masking::value($this->resource->nik),
            'family_card_number' => $full ? $this->resource->family_card_number : Masking::value($this->resource->family_card_number),
            'address' => $this->resource->address,
            'province' => $this->resource->province,
            'city' => $this->resource->city,
            'district' => $this->resource->district,
            'village' => $this->resource->village,
            'postal_code' => $this->resource->postal_code,
            'previous_school_name' => $this->resource->previous_school_name,
            'previous_school_npsn' => $this->resource->previous_school_npsn,
            'previous_school_address' => $this->resource->previous_school_address,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
