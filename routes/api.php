<?php

use App\Http\Controllers\Api\AcademicYearController;
use App\Http\Controllers\Api\AdmissionPeriodController;
use App\Http\Controllers\Api\ApplicantController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\MplsController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SelectionController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\SystemController;
use App\Http\Controllers\Api\UserController;
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

    Route::get('public/school', [SystemController::class, 'school']);

    // ---- System & Operations Console (Super Admin) ---------------------------
    Route::prefix('system')->middleware(['auth:sanctum', 'permission:application.override'])->group(function () {
        Route::get('admin-dashboard', [SystemController::class, 'adminDashboard']);
        Route::post('actions/clear-cache', [SystemController::class, 'clearCache']);
        Route::post('actions/retry-jobs', [SystemController::class, 'retryJobs']);
        Route::post('actions/flush-failed-jobs', [SystemController::class, 'flushFailedJobs']);
        Route::post('actions/toggle-period/{id}', [SystemController::class, 'togglePeriod']);
    });

    // ---- Auth ----------------------------------------------------------------
    Route::prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register'])->middleware('throttle:20,1');
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:30,1');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1');
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::post('change-password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');
            Route::get('me', [AuthController::class, 'me']);
            Route::patch('me', [AuthController::class, 'updateMe'])->middleware('throttle:20,1');
            Route::get('staff', [StaffController::class, 'index'])
                ->middleware('permission:application.verify,application.override,user.manage');
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
            Route::post('applications/{applicationId}/documents', [ApplicationController::class, 'upload'])->middleware('throttle:30,1');
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
                Route::patch('schedules/{id}', [SelectionController::class, 'updateSchedule']);
            });
            // Owner (or staff with read access) can see the schedule of an application.
            Route::get('applications/{applicationId}/schedules', [SelectionController::class, 'applicationSchedules']);

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

            // Enrollment into official students (ERD §14); owner or staff may read the result.
            Route::get('applications/{applicationId}/student', [StudentController::class, 'forApplication']);
            Route::middleware($enrollment)->group(function () {
                Route::get('eligible', [StudentController::class, 'eligible']);
                Route::post('applications/{applicationId}/enroll', [StudentController::class, 'enroll']);
                Route::patch('students/{id}', [StudentController::class, 'update']);
            });
            Route::middleware('permission:enrollment.manage,application.override,mpls.manage')->group(function () {
                Route::get('students', [StudentController::class, 'index']);
                Route::get('students/export', [StudentController::class, 'export']);
            });
        });
    });

    // ---- Finance: manual invoices and payment proofs ---------------------------
    // Authorization is enforced in PaymentService (owner or finance/admin staff).
    Route::prefix('finance')->middleware('auth:sanctum')->group(function () {
        Route::get('summary', [FinanceController::class, 'summary']);
        Route::get('invoices', [FinanceController::class, 'allInvoices']);
        Route::post('invoices/bulk', [FinanceController::class, 'storeBulkInvoices']);
        Route::get('export', [FinanceController::class, 'exportPayments']);
        Route::get('applications/{applicationId}/invoices', [FinanceController::class, 'invoices']);
        Route::post('applications/{applicationId}/invoices', [FinanceController::class, 'storeInvoice']);
        Route::post('invoices/{id}/cancel', [FinanceController::class, 'cancelInvoice']);
        Route::post('invoices/{id}/payments', [FinanceController::class, 'submitPayment'])->middleware('throttle:20,1');
        Route::get('payments', [FinanceController::class, 'payments']);
        Route::post('payments/{id}/verify', [FinanceController::class, 'verify']);
        Route::get('payments/{id}/proof', [FinanceController::class, 'proof']);
    });

    // ---- MPLS ------------------------------------------------------------------
    Route::prefix('mpls')->middleware('auth:sanctum')->group(function () {
        // Owner (parent) or MPLS staff; checked in MplsService.
        Route::get('applications/{applicationId}', [MplsController::class, 'forApplication']);

        Route::middleware('permission:mpls.manage,application.override')->group(function () {
            Route::get('groups', [MplsController::class, 'groups']);
            Route::post('groups', [MplsController::class, 'storeGroup']);
            Route::patch('groups/{id}', [MplsController::class, 'updateGroup']);
            Route::delete('groups/{id}', [MplsController::class, 'destroyGroup']);
            Route::get('events', [MplsController::class, 'events']);
            Route::post('events', [MplsController::class, 'storeEvent']);
            Route::patch('events/{id}', [MplsController::class, 'updateEvent']);
            Route::delete('events/{id}', [MplsController::class, 'destroyEvent']);
            Route::get('events/{id}/attendance', [MplsController::class, 'roster']);
            Route::get('participants', [MplsController::class, 'participants']);
            Route::get('participants/unassigned', [MplsController::class, 'unassigned']);
            Route::get('participants/export', [MplsController::class, 'export']);
            Route::post('participants', [MplsController::class, 'assign']);
            Route::post('participants/auto-assign', [MplsController::class, 'autoAssign']);
            Route::post('participants/{id}/rotate-qr', [MplsController::class, 'rotateToken']);
            Route::post('participants/{id}/complete', [MplsController::class, 'complete']);
            Route::post('attendance', [MplsController::class, 'record']);
            Route::post('attendance/scan', [MplsController::class, 'scan'])->middleware('throttle:120,1');
        });
    });

    // ---- Dashboard & reports (read-only) -------------------------------------
    Route::prefix('reports')->middleware('auth:sanctum')->group(function () {
        Route::get('summary', [ReportController::class, 'summary'])->middleware('permission:application.read,application.override');
        Route::get('applications/export', [ReportController::class, 'applications'])->middleware('permission:application.read,application.override');
        Route::get('selection/export', [ReportController::class, 'selection'])
            ->middleware('permission:assessment.approve,announcement.publish,application.override');
        Route::get('payments/export', [ReportController::class, 'payments'])
            ->middleware('permission:payment.read,payment.verify,application.override');
    });

    // ---- User management (Super Admin & Admin) ------------------------------
    Route::prefix('users')->middleware(['auth:sanctum', 'permission:user.manage,application.override'])->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('roles', [UserController::class, 'roles']);
        Route::patch('{id}', [UserController::class, 'update']);
        Route::delete('{id}', [UserController::class, 'destroy']);
    });

    // ---- Audit trail (read-only) ---------------------------------------------
    Route::get('audit-logs', [AuditLogController::class, 'index'])
        ->middleware(['auth:sanctum', 'permission:audit.read']);
});
