<?php

namespace Tests\Feature;

use App\Models\ReRegistrationRequirement;
use Tests\TestCase;

class ReRegistrationTest extends TestCase
{
    public function test_requirement_management(): void
    {
        $admin = $this->makeUser('admission_admin');
        $period = $this->makePeriod();
        $body = ['admission_period_id' => $period->id, 'name' => 'Surat Pernyataan', 'code' => 'SP', 'sort_order' => 2];

        $this->as($this->makeUser('parent'))->postJson(self::API.'/enrollment/requirements', $body)->assertForbidden();
        $id = $this->as($admin)->postJson(self::API.'/enrollment/requirements', $body)->assertCreated()
            ->assertJsonPath('is_required', true)->assertJsonPath('period_name', $period->name)->json('id');
        $this->postJson(self::API.'/enrollment/requirements', $body)->assertStatus(400);
        $this->patchJson(self::API."/enrollment/requirements/{$id}", ['is_required' => false])->assertOk()->assertJsonPath('is_required', false);
        $this->app['auth']->forgetGuards();
        $this->getJson(self::API."/enrollment/requirements?admission_period_id={$period->id}")->assertOk()->assertJsonCount(1);
        $this->as($admin)->deleteJson(self::API."/enrollment/requirements/{$id}")->assertNoContent();
    }

    public function test_full_re_registration_flow(): void
    {
        $parent = $this->makeUser('parent');
        $period = $this->makePeriod();
        $req1 = ReRegistrationRequirement::create(['admission_period_id' => $period->id, 'name' => 'Seragam', 'code' => 'UNI', 'sort_order' => 1]);
        $req2 = ReRegistrationRequirement::create(['admission_period_id' => $period->id, 'name' => 'Foto', 'code' => 'PIC', 'sort_order' => 0, 'is_required' => false]);

        $draft = $this->makeApplication($parent, $period, 'ASSESSED');
        $this->as($parent)->postJson(self::API."/enrollment/applications/{$draft->id}/start-re-registration")->assertStatus(400);

        $app = $this->makeApplication($parent, $period, 'ACCEPTED');
        $this->as($this->makeUser('parent'))->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertForbidden();

        $res = $this->as($parent)->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertCreated()
            ->assertJsonPath('status', 'IN_PROGRESS')->assertJsonCount(2, 'items')->assertJsonPath('items.0.requirement_code', 'PIC');
        $this->assertSame('RE_REGISTRATION', $app->fresh()->status);
        $reRegId = $res->json('id');

        // idempotent
        $this->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertCreated()->assertJsonPath('id', $reRegId);
        $this->getJson(self::API."/enrollment/applications/{$app->id}/re-registration")->assertOk()->assertJsonPath('id', $reRegId);

        $this->postJson(self::API."/enrollment/re-registrations/{$reRegId}/complete")->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Cannot complete re-registration: mandatory items incomplete (Seragam).');

        $item = $res->json('items.1.id');
        $this->patchJson(self::API."/enrollment/re-registration-items/{$item}", ['status' => 'BOGUS'])->assertStatus(400);
        $this->patchJson(self::API."/enrollment/re-registration-items/{$item}", ['status' => 'COMPLETED', 'notes' => 'done'])
            ->assertOk()->assertJsonPath('status', 'COMPLETED')->assertJsonPath('is_required', true);

        $this->postJson(self::API."/enrollment/re-registrations/{$reRegId}/complete")->assertOk()->assertJsonPath('status', 'COMPLETED');
        $this->assertSame('RE_REGISTRATION_VERIFIED', $app->fresh()->status);
        $this->assertNotNull(ReRegistrationRequirement::find($req1->id));
        $this->assertNotNull($req2);
    }

    public function test_requirement_in_use_cannot_be_deleted(): void
    {
        $parent = $this->makeUser('parent');
        $period = $this->makePeriod();
        $req = ReRegistrationRequirement::create(['admission_period_id' => $period->id, 'name' => 'Seragam', 'code' => 'UNI']);
        $app = $this->makeApplication($parent, $period, 'ACCEPTED');
        $this->as($parent)->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertCreated();

        $this->as($this->makeUser('admission_admin'))->deleteJson(self::API."/enrollment/requirements/{$req->id}")->assertStatus(400);
    }

    public function test_staff_with_enrollment_permission_can_complete(): void
    {
        $parent = $this->makeUser('parent');
        $period = $this->makePeriod();
        $app = $this->makeApplication($parent, $period, 'ACCEPTED');
        $id = $this->as($parent)->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertCreated()->json('id');

        $this->as($this->makeUser('admission_admin'))->postJson(self::API."/enrollment/re-registrations/{$id}/complete")->assertOk();
    }
}
