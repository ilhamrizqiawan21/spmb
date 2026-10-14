<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use LogicException;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    public function test_decision_and_status_change_are_audited_with_override_history(): void
    {
        $principal = $this->makeUser('principal');
        $app = $this->makeApplication($this->makeUser('parent'), null, 'ASSESSED');
        $url = self::API."/selection/applications/{$app->id}/decision";

        $this->as($principal)->postJson($url, ['decision' => 'WAITLISTED', 'reason' => 'Quota full'])->assertOk();
        $this->postJson($url, ['decision' => 'ACCEPTED', 'reason' => 'Seat opened'])->assertOk();

        $made = AuditLog::where('action', 'decision.made')->sole();
        $this->assertSame($principal->id, $made->user_id);
        $this->assertSame('Quota full', $made->reason);
        $this->assertNull($made->old_values);
        $this->assertSame('WAITLISTED', $made->new_values['decision']);
        $this->assertNotNull($made->ip_address);

        $overridden = AuditLog::where('action', 'decision.overridden')->sole();
        $this->assertSame(['decision' => 'WAITLISTED'], $overridden->old_values);
        $this->assertSame('ACCEPTED', $overridden->new_values['decision']);

        $status = AuditLog::where('action', 'application.status_changed')->where('resource_id', $app->id)->orderBy('created_at')->get();
        $this->assertSame(['WAITLISTED', 'ACCEPTED'], $status->pluck('new_values.status')->all());
        $this->assertSame('ASSESSED', $status->first()->old_values['status']);
    }

    public function test_audit_entries_cannot_be_updated(): void
    {
        $log = AuditLog::create(['action' => 'x.y', 'resource_type' => 'x', 'created_at' => now()]);

        $this->expectException(LogicException::class);
        $log->update(['reason' => 'tampered']);
    }

    public function test_audit_entries_cannot_be_deleted(): void
    {
        $log = AuditLog::create(['action' => 'x.y', 'resource_type' => 'x', 'created_at' => now()]);

        $this->expectException(LogicException::class);
        $log->delete();
    }

    public function test_only_audit_readers_can_list_and_filter(): void
    {
        $admin = $this->makeUser('admission_admin');
        $app = $this->makeApplication($this->makeUser('parent'), null, 'ASSESSED');
        $this->as($admin)->postJson(self::API."/selection/applications/{$app->id}/decision", ['decision' => 'REJECTED'])->assertOk();

        $this->getJson(self::API.'/audit-logs?action=decision.made')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.id', $admin->id)
            ->assertJsonPath('data.0.new_values.decision', 'REJECTED')
            ->assertJsonPath('meta.total', 1);

        $this->getJson(self::API.'/audit-logs?resource_id='.$app->id)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson(self::API.'/audit-logs?resource_id=not-a-uuid')->assertNotFound();

        $this->as($this->makeUser('parent'))->getJson(self::API.'/audit-logs')->assertForbidden();
        $this->as($this->makeUser('assessor'))->getJson(self::API.'/audit-logs')->assertForbidden();
    }

    public function test_listing_requires_authentication(): void
    {
        $this->getJson(self::API.'/audit-logs')->assertUnauthorized();
    }
}
