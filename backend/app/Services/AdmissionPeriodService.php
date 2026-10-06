<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AcademicYear;
use App\Models\AdmissionPeriod;

class AdmissionPeriodService
{
    public static function create(array $data): AdmissionPeriod
    {
        $year = AcademicYear::find($data['academic_year_id']);
        if (! $year) {
            throw ApiException::notFound('Referenced academic year does not exist.', 'academic_year_id');
        }
        if (AdmissionPeriod::where('academic_year_id', $year->id)
            ->whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])->exists()) {
            throw ApiException::validation(['code' => 'Admission period code already exists in this academic year.']);
        }

        $period = AdmissionPeriod::create($data);
        AuditService::master('created', $period);

        return $period;
    }

    public static function update(AdmissionPeriod $period, array $data): AdmissionPeriod
    {
        if (isset($data['code']) && $data['code'] !== $period->code
            && AdmissionPeriod::where('academic_year_id', $period->academic_year_id)
                ->whereRaw('LOWER(code) = ?', [mb_strtolower($data['code'])])
                ->where('id', '!=', $period->id)->exists()) {
            throw ApiException::validation(['code' => 'Admission period code already exists in this academic year.']);
        }
        $before = $period->getAttributes();
        $period->update($data);
        AuditService::master('updated', $period, $before);

        return $period;
    }
}
