<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Resources\AcademicYearResource;
use App\Models\AcademicYear;
use App\Services\AcademicYearService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademicYearController extends ApiController
{
    public function index()
    {
        return AcademicYearResource::collection(AcademicYear::orderByDesc('start_date')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->assertDates($data['start_date'], $data['end_date']);

        return $this->created(new AcademicYearResource(AcademicYearService::create($data)));
    }

    public function show(string $id): AcademicYearResource
    {
        return new AcademicYearResource($this->find($id));
    }

    public function update(Request $request, string $id): AcademicYearResource
    {
        $year = $this->find($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:50'],
            'start_date' => ['sometimes', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'date_format:Y-m-d'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $this->assertDates(
            $data['start_date'] ?? $year->start_date->toDateString(),
            $data['end_date'] ?? $year->end_date->toDateString(),
        );

        return new AcademicYearResource(AcademicYearService::update($year, $data));
    }

    public function destroy(string $id)
    {
        AcademicYearService::delete($this->find($id));

        return $this->noContent();
    }

    private function find(string $id): AcademicYear
    {
        return AcademicYear::find($id) ?? throw ApiException::notFound('Academic year not found.');
    }

    private function assertDates(string $start, string $end): void
    {
        if ($start >= $end) {
            throw ApiException::validation(['start_date' => 'Start date must be strictly before end date.']);
        }
    }
}
