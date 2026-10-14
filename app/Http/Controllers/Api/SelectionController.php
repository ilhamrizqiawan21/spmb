<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Resources\ApplicationDecisionResource;
use App\Http\Resources\ApplicationScoreResource;
use App\Http\Resources\AssessmentResource;
use App\Http\Resources\AssessmentScheduleResource;
use App\Http\Resources\SelectionComponentResource;
use App\Http\Resources\WaitingListEntryResource;
use App\Models\ApplicationDecision;
use App\Models\ApplicationScore;
use App\Models\AssessmentSchedule;
use App\Models\SelectionComponent;
use App\Services\AnnouncementService;
use App\Services\ApplicationService;
use App\Services\AssessmentService;
use App\Services\DecisionService;
use App\Services\SelectionComponentService;
use App\Services\WaitingListService;
use App\Support\DecisionType;
use App\Support\ScheduleStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SelectionController extends ApiController
{
    // ---- Components ------------------------------------------------------------

    public function components(Request $request)
    {
        $periodId = $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id');

        return SelectionComponentResource::collection(SelectionComponentService::list($periodId));
    }

    public function storeComponent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_period_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'weight' => ['required', 'numeric', 'between:0,100'],
            'max_score' => ['sometimes', 'numeric', 'min:0.01', 'max:999999.99'],
            'minimum_score' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'sort_order' => ['sometimes', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return $this->created(new SelectionComponentResource(SelectionComponentService::create($data)->load('admissionPeriod')));
    }

    public function showComponent(string $id): SelectionComponentResource
    {
        return new SelectionComponentResource($this->component($id));
    }

    public function updateComponent(Request $request, string $id): SelectionComponentResource
    {
        $component = $this->component($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['sometimes', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string'],
            'weight' => ['sometimes', 'numeric', 'between:0,100'],
            'max_score' => ['sometimes', 'numeric', 'min:0.01', 'max:999999.99'],
            'minimum_score' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
            'sort_order' => ['sometimes', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return new SelectionComponentResource(SelectionComponentService::update($component, $data)->load('admissionPeriod'));
    }

    public function destroyComponent(string $id)
    {
        SelectionComponentService::delete($this->component($id));

        return $this->noContent();
    }

    // ---- Schedules & assessments -----------------------------------------------

    public function schedules(Request $request)
    {
        $q = AssessmentSchedule::with(['application.applicant', 'component'])->orderBy('scheduled_at');
        if ($appId = $this->uuidQuery($request->query('application_id'), 'application_id')) {
            $q->where('application_id', $appId);
        }

        return AssessmentScheduleResource::collection($q->get());
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'application_id' => ['required', 'uuid'],
            'component_id' => ['required', 'uuid'],
            'scheduled_at' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:255'],
            'room' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['scheduled_at'] = $this->dt($data['scheduled_at']);

        return $this->created(new AssessmentScheduleResource(AssessmentService::createSchedule($request->user(), $data)));
    }

    public function updateSchedule(Request $request, string $id): AssessmentScheduleResource
    {
        $data = $request->validate([
            'scheduled_at' => ['sometimes', 'date'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'room' => ['sometimes', 'nullable', 'string', 'max:100'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', Rule::in([ScheduleStatus::SCHEDULED, ScheduleStatus::CANCELLED, ScheduleStatus::NO_SHOW])],
        ]);
        if (isset($data['scheduled_at'])) {
            $data['scheduled_at'] = $this->dt($data['scheduled_at']);
        }

        return new AssessmentScheduleResource(AssessmentService::updateSchedule($id, $data));
    }

    public function applicationSchedules(Request $request, string $applicationId)
    {
        $application = ApplicationService::getForUser($request->user(), $applicationId);

        return AssessmentScheduleResource::collection(
            AssessmentSchedule::with(['application.applicant', 'component'])
                ->where('application_id', $application->id)->orderBy('scheduled_at')->get()
        );
    }

    public function inputScore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'application_id' => ['required', 'uuid'],
            'component_id' => ['required', 'uuid'],
            'score' => ['required', 'numeric'],
            'notes' => ['nullable', 'string'],
        ]);

        return $this->ok(new AssessmentResource(AssessmentService::inputScore(
            $request->user(), $data['application_id'], $data['component_id'], (string) $data['score'], $data['notes'] ?? null
        )));
    }

    public function applicationScore(Request $request, string $applicationId): ApplicationScoreResource
    {
        $application = ApplicationService::getForUser($request->user(), $applicationId);
        $score = ApplicationScore::with('application.applicant')->where('application_id', $application->id)->first()
            ?? throw ApiException::notFound('Score summary not found for this application.');

        return new ApplicationScoreResource($score);
    }

    // ---- Ranking & decisions ---------------------------------------------------

    public function ranking(string $periodId)
    {
        $scores = ApplicationScore::with('application.applicant')
            ->whereHas('application', fn ($q) => $q->where('admission_period_id', $periodId))
            ->orderBy('rank')->get();

        return ApplicationScoreResource::collection($scores);
    }

    public function runRanking(string $periodId)
    {
        return ApplicationScoreResource::collection(AssessmentService::rankPeriod($periodId));
    }

    public function decision(Request $request, string $applicationId): ApplicationDecisionResource
    {
        $application = ApplicationService::getForUser($request->user(), $applicationId);
        $decision = ApplicationDecision::with(['application.applicant', 'decidedBy', 'histories.changedBy'])
            ->where('application_id', $application->id)->first()
            ?? throw ApiException::notFound('Admission decision not found for this application.');

        return new ApplicationDecisionResource($decision);
    }

    public function decide(Request $request, string $applicationId): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', Rule::in(DecisionType::ALL)], 'reason' => ['nullable', 'string']]);

        return $this->ok(new ApplicationDecisionResource(
            DecisionService::decide($request->user(), $applicationId, $data['decision'], $data['reason'] ?? null)
        ));
    }

    public function waitingList(string $periodId)
    {
        return WaitingListEntryResource::collection(WaitingListService::list($periodId));
    }

    public function promote(Request $request, string $entryId): WaitingListEntryResource
    {
        $data = $request->validate(['reason' => ['required', 'string']]);

        return new WaitingListEntryResource(WaitingListService::promote($request->user(), $entryId, $data['reason']));
    }

    // ---- Announcements ---------------------------------------------------------

    public function publish(Request $request, string $periodId): JsonResponse
    {
        $data = $request->validate(['published_at' => ['nullable', 'date']]);
        $count = AnnouncementService::publishPeriod($request->user(), $periodId, $this->dt($data['published_at'] ?? null));

        return response()->json(['published_count' => $count, 'detail' => 'Announcements published successfully.']);
    }

    public function announcement(Request $request, string $applicationId): JsonResponse
    {
        return response()->json(AnnouncementService::result($request->user(), $applicationId));
    }

    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate(['registration_number' => ['required', 'string'], 'birth_date' => ['required', 'date_format:Y-m-d']]);

        return response()->json(AnnouncementService::publicLookup($data['registration_number'], $data['birth_date']));
    }

    public function letter(Request $request, string $applicationId)
    {
        [$filename, $pdf] = AnnouncementService::resultLetter($request->user(), $applicationId);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function component(string $id): SelectionComponent
    {
        return SelectionComponent::with('admissionPeriod')->find($id) ?? throw ApiException::notFound('Selection component not found.');
    }
}
