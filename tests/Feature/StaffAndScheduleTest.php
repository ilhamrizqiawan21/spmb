<?php

namespace Tests\Feature;

use App\Models\AssessmentSchedule;
use App\Models\SelectionComponent;
use Tests\TestCase;

class StaffAndScheduleTest extends TestCase
{
    public function test_staff_list_is_restricted_and_excludes_parents(): void
    {
        $v1 = $this->makeUser('verifier', ['name' => 'Anto']);
        $this->makeUser('verifier', ['name' => 'Budi', 'is_active' => false]);
        $this->makeUser('assessor');
        $parent = $this->makeUser('parent');

        $this->as($parent)->getJson(self::API.'/auth/staff')->assertForbidden();
        $this->as($this->makeUser('assessor'))->getJson(self::API.'/auth/staff')->assertForbidden();

        $admin = $this->makeUser('admission_admin');
        $this->as($admin)->getJson(self::API.'/auth/staff?role=verifier')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.id', $v1->id)->assertJsonPath('0.roles', ['verifier'])
            ->assertJsonMissingPath('0.email');
        $this->getJson(self::API.'/auth/staff')->assertOk()->assertJsonCount(4); // verifier, 2 assessors, admin
        $this->getJson(self::API.'/auth/staff?role=parent')->assertStatus(400);
    }

    public function test_schedule_visible_to_owner_and_staff_only_and_updatable(): void
    {
        $owner = $this->makeUser('parent');
        $assessor = $this->makeUser('assessor');
        $period = $this->makePeriod();
        $comp = SelectionComponent::create(['admission_period_id' => $period->id, 'name' => 'Tes', 'code' => 'T', 'weight' => 100]);
        $app = $this->makeApplication($owner, $period, 'VERIFIED');

        $id = $this->as($assessor)->postJson(self::API.'/selection/schedules', [
            'application_id' => $app->id, 'component_id' => $comp->id, 'scheduled_at' => '2026-12-01T09:00:00Z', 'room' => 'R1',
        ])->assertCreated()->json('id');

        $url = self::API."/selection/applications/{$app->id}/schedules";
        $this->as($owner)->getJson($url)->assertOk()->assertJsonCount(1)->assertJsonPath('0.component_name', 'Tes')->assertJsonPath('0.room', 'R1');
        $this->as($this->makeUser('parent'))->getJson($url)->assertForbidden();
        $this->as($assessor)->getJson($url)->assertOk();

        // only assessment staff may change it
        $this->as($owner)->patchJson(self::API."/selection/schedules/{$id}", ['room' => 'X'])->assertForbidden();
        $this->as($assessor)->patchJson(self::API."/selection/schedules/{$id}", ['scheduled_at' => '2026-12-02T10:00:00+07:00', 'room' => 'R2'])
            ->assertOk()->assertJsonPath('room', 'R2')->assertJsonPath('scheduled_at', '2026-12-02T03:00:00.000000Z');
        $this->patchJson(self::API."/selection/schedules/{$id}", ['status' => 'CANCELLED'])->assertOk()->assertJsonPath('status', 'CANCELLED');
        $this->patchJson(self::API."/selection/schedules/{$id}", ['status' => 'COMPLETED'])->assertStatus(400);
        $this->patchJson(self::API.'/selection/schedules/00000000-0000-4000-8000-000000000000', ['room' => 'X'])->assertNotFound();
        $this->assertSame('CANCELLED', AssessmentSchedule::find($id)->status);
    }
}
