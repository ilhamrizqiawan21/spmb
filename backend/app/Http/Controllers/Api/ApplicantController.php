<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ApplicantResource;
use App\Http\Resources\GuardianResource;
use App\Services\ApplicantService;
use App\Services\AuditService;
use App\Services\GuardianService;
use App\Support\GuardianRelationship;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ApplicantController extends ApiController
{
    private const FIELDS = [
        'nisn' => ['nullable', 'string', 'max:20'],
        'full_name' => ['string', 'max:200'],
        'nickname' => ['nullable', 'string', 'max:100'],
        'gender' => ['string', 'max:20'],
        'birth_place' => ['string', 'max:150'],
        'birth_date' => ['date_format:Y-m-d'],
        'religion' => ['nullable', 'string', 'max:50'],
        'nationality' => ['string', 'max:50'],
        'nik' => ['nullable', 'string', 'max:30'],
        'family_card_number' => ['nullable', 'string', 'max:30'],
        'address' => ['string'],
        'province' => ['nullable', 'string', 'max:100'],
        'city' => ['nullable', 'string', 'max:100'],
        'district' => ['nullable', 'string', 'max:100'],
        'village' => ['nullable', 'string', 'max:100'],
        'postal_code' => ['nullable', 'string', 'max:10'],
        'previous_school_name' => ['nullable', 'string', 'max:200'],
        'previous_school_npsn' => ['nullable', 'string', 'max:30'],
        'previous_school_address' => ['nullable', 'string'],
    ];

    private const REQUIRED = ['full_name', 'gender', 'birth_place', 'birth_date', 'address'];

    public function index(Request $request)
    {
        return ApplicantResource::collection(ApplicantService::listForUser($request->user())->get());
    }

    public function store(Request $request): JsonResponse
    {
        $rules = [];
        foreach (self::FIELDS as $f => $r) {
            $rules[$f] = in_array($f, self::REQUIRED, true) ? ['required', ...$r] : ($f === 'nationality' ? ['sometimes', ...$r] : $r);
        }
        $data = $request->validate($rules);
        $data = array_filter($data, fn ($v, $k) => $k !== 'nationality' || $v !== null, ARRAY_FILTER_USE_BOTH);

        return $this->created(new ApplicantResource(ApplicantService::create($request->user(), $data)));
    }

    public function show(Request $request, string $id): ApplicantResource
    {
        $applicant = ApplicantService::getForUser($request->user(), $id);
        // Staff opening someone else's applicant record is an auditable access.
        if ($applicant->owner_user_id !== $request->user()->id) {
            AuditService::log('applicant.viewed', $applicant, null, null, $request->user());
        }

        return new ApplicantResource($applicant);
    }

    public function update(Request $request, string $id): ApplicantResource
    {
        $applicant = ApplicantService::getForUser($request->user(), $id);
        $rules = [];
        foreach (self::FIELDS as $f => $r) {
            $rules[$f] = ['sometimes', ...(in_array($f, self::REQUIRED, true) ? ['required'] : []), ...$r];
        }
        $data = $request->validate($rules);

        return new ApplicantResource(ApplicantService::update($request->user(), $applicant, $data));
    }

    public function destroy(Request $request, string $id)
    {
        $applicant = ApplicantService::getForUser($request->user(), $id);
        ApplicantService::delete($request->user(), $applicant);

        return $this->noContent();
    }

    public function guardians(Request $request, string $applicantId)
    {
        return GuardianResource::collection(GuardianService::listForApplicant($request->user(), $applicantId));
    }

    public function storeGuardian(Request $request, string $applicantId): JsonResponse
    {
        $data = $request->validate($this->guardianRules(true));
        $guardian = GuardianService::create($request->user(), $applicantId, $data);

        return $this->created(new GuardianResource($guardian));
    }

    public function showGuardian(Request $request, string $applicantId, string $id): GuardianResource
    {
        return new GuardianResource(GuardianService::getForApplicant($request->user(), $applicantId, $id));
    }

    public function updateGuardian(Request $request, string $applicantId, string $id): GuardianResource
    {
        $guardian = GuardianService::getForApplicant($request->user(), $applicantId, $id);
        $data = $request->validate($this->guardianRules(false));

        return new GuardianResource(GuardianService::update($request->user(), $guardian, $data));
    }

    public function destroyGuardian(Request $request, string $applicantId, string $id)
    {
        $guardian = GuardianService::getForApplicant($request->user(), $applicantId, $id);
        GuardianService::delete($request->user(), $guardian);

        return $this->noContent();
    }

    private function guardianRules(bool $create): array
    {
        $req = $create ? ['required'] : ['sometimes'];

        return [
            'relationship' => [...$req, Rule::in(GuardianRelationship::ALL)],
            'full_name' => [...$req, 'string', 'max:200'],
            'nik' => ['sometimes', 'nullable', 'string', 'max:30'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'occupation' => ['sometimes', 'nullable', 'string', 'max:150'],
            'education' => ['sometimes', 'nullable', 'string', 'max:100'],
            'monthly_income' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999999.99'],
            'address' => ['sometimes', 'nullable', 'string'],
            'is_primary_contact' => ['sometimes', 'boolean'],
        ];
    }
}
