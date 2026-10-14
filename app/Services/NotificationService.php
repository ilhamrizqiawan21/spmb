<?php

namespace App\Services;

use App\Models\AdmissionPeriod;
use App\Models\Application;
use App\Models\AssessmentSchedule;
use App\Models\User;
use App\Notifications\ApplicationStatusNotification;
use App\Notifications\AssessmentScheduleNotification;
use App\Notifications\ResultAnnouncedNotification;
use App\Support\ScheduleStatus;

/**
 * Single entry point for business events that should reach the applicant's parent by email.
 * Business code calls these intents; channels, queueing and templates live in the notification classes.
 */
class NotificationService
{
    /** The account that owns the application, if it can receive email. */
    private static function recipient(Application $application): ?User
    {
        $application->loadMissing('applicant');
        $owner = $application->applicant?->owner_user_id ? User::find($application->applicant->owner_user_id) : null;

        return $owner && $owner->is_active && filled($owner->email) ? $owner : null;
    }

    public static function applicationStatusChanged(Application $application, string $to): void
    {
        if (! in_array($to, ApplicationStatusNotification::NOTIFIED, true) || ! ($user = self::recipient($application))) {
            return;
        }

        $user->notify(new ApplicationStatusNotification(
            $application->id, $application->registration_number, $application->applicant->full_name, $to,
        ));
    }

    /** @param  string  $kind  one of the AssessmentScheduleNotification kinds */
    public static function assessmentSchedule(AssessmentSchedule $schedule, string $kind): void
    {
        $schedule->loadMissing(['application.applicant', 'component']);
        if (! ($user = self::recipient($schedule->application))) {
            return;
        }

        $user->notify(new AssessmentScheduleNotification(
            $schedule->application_id, $schedule->application->applicant->full_name, $schedule->component->name,
            $schedule->scheduled_at, $schedule->location, $schedule->room, $schedule->notes, $kind,
        ));
    }

    /** One email per application that has a decision in this period; never contains the decision. */
    public static function resultsAnnounced(AdmissionPeriod $period): int
    {
        $sent = 0;
        Application::where('admission_period_id', $period->id)->whereHas('decision')->with('applicant')
            ->each(function (Application $application) use (&$sent) {
                if ($user = self::recipient($application)) {
                    $user->notify(new ResultAnnouncedNotification(
                        $application->id, $application->registration_number, $application->applicant->full_name,
                    ));
                    $sent++;
                }
            });

        return $sent;
    }

    /** Which schedule change deserves an email: new time/cancellation yes, notes-only edits no. */
    public static function scheduleChangeKind(AssessmentSchedule $schedule): ?string
    {
        if ($schedule->wasChanged('status')) {
            return $schedule->status === ScheduleStatus::CANCELLED ? AssessmentScheduleNotification::CANCELLED : null;
        }

        return $schedule->status === ScheduleStatus::SCHEDULED && $schedule->wasChanged(['scheduled_at', 'location', 'room'])
            ? AssessmentScheduleNotification::RESCHEDULED
            : null;
    }
}
