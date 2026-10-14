<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\MplsAttendanceResource;
use App\Http\Resources\MplsEventResource;
use App\Http\Resources\MplsGroupResource;
use App\Http\Resources\MplsParticipantResource;
use App\Http\Resources\StudentResource;
use App\Models\MplsParticipant;
use App\Services\MplsAttendanceService;
use App\Services\MplsService;
use App\Support\CsvExport;
use App\Support\MplsAttendanceStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** MPLS groups, events, participants and attendance (ERD §15). Staff routes need `mpls.manage`. */
class MplsController extends ApiController
{
    // ---- groups -------------------------------------------------------------

    public function groups(Request $request)
    {
        return MplsGroupResource::collection(MplsService::groups($this->year($request)));
    }

    public function storeGroup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'uuid'],
            ...$this->groupRules('required'),
        ]);

        return $this->created(new MplsGroupResource(MplsService::createGroup($request->user(), $data)));
    }

    public function updateGroup(Request $request, string $id): MplsGroupResource
    {
        return new MplsGroupResource(MplsService::updateGroup($request->user(), $id, $request->validate($this->groupRules('sometimes'))));
    }

    public function destroyGroup(Request $request, string $id)
    {
        MplsService::deleteGroup($request->user(), $id);

        return $this->noContent();
    }

    private function groupRules(string $presence): array
    {
        return [
            'name' => [$presence, 'string', 'max:150'],
            'code' => [$presence, 'string', 'max:50'],
            'capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:10000'],
            'mentor_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
        ];
    }

    // ---- events -------------------------------------------------------------

    public function events(Request $request)
    {
        return MplsEventResource::collection(MplsService::events($this->year($request), $this->uuidQuery($request->query('group_id'), 'group_id')));
    }

    public function storeEvent(Request $request): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['nullable', 'uuid'],
            'group_id' => ['nullable', 'uuid'],
            ...$this->eventRules('required'),
        ]);

        return $this->created(new MplsEventResource(MplsService::createEvent($request->user(), $this->eventDates($data))));
    }

    public function updateEvent(Request $request, string $id): MplsEventResource
    {
        $data = $request->validate(['group_id' => ['sometimes', 'nullable', 'uuid'], ...$this->eventRules('sometimes')]);

        return new MplsEventResource(MplsService::updateEvent($request->user(), $id, $this->eventDates($data)));
    }

    public function destroyEvent(Request $request, string $id)
    {
        MplsService::deleteEvent($request->user(), $id);

        return $this->noContent();
    }

    private function eventRules(string $presence): array
    {
        return [
            'title' => [$presence, 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'start_at' => [$presence, 'date'],
            'end_at' => [$presence, 'date'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_mandatory' => ['sometimes', 'boolean'],
        ];
    }

    private function eventDates(array $data): array
    {
        foreach (['start_at', 'end_at'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = $this->dt($data[$field]);
            }
        }

        return $data;
    }

    // ---- participants -------------------------------------------------------

    public function participants(Request $request): JsonResponse
    {
        $data = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'per_page' => ['nullable', 'integer', 'min:1', 'max:200']]);
        $page = MplsService::participantsQuery($this->year($request), $this->uuidQuery($request->query('group_id'), 'group_id'), $data['search'] ?? null)
            ->paginate((int) ($data['per_page'] ?? 50));

        return response()->json([
            'data' => MplsParticipantResource::collection($page->getCollection())->resolve($request),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function unassigned(Request $request)
    {
        return StudentResource::collection(MplsService::unassignedQuery($this->year($request))->limit(500)->get());
    }

    public function assign(Request $request): JsonResponse
    {
        $data = $request->validate(['student_id' => ['required', 'uuid'], 'group_id' => ['required', 'uuid']]);

        return (new MplsParticipantResource(MplsService::assign($request->user(), $data['student_id'], $data['group_id'])))
            ->response()->setStatusCode(200);
    }

    public function autoAssign(Request $request): JsonResponse
    {
        $data = $request->validate(['academic_year_id' => ['required', 'uuid']]);

        return response()->json(MplsService::autoAssign($request->user(), $data['academic_year_id']));
    }

    public function rotateToken(Request $request, string $id): MplsParticipantResource
    {
        return (new MplsParticipantResource(MplsService::rotateToken($request->user(), $id)))->withToken();
    }

    public function complete(Request $request, string $id): MplsParticipantResource
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:1000']]);

        return new MplsParticipantResource(MplsService::complete($request->user(), $id, $data['notes'] ?? null));
    }

    // ---- attendance ---------------------------------------------------------

    public function roster(Request $request, string $id): JsonResponse
    {
        ['event' => $event, 'rows' => $rows] = MplsAttendanceService::roster($id);

        return response()->json([
            'event' => (new MplsEventResource($event))->resolve($request),
            'rows' => $rows->map(fn ($r) => [
                'participant_id' => $r['participant']->id,
                'student_number' => $r['participant']->student->student_number,
                'full_name' => $r['participant']->student->full_name,
                'group_name' => $r['participant']->group->name,
                'attendance' => $r['attendance'] ? (new MplsAttendanceResource($r['attendance']))->resolve($request) : null,
            ])->values(),
        ]);
    }

    public function record(Request $request): MplsAttendanceResource
    {
        $data = $request->validate([
            'event_id' => ['required', 'uuid'],
            'participant_id' => ['required', 'uuid'],
            'status' => ['required', Rule::in(MplsAttendanceStatus::ALL)],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        return new MplsAttendanceResource(MplsAttendanceService::record(
            $request->user(), $data['event_id'], $data['participant_id'], $data['status'], $data['notes'] ?? null
        ));
    }

    public function scan(Request $request): JsonResponse
    {
        $data = $request->validate(['event_id' => ['required', 'uuid'], 'qr_token' => ['required', 'string', 'max:64']]);
        $result = MplsAttendanceService::scan($request->user(), $data['event_id'], trim($data['qr_token']));

        return response()->json([
            'attendance' => (new MplsAttendanceResource($result['attendance']))->resolve($request),
            'already_recorded' => $result['already_recorded'],
        ], $result['already_recorded'] ? 200 : 201);
    }

    // ---- parent portal & report ---------------------------------------------

    public function forApplication(Request $request, string $applicationId): JsonResponse
    {
        $info = MplsService::forApplication($request->user(), $applicationId);
        if (! $info) {
            return response()->json(['data' => null]);
        }
        $byEvent = $info['participant']->attendances->keyBy('event_id');

        return response()->json(['data' => [
            'participant' => (new MplsParticipantResource($info['participant']))->withToken()->resolve($request),
            'events' => $info['events']->map(fn ($e) => [
                ...(new MplsEventResource($e))->resolve($request),
                'attendance_status' => $byEvent->get($e->id)?->status,
            ])->values(),
        ]]);
    }

    public function export(Request $request): StreamedResponse
    {
        $rows = MplsService::participantsQuery($this->year($request), $this->uuidQuery($request->query('group_id'), 'group_id'), null)
            ->lazy(500)->map(fn (MplsParticipant $p) => [
                $p->student->student_number, $p->student->full_name, $p->group->code, $p->group->name, $p->status,
                $p->present_count, $p->sick_count, $p->permitted_count, $p->absent_count, $p->completed_at,
            ]);

        return CsvExport::download('peserta-mpls-'.now()->format('Ymd-His').'.csv', [
            'NIS', 'Nama', 'Kode Kelompok', 'Kelompok', 'Status', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Selesai',
        ], $rows);
    }

    private function year(Request $request): ?string
    {
        return $this->uuidQuery($request->query('academic_year_id'), 'academic_year_id');
    }
}
