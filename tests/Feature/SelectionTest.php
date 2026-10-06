<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\AssessmentSchedule;
use App\Models\SelectionComponent;
use App\Models\WaitingListEntry;
use Tests\TestCase;

class SelectionTest extends TestCase
{
    private function makeComponent(string $periodId, string $code, string $weight, string $max = '100.00'): SelectionComponent
    {
        return SelectionComponent::create(['admission_period_id' => $periodId, 'name' => $code, 'code' => $code, 'weight' => $weight, 'max_score' => $max]);
    }

    public function test_component_weight_cannot_exceed_100(): void
    {
        $admin = $this->makeUser('admission_admin');
        $period = $this->makePeriod();
        $base = ['admission_period_id' => $period->id, 'name' => 'Tes', 'code' => 'TES', 'weight' => '60'];

        $this->as($this->makeUser('assessor'))->postJson(self::API.'/selection/components', $base)->assertForbidden();
        $id = $this->as($admin)->postJson(self::API.'/selection/components', $base)->assertCreated()
            ->assertJsonPath('weight', '60.00')->assertJsonPath('max_score', '100.00')->json('id');

        $this->postJson(self::API.'/selection/components', ['code' => 'TES'] + $base)->assertStatus(400);
        $this->postJson(self::API.'/selection/components', ['code' => 'WWW', 'weight' => '50'] + $base)->assertStatus(400)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->assertSame(1, SelectionComponent::count()); // rolled back
        $this->postJson(self::API.'/selection/components', ['code' => 'BAD', 'weight' => '101'] + $base)->assertStatus(400);

        $this->postJson(self::API.'/selection/components', ['code' => 'WWC', 'weight' => '40'] + $base)->assertCreated();
        $this->patchJson(self::API."/selection/components/{$id}", ['weight' => '70'])->assertStatus(400);
        $this->app['auth']->forgetGuards();
        $this->getJson(self::API."/selection/components?admission_period_id={$period->id}")->assertOk()->assertJsonCount(2);
    }

    public function test_scoring_ranking_and_automatic_assessed_transition(): void
    {
        $assessor = $this->makeUser('assessor');
        $principal = $this->makeUser('principal');
        $period = $this->makePeriod();
        $written = $this->makeComponent($period->id, 'WRITTEN', '60.00', '100.00');
        $interview = $this->makeComponent($period->id, 'INTERVIEW', '40.00', '50.00');

        $a1 = $this->makeApplication($this->makeUser('parent'), $period, 'VERIFIED');
        $a2 = $this->makeApplication($this->makeUser('parent'), $period, 'VERIFIED');

        $this->as($this->makeUser('parent'))->postJson(self::API.'/selection/assessments/input', [])->assertForbidden();
        $this->as($assessor);

        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $a1->id, 'component_id' => $written->id, 'score' => '120'])->assertStatus(400);

        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $a1->id, 'component_id' => $written->id, 'score' => '80'])
            ->assertOk()->assertJsonPath('weighted_score', '48.0000')->assertJsonPath('score', '80.00');
        $this->assertSame('VERIFIED', $a1->fresh()->status);
        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $a1->id, 'component_id' => $interview->id, 'score' => '45'])
            ->assertOk()->assertJsonPath('weighted_score', '36.0000');
        $this->assertSame('ASSESSED', $a1->fresh()->status);

        // re-input updates rather than duplicates
        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $a1->id, 'component_id' => $written->id, 'score' => '90'])->assertOk();
        $this->assertSame(2, Assessment::where('application_id', $a1->id)->count());

        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $a2->id, 'component_id' => $written->id, 'score' => '50'])->assertOk();
        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $a2->id, 'component_id' => $interview->id, 'score' => '50'])->assertOk();

        $this->as($principal)->postJson(self::API."/selection/periods/{$period->id}/ranking")->assertOk()
            ->assertJsonPath('0.application_id', $a1->id)->assertJsonPath('0.rank', 1)->assertJsonPath('0.final_score', '90.0000')
            ->assertJsonPath('1.rank', 2)->assertJsonPath('1.final_score', '70.0000')->assertJsonCount(2, '0.assessments');
        $this->getJson(self::API."/selection/periods/{$period->id}/ranking")->assertOk()->assertJsonCount(2);
        $this->getJson(self::API."/selection/applications/{$a1->id}/scores")->assertOk()->assertJsonPath('raw_score', '135.0000');
    }

    public function test_schedule_moves_verified_application(): void
    {
        $assessor = $this->makeUser('assessor');
        $period = $this->makePeriod();
        $comp = $this->makeComponent($period->id, 'WRITTEN', '100');
        $app = $this->makeApplication($this->makeUser('parent'), $period, 'VERIFIED');

        $this->as($assessor)->postJson(self::API.'/selection/schedules', [
            'application_id' => $app->id, 'component_id' => $comp->id, 'scheduled_at' => '2026-12-01T09:00:00+07:00', 'room' => 'R1',
        ])->assertCreated()->assertJsonPath('scheduled_at', '2026-12-01T02:00:00.000000Z')->assertJsonPath('status', 'SCHEDULED');
        $this->assertSame('ASSESSMENT_SCHEDULED', $app->fresh()->status);

        $this->getJson(self::API."/selection/schedules?application_id={$app->id}")->assertJsonCount(1);

        $this->postJson(self::API.'/selection/assessments/input', ['application_id' => $app->id, 'component_id' => $comp->id, 'score' => '70'])->assertOk();
        $this->assertSame('ASSESSED', $app->fresh()->status);
        $this->assertSame('COMPLETED', AssessmentSchedule::first()->status);
    }

    public function test_decisions_waiting_list_and_override(): void
    {
        $principal = $this->makeUser('principal');
        $period = $this->makePeriod();
        $app = $this->makeApplication($this->makeUser('parent'), $period, 'ASSESSED');
        $url = self::API."/selection/applications/{$app->id}/decision";

        $this->as($this->makeUser('assessor'))->postJson($url, ['decision' => 'ACCEPTED'])->assertForbidden();
        $this->as($principal)->postJson($url, ['decision' => 'MAYBE'])->assertStatus(400);

        $this->postJson($url, ['decision' => 'WAITLISTED', 'reason' => 'Quota full'])->assertOk()->assertJsonPath('decision', 'WAITLISTED');
        $this->assertSame('WAITLISTED', $app->fresh()->status);

        $this->getJson(self::API."/selection/periods/{$period->id}/waiting-list")->assertOk()->assertJsonCount(1)->assertJsonPath('0.position', 1);
        $entry = WaitingListEntry::first();

        $this->postJson(self::API."/selection/waiting-list/{$entry->id}/promote", [])->assertStatus(400);
        $this->postJson(self::API."/selection/waiting-list/{$entry->id}/promote", ['reason' => 'Seat opened'])->assertOk()
            ->assertJsonPath('status', 'PROMOTED')->assertJsonPath('promoted_by_id', $principal->id);
        $this->assertSame('ACCEPTED', $app->fresh()->status);
        $this->getJson($url)->assertOk()->assertJsonPath('decision', 'ACCEPTED')->assertJsonCount(1, 'histories')
            ->assertJsonPath('histories.0.old_decision', 'WAITLISTED');

        // overriding an existing decision demands a reason
        $this->postJson($url, ['decision' => 'REJECTED'])->assertStatus(400)->assertJsonPath('error.details.reason.0', 'A mandatory reason is required when overriding an existing decision.');
    }

    public function test_override_permission_can_reject_from_any_state(): void
    {
        $admin = $this->makeUser('admission_admin');
        $app = $this->makeApplication($this->makeUser('parent'), null, 'ASSESSED');
        $this->as($admin)->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'REJECTED'])
            ->assertOk()->assertJsonPath('decision', 'REJECTED');
        $this->assertSame('REJECTED', Application::find($app->id)->status);
    }
}
