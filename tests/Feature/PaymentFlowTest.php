<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ReRegistrationRequirement;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class PaymentFlowTest extends TestCase
{
    private const FIN = self::API.'/finance';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('spmb.storage_disk'));
    }

    private function proof(string $name = 'bukti.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\nbukti transfer\n%%EOF");
    }

    /** @return array{User, Application, User} parent, application, finance officer */
    private function scenario(string $status = 'ACCEPTED'): array
    {
        $parent = $this->makeUser('parent');

        return [$parent, $this->makeApplication($parent, null, $status), $this->makeUser('finance')];
    }

    private function invoice(User $staff, Application $app, string $amount = '1000000.00', array $extra = []): string
    {
        return $this->as($staff)->postJson(self::FIN."/applications/{$app->id}/invoices", $extra + [
            'type' => 'ENROLLMENT_FEE', 'amount' => $amount, 'description' => 'Uang pangkal',
        ])->assertCreated()->json('id');
    }

    private function pay(User $parent, string $invoiceId, string $amount, array $extra = []): TestResponse
    {
        return $this->as($parent)->post(self::FIN."/invoices/{$invoiceId}/payments", $extra + [
            'amount' => $amount, 'method' => 'BANK_TRANSFER', 'reference_number' => 'TRX-1', 'proof' => $this->proof(),
        ], ['Accept' => 'application/json']);
    }

    public function test_only_finance_staff_issue_invoices_and_only_owner_or_staff_read_them(): void
    {
        [$parent, $app, $finance] = $this->scenario();

        $body = ['type' => 'ENROLLMENT_FEE', 'amount' => '1000000'];
        $this->as($parent)->postJson(self::FIN."/applications/{$app->id}/invoices", $body)->assertForbidden();
        $this->as($this->makeUser('assessor'))->postJson(self::FIN."/applications/{$app->id}/invoices", $body)->assertForbidden();

        $res = $this->as($finance)->postJson(self::FIN."/applications/{$app->id}/invoices", $body + ['description' => 'Uang pangkal'])
            ->assertCreated()->assertJsonPath('status', 'UNPAID')->assertJsonPath('amount', '1000000.00')
            ->assertJsonPath('balance', '1000000.00');
        $this->assertMatchesRegularExpression('/^INV-\d{6}-[A-Z0-9]{6}$/', $res->json('invoice_number'));

        $url = self::FIN."/applications/{$app->id}/invoices";
        $this->as($parent)->getJson($url)->assertOk()->assertJsonCount(1);
        $this->as($finance)->getJson($url)->assertOk()->assertJsonCount(1);
        $this->as($this->makeUser('parent'))->getJson($url)->assertForbidden();
        $this->as($this->makeUser('assessor'))->getJson($url)->assertForbidden();

        $this->as($finance)->postJson($url, ['type' => 'X', 'amount' => '0'])->assertStatus(400);
        $this->postJson($url, ['type' => 'X', 'amount' => '10.555'])->assertStatus(400);
        $this->assertNotNull(AuditLog::where('action', 'invoice.created')->first());
    }

    public function test_proof_upload_validation_and_pending_state(): void
    {
        [$parent, $app, $finance] = $this->scenario();
        $inv = $this->invoice($finance, $app);

        $this->as($this->makeUser('parent'))->post(self::FIN."/invoices/{$inv}/payments", [
            'amount' => '100', 'method' => 'BANK_TRANSFER', 'proof' => $this->proof(),
        ], ['Accept' => 'application/json'])->assertForbidden();

        $this->pay($parent, $inv, '1000000.01')->assertStatus(400)->assertJsonPath('error.details.amount.0', 'Amount exceeds the remaining balance of 1000000.00.');
        $this->as($parent)->postJson(self::FIN."/invoices/{$inv}/payments", ['amount' => '100', 'method' => 'BANK_TRANSFER'])->assertStatus(400);
        $this->pay($parent, $inv, '100', ['proof' => UploadedFile::fake()->createWithContent('x.txt', 'just text')])
            ->assertStatus(400)->assertJsonPath('error.details.proof.0', "MIME type 'text/plain' is not allowed.");

        $res = $this->pay($parent, $inv, '400000.00')->assertCreated()
            ->assertJsonPath('status', 'PENDING')->assertJsonPath('has_proof', true)->assertJsonPath('amount', '400000.00');
        $this->assertArrayNotHasKey('proof_storage_key', $res->json());
        $this->assertSame(['PENDING'], collect($res->json('histories'))->pluck('to_status')->all());
        $this->assertSame('UNPAID', Invoice::find($inv)->status, 'a pending payment does not change the invoice yet');

        // pending amounts are reserved: only the rest can still be submitted
        $this->pay($parent, $inv, '600000.01')->assertStatus(400);
        $this->pay($parent, $inv, '600000.00')->assertCreated();
        $this->pay($parent, $inv, '1')->assertStatus(400);
        $this->assertNotNull(AuditLog::where('action', 'payment.submitted')->first());
    }

    public function test_finance_verification_drives_invoice_status_and_is_not_repeatable(): void
    {
        [$parent, $app, $finance] = $this->scenario();
        $inv = $this->invoice($finance, $app);
        $first = $this->pay($parent, $inv, '400000')->json('id');
        $second = $this->pay($parent, $inv, '600000')->json('id');

        $this->as($parent)->postJson(self::FIN."/payments/{$first}/verify", ['approved' => true])->assertForbidden();
        $this->as($this->makeUser('assessor'))->postJson(self::FIN."/payments/{$first}/verify", ['approved' => true])->assertForbidden();

        $this->as($finance)->postJson(self::FIN."/payments/{$first}/verify", ['approved' => true, 'note' => 'sesuai mutasi'])
            ->assertOk()->assertJsonPath('status', 'PAID')->assertJsonPath('verified_by_name', $finance->name);
        $this->assertSame('PARTIALLY_PAID', Invoice::find($inv)->status);

        $this->postJson(self::FIN."/payments/{$first}/verify", ['approved' => true])->assertStatus(400)
            ->assertJsonPath('error.details.status.0', 'Payment is already PAID.');

        $this->postJson(self::FIN."/payments/{$second}/verify", ['approved' => false])->assertStatus(400);
        $this->postJson(self::FIN."/payments/{$second}/verify", ['approved' => false, 'note' => 'nominal tidak sesuai'])
            ->assertOk()->assertJsonPath('status', 'REJECTED');
        $this->assertSame('PARTIALLY_PAID', Invoice::find($inv)->status);

        // the rejected amount is free again; pay the rest and get it approved
        $third = $this->pay($parent, $inv, '600000')->assertCreated()->json('id');
        $this->as($finance)->postJson(self::FIN."/payments/{$third}/verify", ['approved' => true])->assertOk();
        $this->assertSame('PAID', Invoice::find($inv)->status);

        $this->getJson(self::FIN."/applications/{$app->id}/invoices")->assertOk()
            ->assertJsonPath('0.paid_amount', '1000000.00')->assertJsonPath('0.balance', '0.00');
        $this->as($parent)->postJson(self::FIN."/invoices/{$inv}/payments", ['amount' => '1', 'method' => 'X'])->assertStatus(400);

        $this->assertSame(['PENDING', 'PAID'], Payment::find($first)->histories->pluck('to_status')->all());
        $this->assertSame(2, AuditLog::where('action', 'payment.verified')->count());
        $this->assertSame(1, AuditLog::where('action', 'payment.rejected')->count());
    }

    public function test_queue_lists_pending_first_for_finance_only(): void
    {
        [$parent, $app, $finance] = $this->scenario();
        $inv = $this->invoice($finance, $app);
        $a = $this->pay($parent, $inv, '100')->json('id');
        $this->pay($parent, $inv, '200');
        $this->as($finance)->postJson(self::FIN."/payments/{$a}/verify", ['approved' => true])->assertOk();

        $this->getJson(self::FIN.'/payments?status=PENDING')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.applicant_name', 'Budi Santoso')
            ->assertJsonPath('data.0.registration_number', $app->registration_number)->assertJsonPath('meta.total', 1);
        $this->getJson(self::FIN.'/payments')->assertOk()->assertJsonPath('data.0.status', 'PENDING')->assertJsonCount(2, 'data');
        $this->getJson(self::FIN.'/payments?status=NOPE')->assertStatus(400);

        $this->as($parent)->getJson(self::FIN.'/payments')->assertForbidden();
        $this->as($this->makeUser('assessor'))->getJson(self::FIN.'/payments')->assertForbidden();
    }

    public function test_proof_download_is_private_and_audited(): void
    {
        [$parent, $app, $finance] = $this->scenario();
        $inv = $this->invoice($finance, $app);
        $pid = $this->pay($parent, $inv, '100')->json('id');
        $url = self::FIN."/payments/{$pid}/proof";

        $this->app['auth']->forgetGuards();
        $this->getJson($url)->assertUnauthorized();
        $this->as($this->makeUser('parent'))->getJson($url)->assertForbidden();
        $this->as($this->makeUser('assessor'))->getJson($url)->assertForbidden();

        $res = $this->as($parent)->get($url)->assertOk();
        $this->assertStringContainsString('bukti transfer', $res->streamedContent());
        $this->as($finance)->get($url)->assertOk();
        $this->assertSame(2, AuditLog::where('action', 'payment.proof_accessed')->where('resource_id', $pid)->count());
    }

    public function test_cancelling_an_invoice_waives_it_with_a_reason(): void
    {
        [$parent, $app, $finance] = $this->scenario();
        $inv = $this->invoice($finance, $app);

        $this->as($parent)->postJson(self::FIN."/invoices/{$inv}/cancel", ['reason' => 'x'])->assertForbidden();
        $this->as($finance)->postJson(self::FIN."/invoices/{$inv}/cancel", [])->assertStatus(400);

        $pending = $this->pay($parent, $inv, '100')->json('id');
        $this->as($finance)->postJson(self::FIN."/invoices/{$inv}/cancel", ['reason' => 'beasiswa'])->assertStatus(400);
        $this->postJson(self::FIN."/payments/{$pending}/verify", ['approved' => false, 'note' => 'salah'])->assertOk();

        $this->postJson(self::FIN."/invoices/{$inv}/cancel", ['reason' => 'beasiswa'])->assertOk()->assertJsonPath('status', 'CANCELLED');
        $this->postJson(self::FIN."/invoices/{$inv}/cancel", ['reason' => 'lagi'])->assertStatus(400);
        $this->pay($parent, $inv, '100')->assertStatus(400);
        $this->assertSame('beasiswa', AuditLog::where('action', 'invoice.cancelled')->sole()->reason);
    }

    public function test_unpaid_invoice_past_due_date_expires_and_rejects_payments(): void
    {
        [$parent, $app, $finance] = $this->scenario();
        $inv = $this->invoice($finance, $app, '500000', ['due_date' => now()->subDay()->toIso8601String()]);

        $this->as($parent)->getJson(self::FIN."/applications/{$app->id}/invoices")->assertOk()->assertJsonPath('0.status', 'EXPIRED');
        $this->pay($parent, $inv, '100')->assertStatus(400)->assertJsonPath('error.details.invoice.0', 'Invoice is EXPIRED and cannot receive payments.');
    }

    public function test_re_registration_cannot_complete_until_invoices_are_paid_or_waived(): void
    {
        [$parent, $app, $finance] = $this->scenario('ACCEPTED');
        ReRegistrationRequirement::create(['admission_period_id' => $app->admission_period_id, 'name' => 'Seragam', 'code' => 'UNI', 'is_required' => false]);
        $reRegId = $this->as($parent)->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertCreated()->json('id');
        $complete = self::API."/enrollment/re-registrations/{$reRegId}/complete";

        $inv = $this->invoice($finance, $app, '300000');
        $this->as($parent)->postJson($complete)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Cannot complete re-registration: outstanding invoices must be paid or waived first.');

        $pid = $this->pay($parent, $inv, '300000')->json('id');
        $this->postJson($complete)->assertStatus(400);
        $this->as($finance)->postJson(self::FIN."/payments/{$pid}/verify", ['approved' => true])->assertOk();

        $this->as($parent)->postJson($complete)->assertOk()->assertJsonPath('status', 'COMPLETED');
        $this->assertSame('RE_REGISTRATION_VERIFIED', $app->fresh()->status);
    }

    public function test_a_waived_invoice_does_not_block_re_registration(): void
    {
        [$parent, $app, $finance] = $this->scenario('ACCEPTED');
        $reRegId = $this->as($parent)->postJson(self::API."/enrollment/applications/{$app->id}/start-re-registration")->assertCreated()->json('id');
        $inv = $this->invoice($finance, $app);
        $this->postJson(self::FIN."/invoices/{$inv}/cancel", ['reason' => 'dibebaskan kepala sekolah'])->assertOk();

        $this->as($parent)->postJson(self::API."/enrollment/re-registrations/{$reRegId}/complete")->assertOk();
    }
}
