<?php

namespace App\Services;

use App\Models\AdmissionPeriod;
use App\Models\Application;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\ApplicationStatus as S;
use App\Support\DecisionType;
use App\Support\InvoiceStatus;
use App\Support\PaymentStatus;
use App\Support\ReRegistrationStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\LazyCollection;

/**
 * Staff dashboard figures (PRD §11) and CSV reports (PRD §14). Read-only aggregate queries;
 * every figure can be narrowed to one academic year and/or admission period.
 *
 * @phpstan-type Filters array{academic_year_id:?string,admission_period_id:?string}
 */
class ReportService
{
    private const TOP_LIMIT = 10;

    private const AWAITING_VERIFICATION = [S::SUBMITTED, S::RESUBMITTED, S::UNDER_VERIFICATION];

    /** @param Filters $filters */
    public static function applications(array $filters): Builder
    {
        $q = Application::query();
        if ($periodId = $filters['admission_period_id'] ?? null) {
            $q->where('admission_period_id', $periodId);
        }
        if ($yearId = $filters['academic_year_id'] ?? null) {
            $q->whereHas('admissionPeriod', fn ($p) => $p->where('academic_year_id', $yearId));
        }

        return $q;
    }

    /** @param Filters $filters */
    public static function summary(User $user, array $filters): array
    {
        $apps = fn () => self::applications($filters);

        $summary = [
            'total' => $apps()->count(),
            'by_status' => $apps()->select('status', DB::raw('COUNT(*) AS total'))->groupBy('status')->pluck('total', 'status')
                ->map(fn ($n) => (int) $n),
            'funnel' => [
                ['key' => 'registered', 'label' => 'Registrasi', 'total' => $apps()->count()],
                ['key' => 'submitted', 'label' => 'Submit', 'total' => $apps()->whereNotNull('submitted_at')->count()],
                ['key' => 'verified', 'label' => 'Terverifikasi', 'total' => $apps()->whereNotNull('verified_at')->count()],
                ['key' => 'assessed', 'label' => 'Dinilai', 'total' => $apps()->whereNotNull('assessed_at')->count()],
                ['key' => 'accepted', 'label' => 'Diterima', 'total' => $apps()->whereHas('decision', fn ($d) => $d->where('decision', DecisionType::ACCEPTED))->count()],
                ['key' => 're_registered', 'label' => 'Daftar ulang', 'total' => $apps()->whereHas('reRegistration', fn ($r) => $r->where('status', ReRegistrationStatus::COMPLETED))->count()],
                ['key' => 'enrolled', 'label' => 'Enrolled', 'total' => $apps()->whereHas('enrollment')->count()],
            ],
            'work_queue' => [
                'awaiting_verification' => $apps()->whereIn('status', self::AWAITING_VERIFICATION)->count(),
                'revision_required' => $apps()->where('status', S::REVISION_REQUIRED)->count(),
                'awaiting_decision' => $apps()->where('status', S::ASSESSED)->count(),
                're_registration_in_progress' => $apps()->where('status', S::RE_REGISTRATION)->count(),
                'awaiting_enrollment' => $apps()->where('status', S::RE_REGISTRATION_VERIFIED)->whereDoesntHave('enrollment')->count(),
            ],
            'periods' => self::periods($filters),
            'top_schools' => self::topApplicantValues($filters, 'previous_school_name'),
            'top_cities' => self::topApplicantValues($filters, 'city'),
            'finance' => null,
        ];

        if ($user->hasAnyPermCodes(PaymentService::READ_PERMS)) {
            $summary['finance'] = self::finance($filters);
        }

        return $summary;
    }

    /** Quota versus accepted/enrolled per admission period. */
    private static function periods(array $filters): array
    {
        $q = AdmissionPeriod::with('academicYear')->orderBy('registration_start')->withCount([
            'applications',
            'applications as accepted_count' => fn ($a) => $a->whereHas('decision', fn ($d) => $d->where('decision', DecisionType::ACCEPTED)),
            'applications as enrolled_count' => fn ($a) => $a->whereHas('enrollment'),
        ]);
        if ($periodId = $filters['admission_period_id'] ?? null) {
            $q->where('id', $periodId);
        }
        if ($yearId = $filters['academic_year_id'] ?? null) {
            $q->where('academic_year_id', $yearId);
        }

        return $q->get()->map(fn (AdmissionPeriod $p) => [
            'id' => $p->id,
            'name' => $p->name,
            'academic_year_name' => $p->academicYear?->name,
            'quota' => $p->quota,
            'applications' => (int) $p->applications_count,
            'accepted' => (int) $p->accepted_count,
            'enrolled' => (int) $p->enrolled_count,
            'remaining_quota' => $p->quota === null ? null : max(0, $p->quota - (int) $p->accepted_count),
        ])->all();
    }

    /** Most frequent applicant values (origin school, city) — PRD §14 statistics. */
    private static function topApplicantValues(array $filters, string $column): array
    {
        return self::applications($filters)
            ->join('applicants', 'applicants.id', '=', 'applications.applicant_id')
            ->whereNotNull("applicants.{$column}")->where("applicants.{$column}", '!=', '')
            ->select("applicants.{$column} AS value", DB::raw('COUNT(*) AS total'))
            ->groupBy("applicants.{$column}")->orderByDesc('total')->orderBy('value')
            ->limit(self::TOP_LIMIT)->get()
            ->map(fn ($r) => ['value' => $r->value, 'total' => (int) $r->total])->all();
    }

    private static function finance(array $filters): array
    {
        $appIds = self::applications($filters)->select('id');
        $invoices = fn () => Invoice::whereIn('application_id', $appIds);
        $payments = fn () => Payment::whereHas('invoice', fn ($i) => $i->whereIn('application_id', $appIds));

        return [
            'pending_payments' => $payments()->where('status', PaymentStatus::PENDING)->count(),
            'outstanding_invoices' => $invoices()->whereIn('status', InvoiceStatus::OUTSTANDING)->count(),
            'paid_invoices' => $invoices()->where('status', InvoiceStatus::PAID)->count(),
            'verified_amount' => number_format((float) $payments()->where('status', PaymentStatus::PAID)->sum('amount'), 2, '.', ''),
        ];
    }

    // ---- CSV report rows -----------------------------------------------------

    public const APPLICATION_HEADERS = [
        'No. Pendaftaran', 'Nama', 'Jenis Kelamin', 'NISN', 'Tanggal Lahir', 'Sekolah Asal', 'Kota/Kab.',
        'Gelombang', 'Status', 'Tanggal Submit', 'Tanggal Verifikasi', 'Keputusan',
    ];

    /** Contact data and NIK are deliberately left out (data minimisation). */
    public static function applicationRows(array $filters): LazyCollection
    {
        return self::applications($filters)->with(['applicant', 'admissionPeriod', 'decision'])
            ->orderBy('registration_number')->lazy(500)
            ->map(fn (Application $a) => [
                $a->registration_number, $a->applicant->full_name, $a->applicant->gender, $a->applicant->nisn,
                $a->applicant->birth_date?->toDateString(), $a->applicant->previous_school_name, $a->applicant->city,
                $a->admissionPeriod?->name, $a->status, $a->submitted_at, $a->verified_at, $a->decision?->decision,
            ]);
    }

    public const SELECTION_HEADERS = ['No. Pendaftaran', 'Nama', 'Gelombang', 'Skor Akhir', 'Peringkat', 'Keputusan', 'Status', 'Diumumkan'];

    public static function selectionRows(array $filters): LazyCollection
    {
        return self::applications($filters)->whereHas('decision')->with(['applicant', 'admissionPeriod', 'decision'])
            ->orderBy('admission_period_id')->orderBy('registration_number')->lazy(500)
            ->map(fn (Application $a) => [
                $a->registration_number, $a->applicant->full_name, $a->admissionPeriod?->name,
                $a->decision->final_score, $a->decision->rank, $a->decision->decision, $a->status, $a->decision->published_at,
            ]);
    }

    public const PAYMENT_HEADERS = [
        'No. Tagihan', 'No. Pendaftaran', 'Nama', 'Jenis', 'Nominal Tagihan', 'Status Tagihan',
        'Nominal Bayar', 'Metode', 'Referensi', 'Status Bayar', 'Tanggal Bayar', 'Diverifikasi', 'Verifikator',
    ];

    /** One row per payment; invoices without payments still get one row. */
    public static function paymentRows(array $filters): LazyCollection
    {
        $appIds = self::applications($filters)->select('id');

        return Invoice::whereIn('application_id', $appIds)->with(['application.applicant', 'payments.verifiedBy'])
            ->orderBy('invoice_number')->lazy(200)
            ->flatMap(function (Invoice $i) {
                $base = [$i->invoice_number, $i->application->registration_number, $i->application->applicant->full_name,
                    $i->type, (string) $i->amount, $i->status];
                if ($i->payments->isEmpty()) {
                    return [[...$base, '', '', '', '', '', '', '']];
                }

                return $i->payments->map(fn (Payment $p) => [...$base, (string) $p->amount, $p->method, $p->reference_number,
                    $p->status, $p->paid_at, $p->verified_at, $p->verifiedBy?->name])->all();
            });
    }
}
