<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\EnrollmentCandidateResource;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use App\Services\EnrollmentService;
use App\Support\TableExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Enrollment of re-registered applicants and the official student list (ERD §14). */
class StudentController extends ApiController
{
    /** NIS is typed by staff: letters, digits and . / - only. */
    private const STUDENT_NUMBER = ['string', 'max:50', 'regex:/^[A-Za-z0-9.\/-]+$/'];

    public function eligible(Request $request)
    {
        $periodId = $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id');

        return EnrollmentCandidateResource::collection(EnrollmentService::eligible($periodId));
    }

    public function enroll(Request $request, string $applicationId): JsonResponse
    {
        $data = $request->validate([
            'student_number' => ['required', ...self::STUDENT_NUMBER],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->created(new StudentResource(
            EnrollmentService::enroll($request->user(), $applicationId, $data['student_number'], $data['notes'] ?? null)
        ));
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $perPage = (int) ($request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:200']])['per_page'] ?? 50);
        $page = EnrollmentService::studentsQuery($filters)->paginate($perPage);

        return response()->json([
            'data' => StudentResource::collection($page->getCollection())->resolve($request),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function update(Request $request, string $id): StudentResource
    {
        $data = $request->validate([
            'student_number' => ['sometimes', ...self::STUDENT_NUMBER],
            'nisn' => ['sometimes', 'nullable', 'string', 'regex:/^\d{10}$/'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $reason = $data['reason'];
        unset($data['reason']);

        return new StudentResource(EnrollmentService::updateStudent($request->user(), $id, $data, $reason));
    }

    public function forApplication(Request $request, string $applicationId): JsonResponse
    {
        $student = EnrollmentService::forApplication($request->user(), $applicationId);

        return response()->json(['data' => $student ? (new StudentResource($student))->resolve($request) : null]);
    }

    public function export(Request $request): Response
    {
        $rows = EnrollmentService::studentsQuery($this->filters($request))->lazy(500)->map(fn (Student $s) => [
            $s->student_number, $s->nisn, $s->full_name, $s->gender, $s->birth_place, $s->birth_date?->toDateString(),
            $s->status, $s->enrollment->application->registration_number,
            $s->enrollment->application->admissionPeriod?->name, $s->enrollment->application->admissionPeriod?->academicYear?->name,
            $s->enrollment->enrolled_at,
        ]);

        return TableExport::download($this->exportFormat($request), 'siswa', 'Data Siswa Baru', [
            'NIS', 'NISN', 'Nama Lengkap', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir',
            'Status', 'No. Pendaftaran', 'Gelombang', 'Tahun Ajaran', 'Tanggal Enrollment',
        ], $rows);
    }

    /** @return array{academic_year_id:?string,admission_period_id:?string,search:?string} */
    private function filters(Request $request): array
    {
        $search = $request->validate(['search' => ['nullable', 'string', 'max:100']])['search'] ?? null;

        return [
            'academic_year_id' => $this->uuidQuery($request->query('academic_year_id'), 'academic_year_id'),
            'admission_period_id' => $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id'),
            'search' => $search,
        ];
    }
}
