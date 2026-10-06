<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AdmissionPeriod;
use App\Support\AvailabilityStatus;
use Carbon\CarbonInterface;

class RegistrationAvailabilityService
{
    /** @return array{0:string,1:bool,2:?string} status, is_open, reason */
    public static function evaluate(AdmissionPeriod $period, ?CarbonInterface $now = null): array
    {
        $now ??= now();
        $year = $period->academicYear;

        if ($year && ! $year->is_active) {
            return [AvailabilityStatus::ACADEMIC_YEAR_INACTIVE, false, 'The associated academic year is inactive.'];
        }
        if (! $period->is_active) {
            return [AvailabilityStatus::PERIOD_INACTIVE, false, 'The admission period is currently inactive.'];
        }
        if ($now->lt($period->registration_start)) {
            return [AvailabilityStatus::BEFORE_OPENING, false,
                'Registration has not opened yet. It will open at '.$period->registration_start->toIso8601String().'.'];
        }
        if ($now->gt($period->registration_end)) {
            return [AvailabilityStatus::CLOSED, false,
                'Registration closed at '.$period->registration_end->toIso8601String().'.'];
        }

        return [AvailabilityStatus::OPEN, true, null];
    }

    public static function forPeriod(string $periodId): array
    {
        $period = AdmissionPeriod::with('academicYear')->find($periodId)
            ?? throw ApiException::notFound('Admission period not found.');
        $now = now();
        [$status, $isOpen, $reason] = self::evaluate($period, $now);

        return [
            'period_id' => $period->id,
            'status' => $status,
            'is_open' => $isOpen,
            'can_create_draft' => $isOpen,
            'can_submit' => $isOpen,
            'registration_start' => $period->registration_start,
            'registration_end' => $period->registration_end,
            'server_time' => $now,
            'quota' => $period->quota,
            'reason' => $reason,
        ];
    }

    public static function assertCanCreateDraft(AdmissionPeriod $period): void
    {
        [, $isOpen, $reason] = self::evaluate($period);
        if (! $isOpen) {
            throw ApiException::forbidden('Cannot start draft: '.($reason ?: 'Registration unavailable.'));
        }
    }

    public static function assertCanSubmit(AdmissionPeriod $period): void
    {
        [, $isOpen, $reason] = self::evaluate($period);
        if (! $isOpen) {
            throw ApiException::forbidden('Cannot submit application: '.($reason ?: 'Registration unavailable.'));
        }
    }
}
