<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $p = $this->resource;
        $invoice = $p->relationLoaded('invoice') ? $p->invoice : null;
        $applicant = $invoice?->relationLoaded('application') ? $invoice->application?->applicant : null;

        return [
            'id' => $p->id,
            'invoice_id' => $p->invoice_id,
            'invoice_number' => $invoice?->invoice_number,
            'application_id' => $invoice?->application_id,
            'registration_number' => $invoice?->application?->registration_number,
            'applicant_name' => $applicant?->full_name,
            'amount' => (string) $p->amount,
            'method' => $p->method,
            'reference_number' => $p->reference_number,
            'status' => $p->status,
            'paid_at' => $p->paid_at,
            'has_proof' => $p->proof_storage_key !== null,
            'proof_filename' => $p->proof_original_filename,
            'proof_mime_type' => $p->proof_mime_type,
            'proof_file_size' => $p->proof_file_size,
            'verified_at' => $p->verified_at,
            'verified_by_name' => $p->verifiedBy?->name,
            'verification_note' => $p->verification_note,
            'histories' => $p->relationLoaded('histories')
                ? $p->histories->map(fn ($h) => [
                    'from_status' => $h->from_status, 'to_status' => $h->to_status, 'notes' => $h->notes, 'created_at' => $h->created_at,
                ])->all()
                : [],
            'created_at' => $p->created_at,
        ];
    }
}
