<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AdmissionPeriod;
use App\Models\DocumentRequirement;
use Illuminate\Database\Eloquent\Collection;

class DocumentRequirementService
{
    public static function list(?string $periodId = null): Collection
    {
        $q = DocumentRequirement::where('is_active', true)->orderBy('sort_order')->orderBy('created_at');
        if ($periodId) {
            $q->where(fn ($w) => $w->where('admission_period_id', $periodId)->orWhereNull('admission_period_id'));
        }

        return $q->get();
    }

    public static function create(array $data): DocumentRequirement
    {
        $periodId = $data['admission_period_id'] ?? null;
        if ($periodId && ! AdmissionPeriod::whereKey($periodId)->exists()) {
            throw ApiException::notFound('Admission period not found.', 'admission_period_id');
        }
        $dup = DocumentRequirement::whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])]);
        $periodId ? $dup->where('admission_period_id', $periodId) : $dup->whereNull('admission_period_id');
        if ($dup->exists()) {
            throw ApiException::validation(['code' => "Document requirement '{$data['code']}' already exists for this period."]);
        }

        return DocumentRequirement::create($data + ['allowed_mime_types' => []]);
    }

    public static function update(DocumentRequirement $req, array $data): DocumentRequirement
    {
        if (isset($data['code']) && $data['code'] !== $req->code) {
            $dup = DocumentRequirement::whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])->where('id', '!=', $req->id);
            $req->admission_period_id ? $dup->where('admission_period_id', $req->admission_period_id) : $dup->whereNull('admission_period_id');
            if ($dup->exists()) {
                throw ApiException::validation(['code' => "Document requirement '{$data['code']}' already exists."]);
            }
        }
        $req->update($data);

        return $req;
    }

    public static function delete(DocumentRequirement $req): void
    {
        if ($req->applicationDocuments()->exists()) {
            $req->update(['is_active' => false]);
        } else {
            $req->delete();
        }
    }
}
