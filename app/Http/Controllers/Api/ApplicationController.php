<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Resources\ApplicationDocumentResource;
use App\Http\Resources\ApplicationResource;
use App\Http\Resources\DocumentRequirementResource;
use App\Models\ApplicationDocument;
use App\Models\DocumentRequirement;
use App\Services\ApplicationService;
use App\Services\ApplicationStateMachine;
use App\Services\AuditService;
use App\Services\DocumentRequirementService;
use App\Services\DocumentService;
use App\Support\ApplicationStatus;
use App\Support\PrivateStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApplicationController extends ApiController
{
    public function index(Request $request)
    {
        return ApplicationResource::collection(ApplicationService::listForUser($request->user())->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['applicant_id' => ['required', 'uuid'], 'admission_period_id' => ['required', 'uuid']]);
        $application = ApplicationService::createDraft($request->user(), $data['applicant_id'], $data['admission_period_id']);

        return $this->created(new ApplicationResource($application));
    }

    public function show(Request $request, string $id): ApplicationResource
    {
        return new ApplicationResource(ApplicationService::getForUser($request->user(), $id));
    }

    public function submit(Request $request, string $id): ApplicationResource
    {
        return new ApplicationResource(ApplicationService::submit($request->user(), $id));
    }

    public function transition(Request $request, string $id): ApplicationResource
    {
        $application = ApplicationService::getForUser($request->user(), $id);
        $data = $request->validate([
            'to_status' => ['required', Rule::in(ApplicationStatus::all())],
            'reason' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        return new ApplicationResource(ApplicationStateMachine::transition(
            $request->user(), $application, $data['to_status'], $data['reason'] ?? null, $data['metadata'] ?? null
        ));
    }

    // ---- Document requirements -------------------------------------------------

    public function requirements(Request $request)
    {
        $periodId = $this->uuidQuery($request->query('admission_period_id'), 'admission_period_id');

        return DocumentRequirementResource::collection(DocumentRequirementService::list($periodId));
    }

    public function storeRequirement(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_period_id' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'is_required' => ['sometimes', 'boolean'],
            'allowed_mime_types' => ['sometimes', 'array'],
            'allowed_mime_types.*' => ['string'],
            'max_file_size_bytes' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        return $this->created(new DocumentRequirementResource(DocumentRequirementService::create($data)));
    }

    public function showRequirement(string $id): DocumentRequirementResource
    {
        return new DocumentRequirementResource($this->requirement($id));
    }

    public function updateRequirement(Request $request, string $id): DocumentRequirementResource
    {
        $req = $this->requirement($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['sometimes', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string'],
            'is_required' => ['sometimes', 'boolean'],
            'allowed_mime_types' => ['sometimes', 'array'],
            'allowed_mime_types.*' => ['string'],
            'max_file_size_bytes' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        return new DocumentRequirementResource(DocumentRequirementService::update($req, $data));
    }

    public function destroyRequirement(string $id)
    {
        DocumentRequirementService::delete($this->requirement($id));

        return $this->noContent();
    }

    // ---- Documents -------------------------------------------------------------

    public function documents(Request $request, string $applicationId)
    {
        $application = ApplicationService::getForUser($request->user(), $applicationId);
        $docs = ApplicationDocument::with(['requirement', 'verifiedBy', 'revisions.requestedBy'])
            ->where('application_id', $application->id)
            ->orderBy('requirement_id')->orderByDesc('version')->get();

        return ApplicationDocumentResource::collection($docs);
    }

    public function upload(Request $request, string $applicationId): JsonResponse
    {
        $requirementId = $request->input('requirement_id');
        $file = $request->file('file');
        if (! $requirementId || ! $file) {
            throw ApiException::validation(['detail' => 'Both requirement_id and file are required.']);
        }
        if (! Str::isUuid((string) $requirementId)) {
            throw ApiException::validation(['requirement_id' => 'Invalid requirement ID format.']);
        }

        $document = DocumentService::upload($request->user(), $applicationId, strtolower((string) $requirementId), $file);

        return $this->created(new ApplicationDocumentResource($document));
    }

    public function download(Request $request, string $id): StreamedResponse
    {
        $storage = new PrivateStorage;

        if ($token = $request->query('token')) {
            try {
                $key = $storage->verifyToken((string) $token);
            } catch (\RuntimeException $e) {
                throw ApiException::forbidden($e->getMessage());
            }
            $document = ApplicationDocument::find($id) ?? throw ApiException::notFound('Document not found.');
            if ($document->storage_key !== $key) {
                throw ApiException::forbidden('Token does not match document.');
            }
            AuditService::record(null, 'document.accessed', 'application_document', $document->id, null, ['application_id' => $document->application_id, 'via' => 'signed_token']);
        } else {
            $user = $request->user('sanctum') ?? throw ApiException::unauthenticated();
            $document = DocumentService::findForAccess($user, $id);
        }

        return response()->streamDownload(function () use ($storage, $document) {
            $stream = $storage->readStream($document->storage_key);
            fpassthru($stream);
            fclose($stream);
        }, $document->original_filename, ['Content-Type' => $document->mime_type]);
    }

    public function verifyDocument(Request $request, string $id): ApplicationDocumentResource
    {
        $data = $request->validate(['is_valid_doc' => ['required', 'boolean'], 'verification_note' => ['nullable', 'string']]);

        return new ApplicationDocumentResource(
            DocumentService::verify($request->user(), $id, (bool) $data['is_valid_doc'], $data['verification_note'] ?? null)
        );
    }

    public function requestRevision(Request $request, string $id): ApplicationDocumentResource
    {
        $data = $request->validate(['reason' => ['required', 'string']]);

        return new ApplicationDocumentResource(DocumentService::requestRevision($request->user(), $id, $data['reason']));
    }

    private function requirement(string $id): DocumentRequirement
    {
        return DocumentRequirement::find($id) ?? throw ApiException::notFound('Document requirement not found.');
    }
}
