<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AcademicYear;
use Illuminate\Support\Facades\DB;

class AcademicYearService
{
    public static function create(array $data): AcademicYear
    {
        return DB::transaction(function () use ($data) {
            if (AcademicYear::whereRaw('LOWER(name) = ?', [mb_strtolower($data['name'])])->exists()) {
                throw ApiException::validation(['name' => 'Academic year with this name already exists.']);
            }
            if (! empty($data['is_active'])) {
                AcademicYear::where('is_active', true)->update(['is_active' => false]);
            }

            return AcademicYear::create($data);
        });
    }

    public static function update(AcademicYear $year, array $data): AcademicYear
    {
        return DB::transaction(function () use ($year, $data) {
            if (isset($data['name']) && $data['name'] !== $year->name
                && AcademicYear::whereRaw('LOWER(name) = ?', [mb_strtolower($data['name'])])
                    ->where('id', '!=', $year->id)->exists()) {
                throw ApiException::validation(['name' => 'Academic year with this name already exists.']);
            }
            if (($data['is_active'] ?? null) === true) {
                AcademicYear::where('is_active', true)->where('id', '!=', $year->id)->update(['is_active' => false]);
            }
            $year->update($data);

            return $year;
        });
    }

    public static function delete(AcademicYear $year): void
    {
        if ($year->admissionPeriods()->exists()) {
            throw ApiException::validation(['detail' => 'Cannot delete academic year with existing admission periods.']);
        }
        $year->delete();
    }
}
