<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\NotificationLog;
use App\Models\SelectionComponent;
use App\Notifications\ApplicationStatusNotification;
use App\Notifications\AssessmentScheduleNotification;
use App\Notifications\ResultAnnouncedNotification;
use App\Services\ApplicationStateMachine;
use App\Support\ApplicationStatus as S;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    private function step(Application $app, string $to): void
    {
        ApplicationStateMachine::transition($this->makeUser('admission_admin'), $app, $to);
    }

    public function test_parent_is_emailed_for_received_revision_and_verified_only(): void
    {
        Notification::fake();
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);

        foreach ([S::SUBMITTED, S::UNDER_VERIFICATION, S::REVISION_REQUIRED, S::RESUBMITTED, S::VERIFIED] as $to) {
            $this->step($app, $to);
        }

        $sent = Notification::sent($parent, ApplicationStatusNotification::class);
        $this->assertSame([S::SUBMITTED, S::REVISION_REQUIRED, S::VERIFIED], $sent->pluck('status')->all());
        Notification::assertCount(3);
    }

    public function test_accounts_without_email_are_skipped_silently(): void
    {
        Notification::fake();
        $phoneOnly = $this->makeUser('parent', ['email' => null, 'phone' => '081200000001']);
        $app = $this->makeApplication($phoneOnly);

        $this->step($app, S::SUBMITTED);

        Notification::assertNothingSent();
        $this->assertSame(S::SUBMITTED, $app->fresh()->status);
    }

    public function test_decision_is_not_emailed_but_the_announcement_is_once_and_without_the_decision(): void
    {
        Notification::fake();
        $parent = $this->makeUser('parent');
        $period = $this->makePeriod();
        $app = $this->makeApplication($parent, $period, 'ASSESSED');
        $principal = $this->makeUser('principal');

        $this->as($principal)->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'ACCEPTED'])->assertOk();
        Notification::assertNothingSent();

        $publish = self::API."/selection/periods/{$period->id}/publish-announcement";
        $this->postJson($publish)->assertOk();
        $this->postJson($publish)->assertOk();

        Notification::assertSentToTimes($parent, ResultAnnouncedNotification::class, 1);
        $mail = (new ResultAnnouncedNotification($app->id, $app->registration_number, 'Budi Santoso'))->toMail($parent)->render();
        $this->assertStringContainsString('Hasil seleksi', $mail);
        $this->assertStringNotContainsStringIgnoringCase('diterima', $mail);
        $this->assertStringNotContainsString('ACCEPTED', $mail);
    }

    public function test_a_future_dated_announcement_sends_nothing_yet(): void
    {
        Notification::fake();
        $period = $this->makePeriod();
        $app = $this->makeApplication($this->makeUser('parent'), $period, 'ASSESSED');
        $principal = $this->makeUser('principal');

        $this->as($principal)->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'REJECTED'])->assertOk();
        $this->postJson(self::API."/selection/periods/{$period->id}/publish-announcement", ['published_at' => now()->addWeek()->toIso8601String()])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_schedule_create_reschedule_and_cancel_are_emailed_but_notes_are_not(): void
    {
        Notification::fake();
        $parent = $this->makeUser('parent');
        $assessor = $this->makeUser('assessor');
        $period = $this->makePeriod();
        $comp = SelectionComponent::create(['admission_period_id' => $period->id, 'name' => 'Wawancara', 'code' => 'W', 'weight' => 100]);
        $app = $this->makeApplication($parent, $period, 'VERIFIED');

        $id = $this->as($assessor)->postJson(self::API.'/selection/schedules', [
            'application_id' => $app->id, 'component_id' => $comp->id, 'scheduled_at' => '2026-12-01T02:00:00Z', 'room' => 'R1',
        ])->assertCreated()->json('id');

        $url = self::API."/selection/schedules/{$id}";
        $this->patchJson($url, ['notes' => 'Bawa KK'])->assertOk();
        $this->patchJson($url, ['scheduled_at' => '2026-12-02T03:30:00Z'])->assertOk();
        $this->patchJson($url, ['status' => 'CANCELLED'])->assertOk();

        $kinds = Notification::sent($parent, AssessmentScheduleNotification::class)->pluck('kind')->all();
        $this->assertSame(['SCHEDULED', 'RESCHEDULED', 'CANCELLED'], $kinds);

        $first = Notification::sent($parent, AssessmentScheduleNotification::class)->first();
        $mail = $first->toMail($parent)->render();
        $this->assertStringContainsString('Selasa, 1 Desember 2026 pukul 09.00 WIB', $mail, 'times are shown in WIB');
        $this->assertStringContainsString('ruang R1', $mail);
    }

    public function test_deliveries_are_logged(): void
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);

        $this->step($app, S::SUBMITTED);

        $log = NotificationLog::sole();
        $this->assertSame($parent->id, $log->user_id);
        $this->assertSame('ApplicationStatusNotification', $log->notification);
        $this->assertSame('mail', $log->channel);
        $this->assertSame('SENT', $log->status);
    }
}
