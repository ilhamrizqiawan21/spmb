<?php

namespace App\Http\Controllers\Api;

use App\Models\AcademicYear;
use App\Models\AdmissionPeriod;
use App\Models\ApplicationDocument;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SystemController extends ApiController
{
    /**
     * Dedicated System & Governance Dashboard for Super Administrators.
     * Enforced by `application.override` permission.
     */
    public function adminDashboard(): JsonResponse
    {
        $dbStatus = $this->check(fn () => DB::connection()->getPdo() !== null);
        $cacheStatus = $this->check(function () {
            Cache::put('dashboard_probe', '1', 5);
            return Cache::get('dashboard_probe') === '1';
        });

        // Queue metrics
        $pendingJobs = Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0;
        $failedJobs = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;

        // Notification metrics (past 24h)
        $sentNotifications = Schema::hasTable('notification_logs')
            ? DB::table('notification_logs')->where('status', 'SENT')->where('created_at', '>=', now()->subDay())->count()
            : 0;
        $failedNotifications = Schema::hasTable('notification_logs')
            ? DB::table('notification_logs')->where('status', 'FAILED')->where('created_at', '>=', now()->subDay())->count()
            : 0;

        // Storage metrics
        $totalDocs = ApplicationDocument::count();
        $totalBytes = (int) ApplicationDocument::sum('file_size');

        // Stalled documents (pending verification for more than 24 hours)
        $stalledDocs = ApplicationDocument::where('status', 'PENDING')
            ->where('created_at', '<', now()->subDay())
            ->count();

        // System alerts
        $alerts = [];
        if ($failedJobs > 0) {
            $alerts[] = [
                'level' => 'danger',
                'title' => 'Pekerjaan Antrean Gagal',
                'message' => "Terdapat {$failedJobs} pekerjaan antrean (failed jobs) yang mengalami kegagalan proses.",
            ];
        }
        if ($failedNotifications > 0) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Notifikasi Gagal',
                'message' => "Terdapat {$failedNotifications} email notifikasi yang gagal terkirim dalam 24 jam terakhir.",
            ];
        }
        if ($stalledDocs > 0) {
            $alerts[] = [
                'level' => 'warning',
                'title' => 'Berkas Tertahan',
                'message' => "Terdapat {$stalledDocs} berkas pendaftaran yang belum diperiksa selama lebih dari 24 jam.",
            ];
        }

        // Active Academic Year
        $activeYear = AcademicYear::where('is_active', true)->first(['id', 'name']);

        // Admission Periods with quota calculations
        $periodsQuery = AdmissionPeriod::withCount('applications');
        if ($activeYear) {
            $periodsQuery->where('academic_year_id', $activeYear->id);
        }
        $periods = $periodsQuery->orderBy('registration_start')
            ->get(['id', 'name', 'code', 'quota', 'is_active', 'registration_start', 'registration_end', 'announcement_at'])
            ->map(function ($p) {
                $quota = $p->quota;
                $pct = ($quota && $quota > 0) ? round(($p->applications_count / $quota) * 100, 1) : null;
                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'code' => $p->code,
                    'quota' => $quota,
                    'applications_count' => $p->applications_count,
                    'fill_percentage' => $pct,
                    'registration_start' => $p->registration_start->toIso8601String(),
                    'registration_end' => $p->registration_end->toIso8601String(),
                    'announcement_at' => $p->announcement_at?->toIso8601String(),
                    'is_open' => $p->is_active && now()->between($p->registration_start, $p->registration_end),
                    'is_active' => (bool) $p->is_active,
                ];
            });

        // Governance: Users by role
        $totalUsers = User::count();
        $activeUsers = User::where('is_active', true)->count();
        $rolesWithCount = Role::withCount(['users' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('is_system', 'desc')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'is_system'])
            ->map(fn ($r) => [
                'code' => $r->code,
                'name' => $r->name,
                'active_users_count' => $r->users_count,
            ]);

        // Recent Audit activities
        $recentAudits = AuditLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->map(fn ($l) => [
                'id' => $l->id,
                'action' => $l->action,
                'resource_type' => $l->resource_type,
                'user_name' => $l->user?->name ?? 'Sistem',
                'reason' => $l->reason,
                'ip_address' => $l->ip_address,
                'created_at' => $l->created_at->toIso8601String(),
            ]);

        return response()->json([
            'health' => [
                'database' => $dbStatus ? 'ok' : 'error',
                'cache' => $cacheStatus ? 'ok' : 'error',
                'environment' => app()->environment(),
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'queue' => [
                    'pending_jobs' => $pendingJobs,
                    'failed_jobs' => $failedJobs,
                ],
                'notifications' => [
                    'sent_24h' => $sentNotifications,
                    'failed_24h' => $failedNotifications,
                ],
                'storage' => [
                    'total_documents' => $totalDocs,
                    'total_bytes' => $totalBytes,
                ],
            ],
            'alerts' => $alerts,
            'governance' => [
                'total_users' => $totalUsers,
                'active_users' => $activeUsers,
                'inactive_users' => $totalUsers - $activeUsers,
                'roles' => $rolesWithCount,
            ],
            'academic_year' => $activeYear?->name,
            'periods' => $periods,
            'recent_audits' => $recentAudits,
        ]);
    }

    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'app' => config('spmb.name'),
            'version' => config('spmb.version'),
            'environment' => app()->environment(),
        ]);
    }

    /** Public school identity/contact for the home page (configured via SPMB_SCHOOL_*). */
    public function school(): JsonResponse
    {
        return response()->json(array_map(fn ($v) => $v === '' ? null : $v, config('spmb.school')));
    }

    /** Verifies required infrastructure (database, cache) is reachable. */
    public function ready(): JsonResponse
    {
        $database = $this->check(fn () => DB::connection()->getPdo() !== null);
        $cache = $this->check(function () {
            Cache::put('ready_probe', '1', 5);

            return Cache::get('ready_probe') === '1';
        });

        if (! ($database && $cache)) {
            return response()->json(['status' => 'not_ready'], 503);
        }

        return response()->json(['status' => 'ready', 'database' => 'ok', 'cache' => 'ok']);
    }

    private function check(callable $probe): bool
    {
        try {
            return (bool) $probe();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Clear application cache and compiled views.
     */
    public function clearCache(Request $request): JsonResponse
    {
        Cache::flush();
        try {
            Artisan::call('cache:clear');
        } catch (\Throwable) {
            // Ignore artisan terminal exception if sandboxed or restricted
        }

        AuditService::record(
            $request->user(),
            'SYSTEM_CLEAR_CACHE',
            'System',
            null,
            null,
            null,
            $request->input('reason', 'Pembersihan cache aplikasi melalui panel kontrol sistem')
        );

        return response()->json([
            'message' => 'Cache aplikasi dan data sementara berhasil dibersihkan.',
        ]);
    }

    /**
     * Retry all failed queue jobs.
     */
    public function retryJobs(Request $request): JsonResponse
    {
        $count = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;

        if ($count > 0) {
            try {
                Artisan::call('queue:retry', ['id' => ['all']]);
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Gagal memproses ulang antrean: ' . $e->getMessage(),
                ], 500);
            }
        }

        AuditService::record(
            $request->user(),
            'SYSTEM_RETRY_FAILED_JOBS',
            'Queue',
            null,
            ['failed_count' => $count],
            ['action' => 'retry_all'],
            $request->input('reason', "Menjadwalkan ulang {$count} antrean pekerjaan gagal")
        );

        return response()->json([
            'message' => "Berhasil menjadwalkan ulang {$count} antrean pekerjaan untuk diproses kembali.",
        ]);
    }

    /**
     * Flush / wipe all failed queue jobs.
     */
    public function flushFailedJobs(Request $request): JsonResponse
    {
        $count = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;

        if (Schema::hasTable('failed_jobs')) {
            DB::table('failed_jobs')->delete();
        }

        AuditService::record(
            $request->user(),
            'SYSTEM_FLUSH_FAILED_JOBS',
            'Queue',
            null,
            ['failed_count' => $count],
            ['action' => 'flush'],
            $request->input('reason', "Membersihkan {$count} riwayat antrean pekerjaan gagal")
        );

        return response()->json([
            'message' => "Berhasil membersihkan {$count} riwayat antrean pekerjaan gagal.",
        ]);
    }

    /**
     * Quick emergency toggle active status for admission periods.
     */
    public function togglePeriod(Request $request, string $id): JsonResponse
    {
        $period = AdmissionPeriod::findOrFail($id);
        $oldStatus = (bool) $period->is_active;
        $newStatus = ! $oldStatus;
        $period->is_active = $newStatus;
        $period->save();

        AuditService::record(
            $request->user(),
            $newStatus ? 'ENABLE_ADMISSION_PERIOD' : 'DISABLE_ADMISSION_PERIOD',
            'AdmissionPeriod',
            $period->id,
            ['is_active' => $oldStatus],
            ['is_active' => $newStatus],
            $request->input('reason', ($newStatus ? 'Mengaktifkan kembali' : 'Menonaktifkan sementara') . " gelombang {$period->name}")
        );

        return response()->json([
            'message' => "Gelombang '{$period->name}' berhasil " . ($newStatus ? 'diaktifkan' : 'dinonaktifkan') . '.',
            'period' => [
                'id' => $period->id,
                'name' => $period->name,
                'is_active' => $period->is_active,
            ],
        ]);
    }
}
