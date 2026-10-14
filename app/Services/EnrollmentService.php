<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use App\Support\ApplicationStatus;
use App\Support\DecisionType;
use App\Support\DocumentStatus;
use App\Support\EnrollmentStatus;
use App\Support\ReRegistrationStatus;
use App\Support\StudentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Turns an accepted, fully re-registered application into an official student (AGENTS §22).
 * Enrollment is triggered manually by staff, who also type the student number (NIS).
 */
class EnrollmentService
{
    /** MPLS officers need the student list to build groups, so they may read it too. */
    public const READ_PERMS = ['enrollment.manage', 'application.override', 'mpls.manage'];

    private const BAD_DOCUMENT_STATUSES = [DocumentStatus::PENDING, DocumentStatus::INVALID, DocumentStatus::REVISION_REQUIRED];

    /** @return Collection<int, Application> Applications waiting to be enrolled. */
    public static function eligible(?string $periodId = null): Collection
    {
        $q = Application::with(['applicant', 'admissionPeriod'])
            ->where('status', ApplicationStatus::RE_REGISTRATION_VERIFIED)
            ->whereDoesntHave('enrollment')
            ->orderBy('registration_number');
        if ($periodId) {
            $q->where('admission_period_id', $periodId);
        }

        return $q->get();
    }

    public static function enroll(User $by, string $applicationId, string $studentNumber, ?string $notes): Student
    {
        $studentNumber = trim($studentNumber);

        return DB::transaction(function () use ($by, $applicationId, $studentNumber, $notes) {
            $application = Application::with(['applicant', 'decision', 'reRegistration', 'documents', 'enrollment'])
                ->lockForUpdate()->find($applicationId) ?? throw ApiException::notFound('Application not found.');

            self::assertEnrollable($application);
            self::assertStudentNumberFree($studentNumber);

            $enrollment = Enrollment::create([
                'application_id' => $application->id,
                'status' => EnrollmentStatus::ACTIVE,
                'enrolled_at' => now(),
                'enrolled_by' => $by->id,
                'notes' => $notes,
            ]);

            $applicant = $application->applicant;
            $student = Student::create([
                'enrollment_id' => $enrollment->id,
                'student_number' => $studentNumber,
                'nisn' => $applicant->nisn,
                'full_name' => $applicant->full_name,
                'gender' => $applicant->gender,
                'birth_place' => $applicant->birth_place,
                'birth_date' => $applicant->birth_date,
                'status' => StudentStatus::ACTIVE,
            ]);

            ApplicationStateMachine::transition($by, $application, ApplicationStatus::ENROLLED, 'Enrolled as official student.');
            AuditService::record($by, 'enrollment.created', 'enrollment', $enrollment->id, null, [
                'application_id' => $application->id, 'student_id' => $student->id, 'student_number' => $studentNumber,
            ], $notes);

            return self::loadFull($student);
        });
    }

    /** Every precondition of AGENTS §22, re-checked at enrollment time (invoices may be added after re-registration). */
    private static function assertEnrollable(Application $application): void
    {
        if ($application->enrollment) {
            throw ApiException::validation(['detail' => 'Application is already enrolled.']);
        }
        if ($application->status !== ApplicationStatus::RE_REGISTRATION_VERIFIED) {
            throw ApiException::validation([
                'detail' => "Only RE_REGISTRATION_VERIFIED applications can be enrolled. Current status: '{$application->status}'.",
            ]);
        }
        if ($application->decision?->decision !== DecisionType::ACCEPTED) {
            throw ApiException::validation(['detail' => 'Enrollment requires an ACCEPTED decision.']);
        }
        if ($application->reRegistration?->status !== ReRegistrationStatus::COMPLETED) {
            throw ApiException::validation(['detail' => 'Re-registration must be completed before enrollment.']);
        }
        if (PaymentService::hasOutstandingInvoices($application->id)) {
            throw ApiException::validation(['detail' => 'Outstanding invoices must be paid or waived before enrollment.']);
        }
        if ($application->documents->contains(fn ($d) => in_array($d->status, self::BAD_DOCUMENT_STATUSES, true))) {
            throw ApiException::validation(['detail' => 'All documents must be valid before enrollment.']);
        }
    }

    private static function assertStudentNumberFree(string $studentNumber, ?string $exceptId = null): void
    {
        $q = Student::whereRaw('LOWER(student_number) = ?', [mb_strtolower($studentNumber)]);
        if ($exceptId) {
            $q->where('id', '!=', $exceptId);
        }
        if ($q->exists()) {
            throw ApiException::validation(['student_number' => "Student number '{$studentNumber}' is already in use."]);
        }
    }

    /**
     * Correct a mistyped NIS/NISN; the change is audited with a mandatory reason.
     *
     * @param  array{student_number?:string,nisn?:?string}  $data
     */
    public static function updateStudent(User $by, string $studentId, array $data, string $reason): Student
    {
        return DB::transaction(function () use ($by, $studentId, $data, $reason) {
            $student = Student::lockForUpdate()->find($studentId) ?? throw ApiException::notFound('Student not found.');
            if (isset($data['student_number'])) {
                $data['student_number'] = trim($data['student_number']);
                self::assertStudentNumberFree($data['student_number'], $student->id);
            }

            $old = array_intersect_key($student->only(['student_number', 'nisn']), $data);
            $student->update($data);
            AuditService::record($by, 'student.updated', 'student', $student->id, $old, $data, $reason);

            return self::loadFull($student);
        });
    }

    /** @param array{academic_year_id?:?string,admission_period_id?:?string,search?:?string} $filters */
    public static function studentsQuery(array $filters): Builder
    {
        $q = Student::with(['enrollment.application.admissionPeriod.academicYear', 'enrollment.enrolledBy'])->orderBy('student_number');
        if ($periodId = $filters['admission_period_id'] ?? null) {
            $q->whereHas('enrollment.application', fn ($a) => $a->where('admission_period_id', $periodId));
        }
        if ($yearId = $filters['academic_year_id'] ?? null) {
            $q->whereHas('enrollment.application.admissionPeriod', fn ($p) => $p->where('academic_year_id', $yearId));
        }
        if ($search = trim((string) ($filters['search'] ?? ''))) {
            $like = '%'.mb_strtolower($search).'%';
            $q->where(fn ($s) => $s->whereRaw('LOWER(full_name) LIKE ?', [$like])->orWhereRaw('LOWER(student_number) LIKE ?', [$like]));
        }

        return $q;
    }

    /** The student record of an application, for its owner or staff; null when not enrolled yet. */
    public static function forApplication(User $user, string $applicationId): ?Student
    {
        $application = Application::with(['applicant', 'enrollment.student'])->find($applicationId)
            ?? throw ApiException::notFound('Application not found.');
        if ($application->applicant->owner_user_id !== $user->id && ! $user->hasAnyPermCodes(self::READ_PERMS)) {
            throw ApiException::forbidden('You do not have permission to view this enrollment.');
        }
        $student = $application->enrollment?->student;

        return $student ? self::loadFull($student) : null;
    }

    private static function loadFull(Student $student): Student
    {
        return $student->load(['enrollment.application.admissionPeriod.academicYear', 'enrollment.enrolledBy']);
    }
}
