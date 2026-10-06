<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\VerificationAssignmentResource;
use App\Http\Resources\VerificationQueueItemResource;
use App\Http\Resources\VerificationReviewResource;
use App\Models\VerificationReview;
use App\Services\VerificationService;
use App\Support\ApplicationStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VerificationController extends ApiController
{
    public function queue(Request $request)
    {
        $periodId = $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id');
        $items = VerificationService::queue(
            $request->user(), $request->query('assignment'), $request->query('status'), $periodId, $request->query('search')
        );

        return VerificationQueueItemResource::collection($items);
    }

    public function assign(Request $request): JsonResponse
    {
        $data = $request->validate(['application_id' => ['required', 'uuid'], 'verifier_id' => ['required', 'uuid']]);
        $assignment = VerificationService::assign($request->user(), $data['application_id'], $data['verifier_id']);

        return $this->created(new VerificationAssignmentResource($assignment));
    }

    public function reviews(string $applicationId)
    {
        return VerificationReviewResource::collection(
            VerificationReview::with('verifier')->where('application_id', $applicationId)->orderByDesc('created_at')->get()
        );
    }

    public function complete(Request $request, string $applicationId): JsonResponse
    {
        $data = $request->validate([
            'to_status' => ['required', Rule::in([ApplicationStatus::VERIFIED, ApplicationStatus::REVISION_REQUIRED, ApplicationStatus::REJECTED])],
            'notes' => ['nullable', 'string'],
        ]);

        return $this->ok(new VerificationReviewResource(
            VerificationService::complete($request->user(), $applicationId, $data['to_status'], $data['notes'] ?? null)
        ));
    }
}
