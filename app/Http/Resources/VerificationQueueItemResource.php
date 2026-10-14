<?php

namespace App\Http\Resources;

use App\Support\DocumentStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VerificationQueueItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $m = $this->resource;
        $docs = $m->documents;
        $count = fn (string $s) => $docs->where('status', $s)->count();
        $active = $m->relationLoaded('activeAssignment') ? $m->activeAssignment : null;

        return [
            'id' => $m->id,
            'applicant_id' => $m->applicant_id,
            'applicant_name' => $m->applicant->full_name,
            'period_id' => $m->admission_period_id,
            'period_name' => $m->admissionPeriod->name,
            'registration_number' => $m->registration_number,
            'status' => $m->status,
            'submitted_at' => $m->submitted_at,
            'assigned_verifier_id' => $active?->verifier_id,
            'assigned_verifier_name' => $active?->verifier?->name,
            'document_counts' => [
                'total' => $docs->count(),
                'pending' => $count(DocumentStatus::PENDING),
                'valid' => $count(DocumentStatus::VALID),
                'invalid' => $count(DocumentStatus::INVALID),
                'revision_required' => $count(DocumentStatus::REVISION_REQUIRED),
            ],
            'completion_percentage' => $m->completion_percentage,
            'created_at' => $m->created_at,
            'updated_at' => $m->updated_at,
        ];
    }
}
