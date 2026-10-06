<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AdmissionPeriod;
use App\Models\Application;
use App\Models\ApplicationDecision;
use App\Models\User;
use App\Support\DecisionType;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class AnnouncementService
{
    public const PUBLISH_PERMS = ['announcement.publish', 'application.override'];

    public static function publishPeriod(User $user, string $periodId, ?CarbonInterface $publishedAt = null): int
    {
        if (! $user->hasAnyPermCodes(self::PUBLISH_PERMS)) {
            throw ApiException::forbidden('You do not have permission to publish announcements.');
        }

        return DB::transaction(function () use ($periodId, $publishedAt) {
            $period = AdmissionPeriod::find($periodId) ?? throw ApiException::notFound('Admission period not found.');
            $time = $publishedAt ?? now();
            $period->update(['announcement_at' => $time]);

            return ApplicationDecision::whereHas('application', fn ($q) => $q->where('admission_period_id', $period->id))
                ->update(['published_at' => $time]);
        });
    }

    private static function isPublished(Application $application, ?ApplicationDecision $decision): bool
    {
        $now = now();
        $period = $application->admissionPeriod;

        return ($decision?->published_at !== null && $decision->published_at->lte($now))
            || ($period->announcement_at !== null && $period->announcement_at->lte($now) && $decision !== null);
    }

    public static function result(User $user, string $applicationId): array
    {
        $application = Application::with(['applicant', 'admissionPeriod', 'scoreSummary', 'decision', 'waitingListEntry'])
            ->find($applicationId) ?? throw ApiException::notFound('Application not found.');
        ApplicantService::checkAccess($user, $application->applicant);

        $override = $user->hasAnyPermCodes(self::PUBLISH_PERMS);
        $decision = $application->decision;
        $base = [
            'application_id' => $application->id,
            'registration_number' => $application->registration_number,
            'applicant_name' => $application->applicant->full_name,
        ];

        if (! self::isPublished($application, $decision) && ! $override) {
            return ['is_published' => false, 'message' => 'Hasil seleksi belum diumumkan.',
                'announcement_at' => $application->admissionPeriod->announcement_at] + $base;
        }
        if (! $decision) {
            return ['is_published' => false, 'message' => 'Keputusan hasil seleksi belum ditetapkan.'] + $base;
        }

        return [
            'is_published' => true,
            'admission_period_name' => $application->admissionPeriod->name,
            'decision' => $decision->decision,
            'final_score' => $decision->final_score,
            'rank' => $decision->rank,
            'published_at' => $decision->published_at ?? now(),
            'next_steps' => self::nextSteps($decision->decision, $application),
            'letter_url' => "/api/v1/selection/applications/{$application->id}/announcement/letter",
        ] + $base;
    }

    public static function publicLookup(string $registrationNumber, string $birthDate): array
    {
        $application = Application::with(['applicant', 'admissionPeriod', 'decision', 'waitingListEntry'])
            ->whereRaw('LOWER(registration_number) = ?', [mb_strtolower(trim($registrationNumber))])
            ->whereHas('applicant', fn ($q) => $q->whereDate('birth_date', $birthDate))
            ->first() ?? throw ApiException::validation(['detail' => 'Nomor pendaftaran atau tanggal lahir tidak cocok.']);

        $decision = $application->decision;
        if (! $decision || ! self::isPublished($application, $decision)) {
            return [
                'is_published' => false,
                'message' => 'Hasil seleksi belum diumumkan.',
                'announcement_at' => $application->admissionPeriod->announcement_at,
                'registration_number' => $application->registration_number,
            ];
        }

        return [
            'is_published' => true,
            'registration_number' => $application->registration_number,
            'applicant_name_masked' => self::maskName($application->applicant->full_name),
            'admission_period_name' => $application->admissionPeriod->name,
            'decision' => $decision->decision,
            'published_at' => $decision->published_at ?? now(),
            'next_steps' => self::nextSteps($decision->decision, $application),
        ];
    }

    /** @return array{0:string,1:string} filename and PDF bytes */
    public static function resultLetter(User $user, string $applicationId): array
    {
        $res = self::result($user, $applicationId);
        if (! $res['is_published']) {
            throw ApiException::forbidden($res['message'] ?? 'Hasil seleksi belum diumumkan.');
        }

        $reg = $res['registration_number'] ?: 'REG';
        $lines = [
            "Nomor Pendaftaran : {$reg}",
            'Nama Calon Siswa  : '.($res['applicant_name'] ?? ''),
            'Jalur / Gelombang : '.($res['admission_period_name'] ?? ''),
            'Status Keputusan  : '.($res['decision'] ?? ''),
        ];
        if ($res['final_score'] !== null) {
            $lines[] = "Nilai Akhir       : {$res['final_score']}";
        }
        if ($res['rank'] !== null) {
            $lines[] = "Peringkat         : {$res['rank']}";
        }
        $lines[] = '';
        $lines[] = 'Instruksi Langkah Berikutnya:';
        foreach ($res['next_steps'] as $step) {
            $lines[] = "- {$step}";
        }

        return ["Surat_Hasil_Seleksi_{$reg}.pdf", self::buildPdf('SURAT KEPUTUSAN HASIL SELEKSI SPMB AL-IHSAN', $lines)];
    }

    public static function maskName(string $fullName): string
    {
        $masked = [];
        foreach (preg_split('/\s+/', trim($fullName)) as $part) {
            $len = mb_strlen($part);
            $masked[] = $len <= 2
                ? mb_substr($part, 0, 1).'*'
                : mb_substr($part, 0, 1).str_repeat('*', $len - 2).mb_substr($part, -1);
        }

        return implode(' ', $masked);
    }

    /** @return list<string> */
    public static function nextSteps(string $decision, Application $application): array
    {
        if ($decision === DecisionType::ACCEPTED) {
            return [
                'Lakukan konfirmasi kesediaan dan pendaftaran ulang pada portal.',
                'Lengkapi berkas pendaftaran ulang yang dipersyaratkan.',
                'Lakukan pembayaran biaya daftar ulang sebelum batas waktu.',
            ];
        }
        if ($decision === DecisionType::WAITLISTED) {
            $pos = $application->waitingListEntry ? " (Nomor urut {$application->waitingListEntry->position})" : '';

            return [
                "Anda berada dalam daftar tunggu (Waitlisted){$pos}.",
                'Jika ada peserta diterima yang tidak melakukan daftar ulang, panitia akan mempromosikan kandidat daftar tunggu.',
                'Pantau secara berkala informasi di portal SPMB.',
            ];
        }

        return [
            'Terima kasih atas partisipasi Anda dalam proses seleksi SPMB Terpadu Al-Ihsan.',
            'Tetap semangat dan sukses untuk jenjang pendidikan selanjutnya.',
        ];
    }

    /** Minimal single-page PDF (Helvetica) without external dependencies. */
    public static function buildPdf(string $title, array $lines): string
    {
        $esc = fn (string $t) => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $t);
        // Core PDF fonts are Latin-1; transliterate to keep the stream valid.
        $latin = fn (string $t) => $esc((string) iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $t));

        $ops = ['BT', '/F1 16 Tf', '50 750 Td', '('.$latin($title).') Tj', '/F1 10 Tf', '0 -25 Td'];
        foreach ($lines as $line) {
            $ops[] = '('.$latin($line).') Tj';
            $ops[] = '0 -15 Td';
        }
        $ops[] = 'ET';
        $stream = implode("\n", $ops);

        $objects = [
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
            "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
            "5 0 obj\n<< /Length ".strlen($stream)." >>\nstream\n{$stream}\nendstream\nendobj",
        ];

        $body = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $obj) {
            $offsets[] = strlen($body);
            $body .= $obj."\n";
        }
        $xrefStart = strlen($body);
        $xref = "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $off) {
            $xref .= sprintf("%010d 00000 n \n", $off);
        }

        $size = count($objects) + 1;

        return $body.$xref."trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$xrefStart}\n%%EOF\n";
    }
}
