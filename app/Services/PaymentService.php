<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentHistory;
use App\Models\User;
use App\Support\InvoiceStatus;
use App\Support\PaymentStatus;
use App\Support\PrivateStorage;
use Brick\Math\BigDecimal;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Manual payment flow: staff issue invoices, parents upload transfer proofs, finance verifies.
 * Invoice status is always derived server-side from verified payments; every payment change is
 * recorded in payment_histories and the audit log.
 */
class PaymentService
{
    public const MANAGE_PERMS = ['payment.verify', 'application.override'];

    public const READ_PERMS = ['payment.read', 'payment.verify', 'application.override'];

    public const PROOF_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

    public const PROOF_MAX_BYTES = 2 * 1024 * 1024;

    // ---- authorization ------------------------------------------------------

    private static function requireManage(User $user): void
    {
        if (! $user->hasAnyPermCodes(self::MANAGE_PERMS)) {
            throw ApiException::forbidden('You do not have permission to manage invoices and payments.');
        }
    }

    /** Owner of the application, or staff allowed to read payments. */
    private static function authorizeRead(User $user, Application $application): void
    {
        if ($application->applicant->owner_user_id === $user->id || $user->hasAnyPermCodes(self::READ_PERMS)) {
            return;
        }
        throw ApiException::forbidden('You do not have permission to view these invoices.');
    }

    // ---- invoices -----------------------------------------------------------

    /** @param array{type:string,amount:string,due_date:?CarbonInterface,description:?string} $data */
    public static function createInvoice(User $by, string $applicationId, array $data): Invoice
    {
        self::requireManage($by);
        $application = Application::find($applicationId) ?? throw ApiException::notFound('Application not found.');

        return DB::transaction(function () use ($by, $application, $data) {
            $invoice = Invoice::create([
                'application_id' => $application->id,
                'invoice_number' => self::newInvoiceNumber(),
                'type' => $data['type'],
                'amount' => $data['amount'],
                'due_date' => $data['due_date'] ?? null,
                'description' => $data['description'] ?? null,
                'status' => InvoiceStatus::UNPAID,
                'created_by' => $by->id,
            ]);

            AuditService::record($by, 'invoice.created', 'invoice', $invoice->id, null, [
                'application_id' => $application->id, 'invoice_number' => $invoice->invoice_number,
                'type' => $invoice->type, 'amount' => (string) $invoice->amount,
            ]);

            return $invoice->load('payments.verifiedBy');
        });
    }

    /**
     * Bulk create invoices for all matching applications in an admission period.
     * Skips applications that already have an active (non-cancelled) invoice of the same type.
     *
     * @param array{admission_period_id:string,application_status:string,type:string,amount:string,due_date:?CarbonInterface,description:?string} $data
     * @return array{total_targeted:int,created:int,skipped:int}
     */
    public static function createBulkInvoices(User $by, array $data): array
    {
        self::requireManage($by);

        $applications = Application::where('admission_period_id', $data['admission_period_id'])
            ->where('status', $data['application_status'])
            ->get();

        if ($applications->isEmpty()) {
            return ['total_targeted' => 0, 'created' => 0, 'skipped' => 0];
        }

        $existingAppIds = Invoice::whereIn('application_id', $applications->pluck('id'))
            ->where('type', $data['type'])
            ->where('status', '!=', InvoiceStatus::CANCELLED)
            ->pluck('application_id')
            ->all();
        $existingSet = array_flip($existingAppIds);

        return DB::transaction(function () use ($by, $applications, $existingSet, $data) {
            $created = 0;
            foreach ($applications as $app) {
                if (isset($existingSet[$app->id])) {
                    continue;
                }
                $invoice = Invoice::create([
                    'application_id' => $app->id,
                    'invoice_number' => self::newInvoiceNumber(),
                    'type' => $data['type'],
                    'amount' => $data['amount'],
                    'due_date' => $data['due_date'] ?? null,
                    'description' => $data['description'] ?? null,
                    'status' => InvoiceStatus::UNPAID,
                    'created_by' => $by->id,
                ]);

                AuditService::record($by, 'invoice.created', 'invoice', $invoice->id, null, [
                    'application_id' => $app->id,
                    'invoice_number' => $invoice->invoice_number,
                    'type' => $invoice->type,
                    'amount' => (string) $invoice->amount,
                    'bulk' => true,
                ]);
                $created++;
            }

            return [
                'total_targeted' => $applications->count(),
                'created' => $created,
                'skipped' => $applications->count() - $created,
            ];
        });
    }

    private static function newInvoiceNumber(): string
    {
        do {
            $number = 'INV-'.now()->format('Ym').'-'.strtoupper(Str::random(6));
        } while (Invoice::where('invoice_number', $number)->exists());

        return $number;
    }

    /** @return Collection<int, Invoice> */
    public static function invoicesFor(User $user, string $applicationId): Collection
    {
        $application = Application::with('applicant')->find($applicationId) ?? throw ApiException::notFound('Application not found.');
        self::authorizeRead($user, $application);

        $invoices = Invoice::with('payments.verifiedBy')->where('application_id', $application->id)->orderBy('created_at')->get();
        $invoices->each(fn (Invoice $invoice) => self::expireIfDue($invoice));

        return $invoices;
    }

    public static function cancelInvoice(User $by, string $invoiceId, string $reason): Invoice
    {
        self::requireManage($by);
        if (trim($reason) === '') {
            throw ApiException::validation(['reason' => 'A reason is required to cancel (waive) an invoice.']);
        }

        return DB::transaction(function () use ($by, $invoiceId, $reason) {
            $invoice = Invoice::with('payments')->lockForUpdate()->find($invoiceId) ?? throw ApiException::notFound('Invoice not found.');
            if ($invoice->status === InvoiceStatus::CANCELLED) {
                throw ApiException::validation(['status' => 'Invoice is already cancelled.']);
            }
            if ($invoice->payments->contains(fn (Payment $p) => in_array($p->status, [PaymentStatus::PAID, PaymentStatus::PENDING], true))) {
                throw ApiException::validation(['status' => 'Invoice has pending or verified payments; resolve them before cancelling.']);
            }

            $previous = $invoice->status;
            $invoice->update(['status' => InvoiceStatus::CANCELLED]);
            AuditService::record($by, 'invoice.cancelled', 'invoice', $invoice->id, ['status' => $previous], ['status' => InvoiceStatus::CANCELLED], $reason);

            return $invoice->load('payments.verifiedBy');
        });
    }

    /** True when the application still has unpaid (or expired/partial) invoices. Cancelled invoices count as waived. */
    public static function hasOutstandingInvoices(string $applicationId): bool
    {
        return Invoice::where('application_id', $applicationId)->whereIn('status', InvoiceStatus::OUTSTANDING)->exists();
    }

    /** Lazy expiry (no scheduler needed): an unpaid invoice past its due date with nothing awaiting verification expires. */
    private static function expireIfDue(Invoice $invoice): void
    {
        if ($invoice->status !== InvoiceStatus::UNPAID || ! $invoice->due_date || ! $invoice->due_date->isPast()) {
            return;
        }
        if ($invoice->payments->contains(fn (Payment $p) => $p->status === PaymentStatus::PENDING)) {
            return;
        }
        $invoice->update(['status' => InvoiceStatus::EXPIRED]);
    }

    /** Derive status from verified payments: PAID when covered, PARTIALLY_PAID when some, else UNPAID. */
    private static function recompute(Invoice $invoice): void
    {
        if ($invoice->status === InvoiceStatus::CANCELLED) {
            return;
        }
        $paid = self::sum($invoice->payments()->where('status', PaymentStatus::PAID)->pluck('amount'));
        $total = BigDecimal::of((string) $invoice->amount);

        $invoice->update(['status' => match (true) {
            $paid->isGreaterThanOrEqualTo($total) => InvoiceStatus::PAID,
            $paid->isPositive() => InvoiceStatus::PARTIALLY_PAID,
            default => InvoiceStatus::UNPAID,
        }]);
    }

    /** @param iterable<mixed> $amounts */
    private static function sum(iterable $amounts): BigDecimal
    {
        $total = BigDecimal::zero();
        foreach ($amounts as $amount) {
            $total = $total->plus(BigDecimal::of((string) $amount));
        }

        return $total;
    }

    // ---- payments -----------------------------------------------------------

    /** @param array{amount:string,method:string,reference_number:?string,paid_at:?CarbonInterface} $data */
    public static function submitPayment(User $user, string $invoiceId, array $data, UploadedFile $proof): Payment
    {
        $invoice = Invoice::with(['application.applicant', 'payments'])->find($invoiceId) ?? throw ApiException::notFound('Invoice not found.');
        ApplicantService::checkModify($user, $invoice->application->applicant);

        self::expireIfDue($invoice);
        if (! in_array($invoice->status, InvoiceStatus::PAYABLE, true)) {
            throw ApiException::validation(['invoice' => "Invoice is {$invoice->status} and cannot receive payments."]);
        }

        $reserved = self::sum($invoice->payments->whereIn('status', [PaymentStatus::PAID, PaymentStatus::PENDING])->pluck('amount'));
        $balance = BigDecimal::of((string) $invoice->amount)->minus($reserved);
        if (! $balance->isPositive()) {
            throw ApiException::validation(['amount' => 'This invoice is already fully covered by verified or pending payments.']);
        }
        if (BigDecimal::of($data['amount'])->isGreaterThan($balance)) {
            throw ApiException::validation(['amount' => "Amount exceeds the remaining balance of {$balance->toScale(2)}."]);
        }

        if ($proof->getSize() > self::PROOF_MAX_BYTES) {
            throw ApiException::validation(['proof' => 'Proof file exceeds the maximum size of 2.0 MB.']);
        }
        // Server-side detected MIME type (never trust the client-declared one).
        $mime = $proof->getMimeType() ?: 'application/octet-stream';
        if (! in_array($mime, self::PROOF_MIME_TYPES, true)) {
            throw ApiException::validation(['proof' => "MIME type '{$mime}' is not allowed."]);
        }

        $content = $proof->get();
        $storageKey = (new PrivateStorage)->put($content);

        return DB::transaction(function () use ($user, $invoice, $data, $proof, $mime, $content, $storageKey) {
            $payment = Payment::create([
                'invoice_id' => $invoice->id,
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference_number' => $data['reference_number'] ?? null,
                'paid_at' => $data['paid_at'] ?? null,
                'proof_storage_key' => $storageKey,
                'proof_original_filename' => $proof->getClientOriginalName() ?: 'proof',
                'proof_mime_type' => $mime,
                'proof_file_size' => $proof->getSize(),
                'proof_checksum' => hash('sha256', $content),
                'status' => PaymentStatus::PENDING,
            ]);

            self::history($payment, null, PaymentStatus::PENDING, $user, null);
            AuditService::record($user, 'payment.submitted', 'payment', $payment->id, null, [
                'invoice_id' => $invoice->id, 'amount' => (string) $payment->amount, 'method' => $payment->method,
            ]);

            return $payment->load(['verifiedBy', 'histories']);
        });
    }

    public static function verifyPayment(User $by, string $paymentId, bool $approved, ?string $note): Payment
    {
        self::requireManage($by);
        if (! $approved && trim((string) $note) === '') {
            throw ApiException::validation(['note' => 'A reason is required to reject a payment.']);
        }

        return DB::transaction(function () use ($by, $paymentId, $approved, $note) {
            $payment = Payment::lockForUpdate()->find($paymentId) ?? throw ApiException::notFound('Payment not found.');
            if ($payment->status !== PaymentStatus::PENDING) {
                throw ApiException::validation(['status' => "Payment is already {$payment->status}."]);
            }

            $to = $approved ? PaymentStatus::PAID : PaymentStatus::REJECTED;
            $payment->update(['status' => $to, 'verified_at' => now(), 'verified_by' => $by->id, 'verification_note' => $note]);

            self::history($payment, PaymentStatus::PENDING, $to, $by, $note);
            self::recompute($payment->invoice);
            AuditService::record(
                $by, $approved ? 'payment.verified' : 'payment.rejected', 'payment', $payment->id,
                ['status' => PaymentStatus::PENDING], ['status' => $to, 'amount' => (string) $payment->amount], $note,
            );

            return $payment->load(['verifiedBy', 'histories', 'invoice']);
        });
    }

    private static function history(Payment $payment, ?string $from, string $to, ?User $by, ?string $notes): void
    {
        PaymentHistory::create([
            'payment_id' => $payment->id, 'from_status' => $from, 'to_status' => $to,
            'changed_by' => $by?->id, 'notes' => $notes, 'created_at' => now(),
        ]);
    }

    /** Finance work queue. */
    public static function queue(User $user, ?string $status, int $perPage = 50): LengthAwarePaginator
    {
        if (! $user->hasAnyPermCodes(self::READ_PERMS)) {
            throw ApiException::forbidden('You do not have permission to view payments.');
        }

        return Payment::with(['invoice.application.applicant', 'verifiedBy'])
            ->when($status, fn ($q, $s) => $q->where('status', $s))
            ->orderByRaw("CASE status WHEN 'PENDING' THEN 0 ELSE 1 END")->orderBy('created_at')
            ->paginate($perPage);
    }

    /** Authorize and audit access to a payment proof; the caller streams it. */
    public static function proofFor(User $user, string $paymentId): Payment
    {
        $payment = Payment::with('invoice.application.applicant')->find($paymentId) ?? throw ApiException::notFound('Payment not found.');
        self::authorizeRead($user, $payment->invoice->application);

        if (! $payment->proof_storage_key || ! (new PrivateStorage)->exists($payment->proof_storage_key)) {
            throw ApiException::notFound('Payment proof not found.');
        }
        AuditService::record($user, 'payment.proof_accessed', 'payment', $payment->id, null, ['invoice_id' => $payment->invoice_id]);

        return $payment;
    }

    /** All invoices across applications with period and status filtering. */
    public static function allInvoices(User $user, array $filters = [], int $perPage = 50): LengthAwarePaginator
    {
        if (! $user->hasAnyPermCodes(self::READ_PERMS)) {
            throw ApiException::forbidden('You do not have permission to view invoices.');
        }

        $q = Invoice::with(['application.applicant', 'payments.verifiedBy', 'createdBy']);

        if (! empty($filters['period_id'])) {
            $q->whereHas('application', fn ($app) => $app->where('admission_period_id', $filters['period_id']));
        }
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['type'])) {
            $q->where('type', $filters['type']);
        }
        if (! empty($filters['search'])) {
            $s = '%'.strtolower(trim($filters['search'])).'%';
            $q->where(function ($sub) use ($s) {
                $sub->whereRaw('LOWER(invoice_number) like ?', [$s])
                    ->orWhereHas('application', function ($app) use ($s) {
                        $app->whereRaw('LOWER(registration_number) like ?', [$s])
                            ->orWhereHas('applicant', fn ($appl) => $appl->whereRaw('LOWER(full_name) like ?', [$s]));
                    });
            });
        }

        return $q->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /** High-level finance summary cards for super admin & finance staff. */
    public static function financeSummary(User $user, ?string $periodId = null): array
    {
        if (! $user->hasAnyPermCodes(self::READ_PERMS)) {
            throw ApiException::forbidden('You do not have permission to view finance reports.');
        }

        $appQuery = Application::query();
        if ($periodId) {
            $appQuery->where('admission_period_id', $periodId);
        }
        $appIds = $appQuery->select('id');

        $invoices = fn () => Invoice::whereIn('application_id', $appIds);
        $payments = fn () => Payment::whereHas('invoice', fn ($i) => $i->whereIn('application_id', $appIds));

        return [
            'pending_payments' => $payments()->where('status', PaymentStatus::PENDING)->count(),
            'outstanding_invoices' => $invoices()->whereIn('status', InvoiceStatus::OUTSTANDING)->count(),
            'paid_invoices' => $invoices()->where('status', InvoiceStatus::PAID)->count(),
            'verified_amount' => (string) number_format((float) $payments()->where('status', PaymentStatus::PAID)->sum('amount'), 2, '.', ''),
            'total_invoiced_amount' => (string) number_format((float) $invoices()->where('status', '!=', InvoiceStatus::CANCELLED)->sum('amount'), 2, '.', ''),
        ];
    }

    /** Export verified payments log for financial audit / spreadsheet. */
    public static function exportPayments(User $user, ?string $periodId = null): Collection
    {
        if (! $user->hasAnyPermCodes(self::READ_PERMS)) {
            throw ApiException::forbidden('You do not have permission to export finance data.');
        }

        $q = Payment::with(['invoice.application.applicant', 'verifiedBy'])
            ->where('status', PaymentStatus::PAID);

        if ($periodId) {
            $q->whereHas('invoice.application', fn ($app) => $app->where('admission_period_id', $periodId));
        }

        return $q->orderBy('verified_at', 'desc')->get();
    }
}

