<?php

namespace Tests\Feature;

use App\Models\AdmissionPeriod;
use App\Models\Application;
use App\Models\ApplicationDecision;
use App\Models\Enrollment;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ReRegistration;
use Tests\TestCase;

class ReportTest extends TestCase
{
    private const REP = self::API.'/reports';

    private function accepted(Application $app, string $status = 'ACCEPTED'): Application
    {
        $app->update(['status' => $status, 'submitted_at' => now(), 'verified_at' => now(), 'assessed_at' => now()]);
        ApplicationDecision::create([
            'application_id' => $app->id, 'decision' => 'ACCEPTED', 'final_score' => '88.5', 'rank' => 1,
            'decided_by' => $this->makeUser('principal')->id,
        ]);

        return $app;
    }

    /** @return array{0: AdmissionPeriod, 1: AdmissionPeriod} */
    private function seedFunnel(): array
    {
        $p1 = $this->makePeriod(['quota' => 2]);
        $p2 = $this->makePeriod();
        $parent = $this->makeUser('parent');

        $this->makeApplication($parent, $p1);                                    // draft
        $this->makeApplication($parent, $p1, 'SUBMITTED');                       // waiting verification
        $this->makeApplication($parent, $p1, 'REVISION_REQUIRED');
        $done = $this->accepted($this->makeApplication($parent, $p1), 'ENROLLED');
        ReRegistration::create(['application_id' => $done->id, 'status' => 'COMPLETED']);
        Enrollment::create(['application_id' => $done->id, 'status' => 'ACTIVE', 'enrolled_at' => now()]);
        $this->accepted($this->makeApplication($parent, $p2));
        $done->applicant->update(['previous_school_name' => 'SD Negeri 1', 'city' => 'Bandung']);

        return [$p1, $p2];
    }

    public function test_summary_counts_funnel_work_queue_and_quota(): void
    {
        [$p1] = $this->seedFunnel();
        $admin = $this->makeUser('admission_admin');

        $res = $this->as($admin)->getJson(self::REP.'/summary')->assertOk()
            ->assertJsonPath('total', 5)
            ->assertJsonPath('by_status.DRAFT', 1)
            ->assertJsonPath('work_queue.awaiting_verification', 1)
            ->assertJsonPath('work_queue.revision_required', 1)
            ->assertJsonPath('top_schools.0', ['value' => 'SD Negeri 1', 'total' => 1]);
        $funnel = collect($res->json('funnel'))->pluck('total', 'key')->all();
        $this->assertSame(['registered' => 5, 'submitted' => 4, 'verified' => 2, 'assessed' => 2, 'accepted' => 2, 're_registered' => 1, 'enrolled' => 1], $funnel);

        $period = collect($res->json('periods'))->firstWhere('id', $p1->id);
        $this->assertSame(['quota' => 2, 'applications' => 4, 'accepted' => 1, 'enrolled' => 1, 'remaining_quota' => 1],
            array_intersect_key($period, array_flip(['quota', 'applications', 'accepted', 'enrolled', 'remaining_quota'])));

        $this->getJson(self::REP."/summary?admission_period_id={$p1->id}")->assertOk()->assertJsonPath('total', 4)->assertJsonCount(1, 'periods');
        $this->getJson(self::REP.'/summary?academic_year_id=nope')->assertNotFound();
    }

    public function test_finance_figures_only_for_payment_readers(): void
    {
        $app = $this->accepted($this->makeApplication($this->makeUser('parent')));
        $invoice = Invoice::create(['application_id' => $app->id, 'invoice_number' => 'INV-1', 'type' => 'SPP', 'amount' => '300000', 'status' => 'PARTIALLY_PAID']);
        Payment::create(['invoice_id' => $invoice->id, 'amount' => '100000', 'method' => 'BANK_TRANSFER', 'status' => 'PAID']);
        Payment::create(['invoice_id' => $invoice->id, 'amount' => '50000', 'method' => 'BANK_TRANSFER', 'status' => 'PENDING']);

        $this->as($this->makeUser('finance'))->getJson(self::REP.'/summary')->assertOk()
            ->assertJsonPath('finance.pending_payments', 1)
            ->assertJsonPath('finance.outstanding_invoices', 1)
            ->assertJsonPath('finance.verified_amount', '100000.00');
        $this->as($this->makeUser('verifier'))->getJson(self::REP.'/summary')->assertOk()->assertJsonPath('finance', null);
    }

    public function test_report_permissions(): void
    {
        $parent = $this->makeUser('parent');
        foreach (['summary', 'applications/export', 'selection/export', 'payments/export'] as $path) {
            $this->as($parent)->get(self::REP."/{$path}", ['Accept' => 'application/json'])->assertForbidden();
        }
        $verifier = $this->makeUser('verifier');
        $this->as($verifier)->get(self::REP.'/applications/export')->assertOk();
        $this->as($verifier)->get(self::REP.'/selection/export', ['Accept' => 'application/json'])->assertForbidden();
        $this->as($verifier)->get(self::REP.'/payments/export', ['Accept' => 'application/json'])->assertForbidden();
        $this->as($this->makeUser('principal'))->get(self::REP.'/selection/export')->assertOk();
        $this->as($this->makeUser('finance'))->get(self::REP.'/payments/export')->assertOk();
    }

    public function test_csv_exports_contain_expected_rows_without_nik(): void
    {
        [$p1] = $this->seedFunnel();
        $admin = $this->makeUser('super_admin');

        $csv = $this->as($admin)->get(self::REP."/applications/export?admission_period_id={$p1->id}")->assertOk()->streamedContent();
        $this->assertStringContainsString('"No. Pendaftaran",Nama', $csv);
        $this->assertSame(5, substr_count($csv, "\n"), 'header + 4 applications of period 1');
        $this->assertStringNotContainsString('3273010101140001', $csv, 'NIK is never exported');

        $selection = $this->get(self::REP.'/selection/export')->assertOk()->streamedContent();
        $this->assertSame(3, substr_count($selection, "\n"), 'header + 2 decided applications');
        $this->assertStringContainsString('88.5', $selection);

        $app = Application::first();
        Invoice::create(['application_id' => $app->id, 'invoice_number' => 'INV-X', 'type' => 'SPP', 'amount' => '1', 'status' => 'UNPAID']);
        $payments = $this->get(self::REP.'/payments/export')->assertOk()->streamedContent();
        $this->assertStringContainsString('INV-X', $payments);
    }
}
