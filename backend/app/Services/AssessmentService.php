<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\ApplicationScore;
use App\Models\Assessment;
use App\Models\AssessmentSchedule;
use App\Models\SelectionComponent;
use App\Models\User;
use App\Support\ApplicationStatus;
use App\Support\ScheduleStatus;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

class AssessmentService
{
    public const INPUT_PERMS = ['assessment.input', 'assessment.approve', 'application.override'];

    public static function createSchedule(User $user, array $data): AssessmentSchedule
    {
        return DB::transaction(function () use ($user, $data) {
            $application = Application::with('admissionPeriod')->find($data['application_id'])
                ?? throw ApiException::notFound('Application not found.', 'application_id');
            $component = SelectionComponent::where('admission_period_id', $application->admission_period_id)
                ->where('is_active', true)->find($data['component_id'])
                ?? throw ApiException::notFound('Selection component not found for this period.', 'component_id');

            $schedule = AssessmentSchedule::create([
                'application_id' => $application->id,
                'component_id' => $component->id,
                'scheduled_at' => $data['scheduled_at'],
                'location' => $data['location'] ?? null,
                'room' => $data['room'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => ScheduleStatus::SCHEDULED,
            ]);

            if ($application->status === ApplicationStatus::VERIFIED) {
                ApplicationStateMachine::transition(
                    $user, $application, ApplicationStatus::ASSESSMENT_SCHEDULED,
                    "Assessment scheduled for component '{$component->name}'."
                );
            }

            return $schedule->load(['application.applicant', 'component']);
        });
    }

    public static function calculateScore(Application $application): ApplicationScore
    {
        $assessments = Assessment::where('application_id', $application->id)->get();
        $zero = BigDecimal::of('0.0000');
        $raw = $assessments->reduce(fn (BigDecimal $c, $a) => $c->plus($a->score), $zero);
        $final = $assessments->reduce(fn (BigDecimal $c, $a) => $c->plus($a->weighted_score ?? '0'), $zero);

        return ApplicationScore::updateOrCreate(
            ['application_id' => $application->id],
            ['raw_score' => (string) $raw->toScale(4), 'final_score' => (string) $final->toScale(4), 'calculated_at' => now()],
        );
    }

    public static function inputScore(User $user, string $applicationId, string $componentId, string $score, ?string $notes): Assessment
    {
        if (! $user->hasAnyPermCodes(self::INPUT_PERMS)) {
            throw ApiException::forbidden('You do not have permission to input assessment scores.');
        }

        return DB::transaction(function () use ($user, $applicationId, $componentId, $score, $notes) {
            $application = Application::with('admissionPeriod')->find($applicationId)
                ?? throw ApiException::notFound('Application not found.');
            $component = SelectionComponent::where('admission_period_id', $application->admission_period_id)
                ->where('is_active', true)->find($componentId)
                ?? throw ApiException::notFound('Selection component not found for this period.');

            $value = BigDecimal::of($score);
            $max = BigDecimal::of($component->max_score);
            if ($value->isNegative() || $value->isGreaterThan($max)) {
                throw ApiException::validation(['score' => "Score must be between 0 and {$component->max_score}."]);
            }

            // weighted = (score / max_score) * weight
            $weighted = $value->dividedBy($max, 12, RoundingMode::HalfEven)
                ->multipliedBy($component->weight)->toScale(4, RoundingMode::HalfEven);

            $assessment = Assessment::updateOrCreate(
                ['application_id' => $application->id, 'component_id' => $component->id],
                [
                    'assessor_id' => $user->id,
                    'score' => (string) $value->toScale(2, RoundingMode::HalfEven),
                    'weighted_score' => (string) $weighted,
                    'notes' => $notes,
                    'assessed_at' => now(),
                ],
            );

            AssessmentSchedule::where('application_id', $application->id)->where('component_id', $component->id)
                ->update(['status' => ScheduleStatus::COMPLETED]);

            self::calculateScore($application);

            $assessed = Assessment::where('application_id', $application->id)->pluck('component_id')->all();
            $allAssessed = SelectionComponent::where('admission_period_id', $application->admission_period_id)
                ->where('is_active', true)->pluck('id')->every(fn ($id) => in_array($id, $assessed, true));

            if ($allAssessed && in_array($application->status, [ApplicationStatus::VERIFIED, ApplicationStatus::ASSESSMENT_SCHEDULED], true)) {
                ApplicationStateMachine::transition($user, $application, ApplicationStatus::ASSESSED, 'All assessment components completed.');
            }

            return $assessment->load(['component', 'assessor']);
        });
    }

    /** Rank by final_score DESC, submitted_at ASC, registration_number ASC. */
    public static function rankPeriod(string $periodId)
    {
        return DB::transaction(function () use ($periodId) {
            $scores = ApplicationScore::with('application.applicant')
                ->whereHas('application', fn ($q) => $q->where('admission_period_id', $periodId))
                ->get()
                ->sort(function ($a, $b) {
                    return [$b->final_score, $a->application->submitted_at?->timestamp ?? PHP_INT_MAX, $a->application->registration_number]
                        <=> [$a->final_score, $b->application->submitted_at?->timestamp ?? PHP_INT_MAX, $b->application->registration_number];
                })->values();

            foreach ($scores as $i => $score) {
                $score->update(['rank' => $i + 1, 'calculated_at' => now()]);
            }

            return $scores;
        });
    }
}
