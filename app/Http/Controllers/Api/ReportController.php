<?php

namespace App\Http\Controllers\Api;

use App\Services\ReportService;
use App\Support\CsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Staff dashboard (PRD §11) and CSV reports (PRD §14); permissions are set per route. */
class ReportController extends ApiController
{
    public function summary(Request $request): JsonResponse
    {
        return response()->json(ReportService::summary($request->user(), $this->filters($request)));
    }

    public function applications(Request $request): StreamedResponse
    {
        return $this->csv('pendaftar', ReportService::APPLICATION_HEADERS, ReportService::applicationRows($this->filters($request)));
    }

    public function selection(Request $request): StreamedResponse
    {
        return $this->csv('hasil-seleksi', ReportService::SELECTION_HEADERS, ReportService::selectionRows($this->filters($request)));
    }

    public function payments(Request $request): StreamedResponse
    {
        return $this->csv('pembayaran', ReportService::PAYMENT_HEADERS, ReportService::paymentRows($this->filters($request)));
    }

    private function csv(string $name, array $headers, iterable $rows): StreamedResponse
    {
        return CsvExport::download("{$name}-".now()->format('Ymd-His').'.csv', $headers, $rows);
    }

    /** @return array{academic_year_id:?string,admission_period_id:?string} */
    private function filters(Request $request): array
    {
        return [
            'academic_year_id' => $this->uuidQuery($request->query('academic_year_id'), 'academic_year_id'),
            'admission_period_id' => $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id'),
        ];
    }
}
