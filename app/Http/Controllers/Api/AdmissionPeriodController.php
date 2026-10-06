<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Resources\AdmissionPeriodResource;
use App\Http\Resources\AvailabilityResource;
use App\Models\AdmissionPeriod;
use App\Services\AdmissionPeriodService;
use App\Services\RegistrationAvailabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdmissionPeriodController extends ApiController
{
    public function index(Request $request)
    {
        $q = AdmissionPeriod::orderBy('registration_start');
        if ($ay = $this->uuidQuery($request->query('academic_year_id'), 'academic_year_id')) {
            $q->where('academic_year_id', $ay);
        }
        if ($request->query('is_active') !== null) {
            $q->where('is_active', in_array(strtolower((string) $request->query('is_active')), ['true', '1'], true));
        }

        return AdmissionPeriodResource::collection($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:100'],
            'registration_start' => ['required', 'date'],
            'registration_end' => ['required', 'date'],
            'announcement_at' => ['nullable', 'date'],
            'quota' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);
        $data = $this->normalise($data);
        $this->assertRules($data['registration_start'], $data['registration_end'], $data['announcement_at'] ?? null, $data['quota'] ?? null);

        return $this->created(new AdmissionPeriodResource(AdmissionPeriodService::create($data)));
    }

    public function show(string $id): AdmissionPeriodResource
    {
        return new AdmissionPeriodResource($this->find($id));
    }

    public function update(Request $request, string $id): AdmissionPeriodResource
    {
        $period = $this->find($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['sometimes', 'string', 'max:100'],
            'registration_start' => ['sometimes', 'date'],
            'registration_end' => ['sometimes', 'date'],
            'announcement_at' => ['sometimes', 'nullable', 'date'],
            'quota' => ['sometimes', 'nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'nullable', 'array'],
        ]);
        $data = $this->normalise($data);

        $this->assertRules(
            $data['registration_start'] ?? $period->registration_start,
            $data['registration_end'] ?? $period->registration_end,
            array_key_exists('announcement_at', $data) ? $data['announcement_at'] : $period->announcement_at,
            array_key_exists('quota', $data) ? $data['quota'] : $period->quota,
        );

        return new AdmissionPeriodResource(AdmissionPeriodService::update($period, $data));
    }

    public function destroy(string $id)
    {
        $this->find($id)->delete();

        return $this->noContent();
    }

    public function availability(string $id): AvailabilityResource
    {
        return new AvailabilityResource(RegistrationAvailabilityService::forPeriod($id));
    }

    private function find(string $id): AdmissionPeriod
    {
        return AdmissionPeriod::find($id) ?? throw ApiException::notFound('Admission period not found.');
    }

    private function normalise(array $data): array
    {
        foreach (['registration_start', 'registration_end', 'announcement_at'] as $f) {
            if (array_key_exists($f, $data)) {
                $data[$f] = $this->dt($data[$f]);
            }
        }

        return $data;
    }

    private function assertRules($start, $end, $announcement, $quota): void
    {
        if ($start->gte($end)) {
            throw ApiException::validation(['registration_start' => 'Registration start must be before registration end.']);
        }
        if ($announcement && $announcement->lt($end)) {
            throw ApiException::validation(['announcement_at' => 'Announcement date cannot be earlier than registration end.']);
        }
        if ($quota !== null && $quota < 0) {
            throw ApiException::validation(['quota' => 'Quota must be non-negative.']);
        }
    }
}
