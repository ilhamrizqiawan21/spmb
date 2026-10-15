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
        $docs = $m->documents ?? collect();
        $count = fn (string $s) => $docs->where('status', $s)->count();
        $active = $m->relationLoaded('activeAssignment') ? $m->activeAssignment : null;

        $requirements = $m->relationLoaded('admissionPeriod') && $m->admissionPeriod?->relationLoaded('documentRequirements')
            ? $m->admissionPeriod->documentRequirements
            : collect();

        $uploadedDocsByReq = $docs->keyBy('requirement_id');
        $documentsList = collect();

        if ($requirements->isNotEmpty()) {
            foreach ($requirements as $req) {
                $doc = $uploadedDocsByReq->get($req->id);
                $documentsList->push([
                    'requirement_id' => $req->id,
                    'requirement_name' => $req->name,
                    'requirement_code' => $req->code,
                    'is_required' => (bool) $req->is_required,
                    'is_uploaded' => $doc !== null,
                    'document_id' => $doc?->id,
                    'status' => $doc ? $doc->status : 'NOT_UPLOADED',
                    'original_filename' => $doc?->original_filename,
                    'file_size' => $doc?->file_size,
                    'verification_note' => $doc?->verification_note,
                    'uploaded_at' => $doc?->uploaded_at?->toIso8601String(),
                    'verified_at' => $doc?->verified_at?->toIso8601String(),
                ]);
            }
        }

        // Add any uploaded documents that didn't match the period requirements (if any)
        $reqIds = $requirements->pluck('id')->all();
        foreach ($docs as $doc) {
            if (! in_array($doc->requirement_id, $reqIds, true)) {
                $documentsList->push([
                    'requirement_id' => $doc->requirement_id,
                    'requirement_name' => $doc->requirement?->name ?? 'Dokumen Tambahan',
                    'requirement_code' => $doc->requirement?->code ?? null,
                    'is_required' => false,
                    'is_uploaded' => true,
                    'document_id' => $doc->id,
                    'status' => $doc->status,
                    'original_filename' => $doc->original_filename,
                    'file_size' => $doc->file_size,
                    'verification_note' => $doc->verification_note,
                    'uploaded_at' => $doc->uploaded_at?->toIso8601String(),
                    'verified_at' => $doc->verified_at?->toIso8601String(),
                ]);
            }
        }

        $totalRequirements = $requirements->isNotEmpty() ? $requirements->count() : $docs->count();

        return [
            'id' => $m->id,
            'applicant_id' => $m->applicant_id,
            'applicant_name' => $m->applicant?->full_name,
            'period_id' => $m->admission_period_id,
            'period_name' => $m->admissionPeriod?->name,
            'registration_number' => $m->registration_number,
            'status' => $m->status,
            'submitted_at' => $m->submitted_at,
            'assigned_verifier_id' => $active?->verifier_id,
            'assigned_verifier_name' => $active?->verifier?->name,
            'document_counts' => [
                'total' => $totalRequirements,
                'uploaded' => $docs->count(),
                'pending' => $count(DocumentStatus::PENDING),
                'valid' => $count(DocumentStatus::VALID),
                'invalid' => $count(DocumentStatus::INVALID),
                'revision_required' => $count(DocumentStatus::REVISION_REQUIRED),
                'not_uploaded' => max(0, $totalRequirements - $docs->count()),
            ],
            'documents' => $documentsList->values(),
            'completion_percentage' => $m->completion_percentage,
            'created_at' => $m->created_at,
            'updated_at' => $m->updated_at,
        ];
    }
}
