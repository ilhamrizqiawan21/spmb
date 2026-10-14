<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Resources\ReRegistrationItemResource;
use App\Http\Resources\ReRegistrationRequirementResource;
use App\Http\Resources\ReRegistrationResource;
use App\Models\ReRegistrationRequirement;
use App\Services\ReRegistrationService;
use App\Support\ReRegistrationItemStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EnrollmentController extends ApiController
{
    public function requirements(Request $request)
    {
        $periodId = $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id');

        return ReRegistrationRequirementResource::collection(ReRegistrationService::listRequirements($periodId));
    }

    public function storeRequirement(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_period_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:100'],
            'is_required' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        return $this->created(new ReRegistrationRequirementResource(ReRegistrationService::createRequirement($data)));
    }

    public function showRequirement(string $id): ReRegistrationRequirementResource
    {
        return new ReRegistrationRequirementResource($this->requirement($id));
    }

    public function updateRequirement(Request $request, string $id): ReRegistrationRequirementResource
    {
        $req = $this->requirement($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['sometimes', 'string', 'max:100'],
            'is_required' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        return new ReRegistrationRequirementResource(ReRegistrationService::updateRequirement($req, $data));
    }

    public function destroyRequirement(string $id)
    {
        ReRegistrationService::deleteRequirement($this->requirement($id));

        return $this->noContent();
    }

    public function start(Request $request, string $applicationId): JsonResponse
    {
        return $this->created(new ReRegistrationResource(ReRegistrationService::start($request->user(), $applicationId)));
    }

    public function show(Request $request, string $applicationId): ReRegistrationResource
    {
        return new ReRegistrationResource(ReRegistrationService::forApplication($request->user(), $applicationId));
    }

    public function updateItem(Request $request, string $itemId): ReRegistrationItemResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(ReRegistrationItemStatus::ALL)],
            'notes' => ['nullable', 'string'],
        ]);

        return new ReRegistrationItemResource(
            ReRegistrationService::updateItem($request->user(), $itemId, $data['status'], $data['notes'] ?? null)
        );
    }

    public function complete(Request $request, string $reRegistrationId): ReRegistrationResource
    {
        return new ReRegistrationResource(ReRegistrationService::complete($request->user(), $reRegistrationId));
    }

    private function requirement(string $id): ReRegistrationRequirement
    {
        return ReRegistrationRequirement::with('admissionPeriod')->find($id)
            ?? throw ApiException::notFound('Re-registration requirement not found.');
    }
}
