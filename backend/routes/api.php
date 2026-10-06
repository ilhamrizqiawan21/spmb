<?php

use App\Http\Controllers\Api\AcademicYearController;
use App\Http\Controllers\Api\AdmissionPeriodController;
use App\Http\Controllers\Api\ApplicantController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\SelectionController;
use App\Http\Controllers\Api\VerificationController;
use Illuminate\Support\Facades\Route;

// Malformed UUIDs resolve to 404 instead of reaching the database.
foreach (['id', 'applicantId', 'applicationId', 'periodId', 'entryId', 'itemId', 'reRegistrationId'] as $param) {
    Route::pattern($param, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');
}

$verify = 'permission:document.verify,application.verify,application.override';
$override = 'permission:application.override';
$approve = 'permission:assessment.approve,application.override';
$assess = 'permission:assessment.input,assessment.approve,application.override';
$enrollment = 'permission:enrollment.manage,application.override';

// Routes are served under /api/v1 (Laravel's default `api` prefix + `v1`).
Route::prefix('v1')->group(function () use ($verify, $override, $approve, $assess, $enrollment) {

    // ---- Auth ----------------------------------------------------------------
    Route::prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register'])->middleware('throttle:20,1');
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:30,1');
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
        });
    });

    // ---- Admission -----------------------------------------------------------
    Route::prefix('admission')->group(function () use ($verify, $override) {
        // Public reads
        Route::get('periods', [AdmissionPeriodController::class, 'index']);
        Route::get('periods/{id}', [AdmissionPeriodController::class, 'show']);
        Route::get('periods/{id}/availability', [AdmissionPeriodController::class, 'availability']);
        Route::get('document-requirements', [ApplicationController::class, 'requirements']);
        Route::get('document-requirements/{id}', [ApplicationController::class, 'showRequirement']);
        // Download accepts either a signed token (public) or a bearer token (checked in controller).
        Route::get('documents/{id}/download', [ApplicationController::class, 'download']);

        Route::middleware('auth:sanctum')->group(function () use ($verify, $override) {
            Route::get('academic-years', [AcademicYearController::class, 'index']);
            Route::get('academic-years/{id}', [AcademicYearController::class, 'show']);

            Route::middleware($override)->group(function () {
                Route::post('academic-years', [AcademicYearController::class, 'store']);
                Route::patch('academic-years/{id}', [AcademicYearController::class, 'update']);
                Route::delete('academic-years/{id}', [AcademicYearController::class, 'destroy']);
                Route::post('periods', [AdmissionPeriodController::class, 'store']);
                Route::patch('periods/{id}', [AdmissionPeriodController::class, 'update']);
                Route::delete('periods/{id}', [AdmissionPeriodController::class, 'destroy']);
                Route::post('document-requirements', [ApplicationController::class, 'storeRequirement']);
                Route::patch('document-requirements/{id}', [ApplicationController::class, 'updateRequirement']);
                Route::delete('document-requirements/{id}', [ApplicationController::class, 'destroyRequirement']);
            });

            Route::get('applicants', [ApplicantController::class, 'index']);
            Route::post('applicants', [ApplicantController::class, 'store']);
            Route::get('applicants/{id}', [ApplicantController::class, 'show']);
            Route::patch('applicants/{id}', [ApplicantController::class, 'update']);
            Route::delete('applicants/{id}', [ApplicantController::class, 'destroy']);
            Route::get('applicants/{applicantId}/guardians', [ApplicantController::class, 'guardians']);
            Route::post('applicants/{applicantId}/guardians', [ApplicantController::class, 'storeGuardian']);
            Route::get('applicants/{applicantId}/guardians/{id}', [ApplicantController::class, 'showGuardian']);
            Route::patch('applicants/{applicantId}/guardians/{id}', [ApplicantController::class, 'updateGuardian']);
            Route::delete('applicants/{applicantId}/guardians/{id}', [ApplicantController::class, 'destroyGuardian']);

            Route::get('applications', [ApplicationController::class, 'index']);
            Route::post('applications', [ApplicationController::class, 'store']);
            Route::get('applications/{id}', [ApplicationController::class, 'show']);
            Route::post('applications/{id}/submit', [ApplicationController::class, 'submit']);
            Route::post('applications/{id}/transition', [ApplicationController::class, 'transition'])
                ->middleware('permission:application.verify,document.verify,application.override,assessment.input,assessment.approve');

            Route::get('applications/{applicationId}/documents', [ApplicationController::class, 'documents']);
            Route::post('applications/{applicationId}/documents', [ApplicationController::class, 'upload']);
            Route::post('documents/{id}/verify', [ApplicationController::class, 'verifyDocument'])->middleware($verify);
            Route::post('documents/{id}/request-revision', [ApplicationController::class, 'requestRevision'])->middleware($verify);
        });
    });

    // ---- Verification --------------------------------------------------------
    Route::prefix('verification')->middleware(['auth:sanctum', $verify])->group(function () {
        Route::get('queue', [VerificationController::class, 'queue']);
        Route::post('assignments', [VerificationController::class, 'assign'])
            ->middleware('permission:application.verify,application.override');
        Route::get('applications/{applicationId}/reviews', [VerificationController::class, 'reviews']);
        Route::post('applications/{applicationId}/complete', [VerificationController::class, 'complete']);
    });

    // ---- Selection & announcements ------------------------------------------
    Route::prefix('selection')->group(function () use ($override, $approve, $assess) {
        Route::get('components', [SelectionController::class, 'components']);
        Route::get('components/{id}', [SelectionController::class, 'showComponent']);
        Route::post('announcements/lookup', [SelectionController::class, 'lookup'])->middleware('throttle:30,1');

        Route::middleware('auth:sanctum')->group(function () use ($override, $approve, $assess) {
            Route::middleware($override)->group(function () {
                Route::post('components', [SelectionController::class, 'storeComponent']);
                Route::patch('components/{id}', [SelectionController::class, 'updateComponent']);
                Route::delete('components/{id}', [SelectionController::class, 'destroyComponent']);
            });

            Route::middleware($assess)->group(function () {
                Route::get('schedules', [SelectionController::class, 'schedules']);
                Route::post('schedules', [SelectionController::class, 'storeSchedule']);
                Route::post('assessments/input', [SelectionController::class, 'inputScore']);
            });

            Route::get('applications/{applicationId}/scores', [SelectionController::class, 'applicationScore']);
            Route::get('applications/{applicationId}/decision', [SelectionController::class, 'decision']);
            Route::get('applications/{applicationId}/announcement', [SelectionController::class, 'announcement']);
            Route::get('applications/{applicationId}/announcement/letter', [SelectionController::class, 'letter']);

            Route::middleware($approve)->group(function () {
                Route::get('periods/{periodId}/ranking', [SelectionController::class, 'ranking']);
                Route::post('periods/{periodId}/ranking', [SelectionController::class, 'runRanking']);
                Route::post('applications/{applicationId}/decision', [SelectionController::class, 'decide']);
                Route::get('periods/{periodId}/waiting-list', [SelectionController::class, 'waitingList']);
                Route::post('waiting-list/{entryId}/promote', [SelectionController::class, 'promote']);
            });

            Route::post('periods/{periodId}/publish-announcement', [SelectionController::class, 'publish'])
                ->middleware('permission:announcement.publish,application.override');
        });
    });

    // ---- Enrollment / re-registration ---------------------------------------
    Route::prefix('enrollment')->group(function () use ($enrollment) {
        Route::get('requirements', [EnrollmentController::class, 'requirements']);
        Route::get('requirements/{id}', [EnrollmentController::class, 'showRequirement']);

        Route::middleware('auth:sanctum')->group(function () use ($enrollment) {
            Route::middleware($enrollment)->group(function () {
                Route::post('requirements', [EnrollmentController::class, 'storeRequirement']);
                Route::patch('requirements/{id}', [EnrollmentController::class, 'updateRequirement']);
                Route::delete('requirements/{id}', [EnrollmentController::class, 'destroyRequirement']);
            });

            Route::post('applications/{applicationId}/start-re-registration', [EnrollmentController::class, 'start']);
            Route::get('applications/{applicationId}/re-registration', [EnrollmentController::class, 'show']);
            Route::patch('re-registration-items/{itemId}', [EnrollmentController::class, 'updateItem']);
            Route::post('re-registrations/{reRegistrationId}/complete', [EnrollmentController::class, 'complete']);
        });
    });
});
