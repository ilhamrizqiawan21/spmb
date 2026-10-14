<?php

namespace App\Http\Controllers\Api;

use App\Services\ReportService;
use App\Support\TableExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Staff dashboard (PRD §11) and CSV/XLSX/PDF reports (PRD §14); permissions are set per route. */
class ReportController extends ApiController
{
    public function summary(Request $request): JsonResponse
    {
        return response()->json(ReportService::summary($request->user(), $this->filters($request)));
    }

    public function applications(Request $request): Response
    {
        return TableExport::download($this->exportFormat($request), 'pendaftar', 'Laporan Pendaftar',
            ReportService::APPLICATION_HEADERS, ReportService::applicationRows($this->filters($request)));
    }

    public function selection(Request $request): Response
    {
        return TableExport::download($this->exportFormat($request), 'hasil-seleksi', 'Laporan Hasil Seleksi',
            ReportService::SELECTION_HEADERS, ReportService::selectionRows($this->filters($request)), [3, 4]);
    }

    public function payments(Request $request): Response
    {
        return TableExport::download($this->exportFormat($request), 'pembayaran', 'Laporan Pembayaran',
            ReportService::PAYMENT_HEADERS, ReportService::paymentRows($this->filters($request)), [4, 6]);
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
