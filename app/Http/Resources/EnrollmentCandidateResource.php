<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** An application that finished re-registration and waits for staff to enroll it. */
class EnrollmentCandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'application_id' => $a->id,
            'registration_number' => $a->registration_number,
            'applicant_name' => $a->applicant->full_name,
            'nisn' => $a->applicant->nisn,
            'admission_period_name' => $a->admissionPeriod?->name,
            'status' => $a->status,
        ];
    }
}
