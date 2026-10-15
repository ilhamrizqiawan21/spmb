<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $s = $this->resource;
        $enrollment = $s->enrollment;
        $application = $enrollment->application;

        return [
            'id' => $s->id,
            'student_number' => $s->student_number,
            'nisn' => $s->nisn,
            'full_name' => $s->full_name,
            'gender' => $s->gender,
            'birth_place' => $s->birth_place,
            'birth_date' => $s->birth_date?->toDateString(),
            'status' => $s->status,
            'enrollment' => [
                'id' => $enrollment->id,
                'status' => $enrollment->status,
                'enrolled_at' => $enrollment->enrolled_at,
                'enrolled_by_name' => $enrollment->enrolledBy?->name,
                'notes' => $enrollment->notes,
            ],
            'application_id' => $application->id,
            'registration_number' => $application->registration_number,
            'admission_period_name' => $application->admissionPeriod?->name,
            'academic_year_name' => $application->admissionPeriod?->academicYear?->name,
            'created_at' => $s->created_at,
        ];
    }
}
