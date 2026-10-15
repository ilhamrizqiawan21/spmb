<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Services\PaymentService;
use App\Support\PaymentStatus;
use App\Support\PrivateStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Manual invoice/payment flow. Authorization lives in PaymentService. */
class FinanceController extends ApiController
{
    private const MONEY = ['required', 'regex:/^\d{1,13}(\.\d{1,2})?$/', 'gt:0'];

    public function invoices(Request $request, string $applicationId)
    {
        return InvoiceResource::collection(PaymentService::invoicesFor($request->user(), $applicationId));
    }

    public function storeInvoice(Request $request, string $applicationId): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'max:50'],
            'amount' => self::MONEY,
            'due_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
        ]);
        $data['amount'] = (string) $data['amount'];
        $data['due_date'] = $this->dt($data['due_date'] ?? null);

        return $this->created(new InvoiceResource(PaymentService::createInvoice($request->user(), $applicationId, $data)));
    }

    public function cancelInvoice(Request $request, string $id): InvoiceResource
    {
        $data = $request->validate(['reason' => ['required', 'string']]);

        return new InvoiceResource(PaymentService::cancelInvoice($request->user(), $id, $data['reason']));
    }

    public function submitPayment(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'amount' => self::MONEY,
            'method' => ['required', 'string', 'max:50'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'paid_at' => ['nullable', 'date'],
            'proof' => ['required', 'file'],
        ]);
        $data['amount'] = (string) $data['amount'];
        $data['paid_at'] = $this->dt($data['paid_at'] ?? null);

        return $this->created(new PaymentResource(
            PaymentService::submitPayment($request->user(), $id, $data, $request->file('proof'))
        ));
    }

    public function payments(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in([PaymentStatus::PENDING, PaymentStatus::PAID, PaymentStatus::REJECTED, PaymentStatus::REFUNDED])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);
        $page = PaymentService::queue($request->user(), $data['status'] ?? null, (int) ($data['per_page'] ?? 50));

        return response()->json([
            'data' => PaymentResource::collection($page->getCollection())->resolve($request),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function verify(Request $request, string $id): PaymentResource
    {
        $data = $request->validate(['approved' => ['required', 'boolean'], 'note' => ['nullable', 'string']]);

        return new PaymentResource(PaymentService::verifyPayment($request->user(), $id, (bool) $data['approved'], $data['note'] ?? null));
    }

    public function proof(Request $request, string $id): StreamedResponse
    {
        $payment = PaymentService::proofFor($request->user(), $id);
        $storage = new PrivateStorage;

        return response()->streamDownload(function () use ($storage, $payment) {
            $stream = $storage->readStream($payment->proof_storage_key);
            fpassthru($stream);
            fclose($stream);
        }, $payment->proof_original_filename ?: 'proof', ['Content-Type' => $payment->proof_mime_type]);
    }

    public function summary(Request $request): JsonResponse
    {
        $periodId = $request->query('period_id');

        return response()->json(PaymentService::financeSummary($request->user(), $periodId ? (string) $periodId : null));
    }

    public function allInvoices(Request $request): JsonResponse
    {
        $filters = [
            'period_id' => $request->query('period_id'),
            'status' => $request->query('status'),
            'type' => $request->query('type'),
            'search' => $request->query('search'),
        ];
        $perPage = (int) ($request->query('per_page') ?? 50);
        $page = PaymentService::allInvoices($request->user(), $filters, $perPage);

        return response()->json([
            'data' => InvoiceResource::collection($page->getCollection())->resolve($request),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function storeBulkInvoices(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_period_id' => ['required', 'uuid'],
            'application_status' => ['required', 'string'],
            'type' => ['required', 'string', 'max:50'],
            'amount' => self::MONEY,
            'due_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
        ]);
        $data['amount'] = (string) $data['amount'];
        $data['due_date'] = $this->dt($data['due_date'] ?? null);

        $result = PaymentService::createBulkInvoices($request->user(), $data);

        return response()->json([
            'message' => "Berhasil menerbitkan {$result['created']} tagihan baru ({$result['skipped']} pendaftar dilewati karena sudah memiliki tagihan aktif).",
            'result' => $result,
        ], 201);
    }

    public function exportPayments(Request $request): JsonResponse
    {
        $periodId = $request->query('period_id');
        $payments = PaymentService::exportPayments($request->user(), $periodId ? (string) $periodId : null);

        return response()->json([
            'data' => PaymentResource::collection($payments)->resolve($request),
        ]);
    }
}

