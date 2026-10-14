<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\ApplicationDocument;
use App\Models\DocumentRequirement;
use App\Models\DocumentRevision;
use App\Models\User;
use App\Support\ApplicationStatus;
use App\Support\DocumentStatus;
use App\Support\PrivateStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/** Document upload (versioned, private storage), verification, and revision requests. */
class DocumentService
{
    public static function upload(User $user, string $applicationId, string $requirementId, UploadedFile $file): ApplicationDocument
    {
        $application = ApplicationService::getForUser($user, $applicationId);
        ApplicantService::checkModify($user, $application->applicant);

        $requirement = DocumentRequirement::where('is_active', true)->find($requirementId)
            ?? throw ApiException::notFound('Document requirement not found or inactive.', 'requirement_id');

        $size = $file->getSize();
        if ($requirement->max_file_size_bytes && $size > $requirement->max_file_size_bytes) {
            $mb = number_format($requirement->max_file_size_bytes / (1024 * 1024), 1);
            throw ApiException::validation(['file' => "File size exceeds maximum limit of {$mb} MB."]);
        }

        // Server-side detected MIME type (never trust the client-declared one).
        $mime = $file->getMimeType() ?: 'application/octet-stream';
        $allowed = $requirement->allowed_mime_types ?: [];
        if ($allowed && ! in_array($mime, $allowed, true)) {
            throw ApiException::validation(['file' => "MIME type '{$mime}' is not allowed."]);
        }

        $content = $file->get();
        $storageKey = (new PrivateStorage)->put($content);

        return DB::transaction(function () use ($application, $requirement, $file, $mime, $size, $content, $storageKey) {
            $existing = ApplicationDocument::where('application_id', $application->id)
                ->where('requirement_id', $requirement->id)->orderByDesc('version')->first();

            if ($existing) {
                DocumentRevision::where('application_document_id', $existing->id)
                    ->whereNull('resolved_at')->update(['resolved_at' => now()]);
            }

            $document = ApplicationDocument::create([
                'application_id' => $application->id,
                'requirement_id' => $requirement->id,
                'storage_key' => $storageKey,
                'original_filename' => $file->getClientOriginalName() ?: 'document',
                'mime_type' => $mime,
                'file_size' => $size,
                'checksum' => hash('sha256', $content),
                'status' => DocumentStatus::PENDING,
                'uploaded_at' => now(),
                'version' => $existing ? $existing->version + 1 : 1,
            ]);

            [$perc, $step] = ApplicationService::completion($application);
            $application->update(['completion_percentage' => $perc, 'current_step' => $step]);

            return $document->load(['requirement', 'verifiedBy', 'revisions.requestedBy']);
        });
    }

    public static function findForAccess(User $user, string $id): ApplicationDocument
    {
        $document = ApplicationDocument::with(['application.applicant'])->find($id)
            ?? throw ApiException::notFound('Document not found.');
        ApplicantService::checkAccess($user, $document->application->applicant);
        if (! (new PrivateStorage)->exists($document->storage_key)) {
            throw ApiException::notFound('Storage object not found.');
        }

        AuditService::record($user, 'document.accessed', 'application_document', $document->id, null, ['application_id' => $document->application_id]);

        return $document;
    }

    public static function verify(User $user, string $id, bool $isValid, ?string $note): ApplicationDocument
    {
        $document = ApplicationDocument::find($id) ?? throw ApiException::notFound('Document not found.');
        $previousStatus = $document->status;
        $document->update([
            'status' => $isValid ? DocumentStatus::VALID : DocumentStatus::INVALID,
            'verified_at' => now(),
            'verified_by' => $user->id,
            'verification_note' => $note,
        ]);
        AuditService::record($user, 'document.verified', 'application_document', $document->id, ['status' => $previousStatus], ['status' => $document->status], $note);

        return $document->load(['requirement', 'verifiedBy', 'revisions.requestedBy']);
    }

    public static function requestRevision(User $user, string $id, string $reason): ApplicationDocument
    {
        return DB::transaction(function () use ($user, $id, $reason) {
            $document = ApplicationDocument::with('application')->find($id)
                ?? throw ApiException::notFound('Document not found.');
            $previousStatus = $document->status;
            $document->update(['status' => DocumentStatus::REVISION_REQUIRED, 'verification_note' => $reason]);
            AuditService::record($user, 'document.revision_requested', 'application_document', $document->id, ['status' => $previousStatus], ['status' => DocumentStatus::REVISION_REQUIRED], $reason);

            DocumentRevision::create([
                'application_document_id' => $document->id,
                'requested_by' => $user->id,
                'reason' => $reason,
            ]);

            $app = $document->application;
            if ($app->status === ApplicationStatus::UNDER_VERIFICATION) {
                ApplicationStateMachine::transition($user, $app, ApplicationStatus::REVISION_REQUIRED, "Document revision requested: {$reason}");
            }

            return $document->load(['requirement', 'verifiedBy', 'revisions.requestedBy']);
        });
    }
}
