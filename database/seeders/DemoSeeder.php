<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\AdmissionPeriod;
use App\Models\Applicant;
use App\Models\Application;
use App\Models\ApplicationDecision;
use App\Models\ApplicationDocument;
use App\Models\ApplicationScore;
use App\Models\Assessment;
use App\Models\AssessmentSchedule;
use App\Models\AuditLog;
use App\Models\DocumentRequirement;
use App\Models\Enrollment;
use App\Models\Guardian;
use App\Models\Invoice;
use App\Models\MplsAttendance;
use App\Models\MplsEvent;
use App\Models\MplsGroup;
use App\Models\MplsParticipant;
use App\Models\Payment;
use App\Models\ReRegistration;
use App\Models\ReRegistrationItem;
use App\Models\ReRegistrationRequirement;
use App\Models\Role;
use App\Models\SelectionComponent;
use App\Models\Student;
use App\Models\User;
use App\Models\UserRole;
use App\Models\WaitingListEntry;
use App\Support\ApplicationStatus as AppStatus;
use App\Support\DecisionType;
use App\Support\DocumentStatus;
use App\Support\EnrollmentStatus;
use App\Support\InvoiceStatus;
use App\Support\MplsAttendanceStatus;
use App\Support\MplsParticipantStatus;
use App\Support\PaymentStatus;
use App\Support\ReRegistrationItemStatus;
use App\Support\ReRegistrationStatus;
use App\Support\StudentStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Rich demo data for exploring and testing every SPMB feature locally.
 * Idempotent; never run in production.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'Rahasia-123';

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('DemoSeeder must not run in production: it creates accounts with a known password.');
        }

        // 1. Tahun Akademik & Periode Gelombang
        $year = AcademicYear::firstOrCreate(['name' => '2026/2027'], [
            'start_date' => '2026-07-01',
            'end_date' => '2027-06-30',
            'is_active' => true,
        ]);

        $period = AdmissionPeriod::firstOrCreate(['academic_year_id' => $year->id, 'code' => 'G1'], [
            'name' => 'Gelombang 1',
            'registration_start' => now()->subDays(14),
            'registration_end' => now()->addMonths(2),
            'announcement_at' => now()->subDays(2),
            'quota' => 100,
            'is_active' => true,
        ]);

        AdmissionPeriod::firstOrCreate(['academic_year_id' => $year->id, 'code' => 'G2'], [
            'name' => 'Gelombang 2',
            'registration_start' => now()->addMonths(2),
            'registration_end' => now()->addMonths(4),
            'announcement_at' => now()->addMonths(4)->addDays(7),
            'quota' => 80,
            'is_active' => true,
        ]);

        // 2. Persyaratan Dokumen
        $reqKk = DocumentRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'KK'], [
            'name' => 'Kartu Keluarga',
            'allowed_mime_types' => ['application/pdf', 'image/jpeg', 'image/png'],
            'max_file_size_bytes' => 2 * 1024 * 1024,
            'sort_order' => 1,
        ]);

        $reqAkta = DocumentRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'AKTA'], [
            'name' => 'Akta Kelahiran',
            'allowed_mime_types' => ['application/pdf', 'image/jpeg', 'image/png'],
            'max_file_size_bytes' => 2 * 1024 * 1024,
            'sort_order' => 2,
        ]);

        // 3. Komponen Seleksi
        $compWritten = SelectionComponent::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'WRITTEN'], [
            'name' => 'Tes Akademik & Potensi',
            'weight' => '60.00',
            'max_score' => '100.00',
            'minimum_score' => '65.00',
            'sort_order' => 1,
        ]);

        $compInterview = SelectionComponent::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'INTERVIEW'], [
            'name' => 'Wawancara & Kepribadian',
            'weight' => '40.00',
            'max_score' => '100.00',
            'minimum_score' => '65.00',
            'sort_order' => 2,
        ]);

        // 4. Persyaratan Daftar Ulang
        $reqUniform = ReRegistrationRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'UNIFORM'], [
            'name' => 'Konfirmasi Ukuran Seragam',
            'sort_order' => 1,
        ]);

        $reqAgreement = ReRegistrationRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'AGREEMENT'], [
            'name' => 'Surat Pernyataan Tata Tertib',
            'sort_order' => 2,
        ]);

        // 5. Akun Pengguna Demo untuk Setiap Pos & Peran
        $staffUsers = [];
        foreach (Role::all() as $role) {
            $user = User::firstOrCreate(['email' => "{$role->code}@demo.test"], [
                'name' => $role->name.' Demo',
                'password' => self::PASSWORD,
            ]);
            UserRole::firstOrCreate(['user_id' => $user->id, 'role_id' => $role->id]);
            $staffUsers[$role->code] = $user;
        }

        $superAdmin = $staffUsers['super_admin'] ?? User::first();
        $verifier = $staffUsers['verifier'] ?? $superAdmin;
        $financeStaff = $staffUsers['finance'] ?? $superAdmin;
        $assessorStaff = $staffUsers['assessor'] ?? $superAdmin;
        $principalStaff = $staffUsers['principal'] ?? $superAdmin;
        $mplsOfficer = $staffUsers['mpls_officer'] ?? $superAdmin;
        $parentDemo = $staffUsers['parent'] ?? $superAdmin;

        // 6. Kelompok MPLS
        $gugus1 = MplsGroup::firstOrCreate(['academic_year_id' => $year->id, 'code' => 'GUGUS-1'], [
            'name' => 'Gugus 1 - Garuda',
            'capacity' => 30,
            'mentor_name' => 'Kak Bima Perkasa, S.Pd.',
            'description' => 'Kelompok pengenalan lingkungan kelas sains dan teknologi.',
        ]);

        $gugus2 = MplsGroup::firstOrCreate(['academic_year_id' => $year->id, 'code' => 'GUGUS-2'], [
            'name' => 'Gugus 2 - Rajawali',
            'capacity' => 30,
            'mentor_name' => 'Kak Sarah Nurhaliza, S.Pd.',
            'description' => 'Kelompok pengenalan lingkungan kelas sosial dan kebahasaan.',
        ]);

        // 7. Data Calon Siswa (Pendaftar) dengan Berbagai Status Alur SPMB
        $applicantsData = [
            // 1. Enrolled Student #1
            [
                'parent_email' => 'wali.rizky@demo.test',
                'parent_name' => 'Ir. Budi Pratama',
                'student_name' => 'Muhammad Rizky Pratama',
                'gender' => 'MALE',
                'nisn' => '0091234501',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-04-12',
                'city' => 'Kota Bandung',
                'school' => 'SMP Negeri 1 Bandung',
                'reg_no' => 'REG-2026-0001',
                'status' => AppStatus::ENROLLED,
                'scores' => [92.0, 90.0], // 60% * 92 + 40% * 90 = 91.20
                'decision' => DecisionType::ACCEPTED,
                'rank' => 1,
                'student_no' => '202607001',
                'mpls_group' => $gugus1,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 2. Enrolled Student #2
            [
                'parent_email' => 'wali.aisyah@demo.test',
                'parent_name' => 'Hendra Wijaya, S.E.',
                'student_name' => 'Aisyah Nur Ramadhani',
                'gender' => 'FEMALE',
                'nisn' => '0091234502',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-08-25',
                'city' => 'Kota Bandung',
                'school' => 'SMP Negeri 2 Bandung',
                'reg_no' => 'REG-2026-0002',
                'status' => AppStatus::ENROLLED,
                'scores' => [88.0, 94.0], // 52.8 + 37.6 = 90.40
                'decision' => DecisionType::ACCEPTED,
                'rank' => 2,
                'student_no' => '202607002',
                'mpls_group' => $gugus1,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 3. Enrolled Student #3
            [
                'parent_email' => 'wali.fajar@demo.test',
                'parent_name' => 'Agus Hidayat',
                'student_name' => 'Fajar Hidayat',
                'gender' => 'MALE',
                'nisn' => '0091234503',
                'birth_place' => 'Cimahi',
                'birth_date' => '2011-02-18',
                'city' => 'Kota Cimahi',
                'school' => 'MTs Negeri 1 Kota Cimahi',
                'reg_no' => 'REG-2026-0003',
                'status' => AppStatus::ENROLLED,
                'scores' => [86.0, 88.0], // 51.6 + 35.2 = 86.80
                'decision' => DecisionType::ACCEPTED,
                'rank' => 3,
                'student_no' => '202607003',
                'mpls_group' => $gugus2,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 4. Kayla Az-Zahra (Anak dari parent@demo.test - Diterima, siap coba bayar / daftar ulang)
            [
                'parent_email' => 'parent@demo.test',
                'parent_name' => 'Ahmad Fadillah (Parent Demo)',
                'student_name' => 'Kayla Az-Zahra',
                'gender' => 'FEMALE',
                'nisn' => '0091234504',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-09-10',
                'city' => 'Kota Bandung',
                'school' => 'SMP Taruna Bakti Bandung',
                'reg_no' => 'REG-2026-0004',
                'status' => AppStatus::ACCEPTED,
                'scores' => [84.0, 86.0], // 84.80
                'decision' => DecisionType::ACCEPTED,
                'rank' => 4,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 5. Sedang Daftar Ulang (Re-Registration in Progress)
            [
                'parent_email' => 'wali.dimas@demo.test',
                'parent_name' => 'Bambang Sena',
                'student_name' => 'Dimas Arya Sena',
                'gender' => 'MALE',
                'nisn' => '0091234505',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-01-30',
                'city' => 'Kota Bandung',
                'school' => 'SMP Negeri 5 Bandung',
                'reg_no' => 'REG-2026-0005',
                'status' => AppStatus::RE_REGISTRATION,
                'scores' => [80.0, 85.0], // 82.00
                'decision' => DecisionType::ACCEPTED,
                'rank' => 5,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 6. Cadangan (Waitlisted #1)
            [
                'parent_email' => 'wali.nabila@demo.test',
                'parent_name' => 'Iwan Kurniawan',
                'student_name' => 'Nabila Syakieb',
                'gender' => 'FEMALE',
                'nisn' => '0091234506',
                'birth_place' => 'Cimahi',
                'birth_date' => '2011-06-14',
                'city' => 'Kota Cimahi',
                'school' => 'SMP Negeri 1 Cimahi',
                'reg_no' => 'REG-2026-0006',
                'status' => AppStatus::WAITLISTED,
                'scores' => [72.0, 74.0], // 72.80
                'decision' => DecisionType::WAITLISTED,
                'rank' => 6,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 7. Tidak Diterima (Rejected)
            [
                'parent_email' => 'wali.rafi@demo.test',
                'parent_name' => 'Dadang Fauzi',
                'student_name' => 'Rafi Ahmad Fauzi',
                'gender' => 'MALE',
                'nisn' => '0091234507',
                'birth_place' => 'Lembang',
                'birth_date' => '2011-11-05',
                'city' => 'Kabupaten Bandung Barat',
                'school' => 'SMP Darul Hikam',
                'reg_no' => 'REG-2026-0007',
                'status' => AppStatus::REJECTED,
                'scores' => [58.0, 62.0], // 59.60
                'decision' => DecisionType::REJECTED,
                'rank' => 7,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 8. Sudah Terverifikasi, Menunggu / Terjadwal Penilaian
            [
                'parent_email' => 'wali.sarah@demo.test',
                'parent_name' => 'Maman Suratman',
                'student_name' => 'Siti Sarah Maulida',
                'gender' => 'FEMALE',
                'nisn' => '0091234508',
                'birth_place' => 'Sumedang',
                'birth_date' => '2011-03-21',
                'city' => 'Kabupaten Sumedang',
                'school' => 'MTs As-Syifa Sumedang',
                'reg_no' => 'REG-2026-0008',
                'status' => AppStatus::ASSESSMENT_SCHEDULED,
                'scores' => null,
                'decision' => null,
                'rank' => null,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PAID,
            ],
            // 9. Baru Submit Berkas, Menunggu Verifikasi Staf Verifier
            [
                'parent_email' => 'wali.bintang@demo.test',
                'parent_name' => 'Eko Ramadhan',
                'student_name' => 'Bintang Ramadhan',
                'gender' => 'MALE',
                'nisn' => '0091234509',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-10-09',
                'city' => 'Kota Bandung',
                'school' => 'SMP Negeri 7 Bandung',
                'reg_no' => 'REG-2026-0009',
                'status' => AppStatus::SUBMITTED,
                'scores' => null,
                'decision' => null,
                'rank' => null,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PENDING, // Ada bukti bayar antre di Keuangan!
            ],
            // 10. Perlu Perbaikan Berkas (Revision Required)
            [
                'parent_email' => 'wali.tiara@demo.test',
                'parent_name' => 'Joko Prasetyo',
                'student_name' => 'Tiara Andini Putri',
                'gender' => 'FEMALE',
                'nisn' => '0091234510',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-05-19',
                'city' => 'Kota Bandung',
                'school' => 'SMP BPK Penabur Bandung',
                'reg_no' => 'REG-2026-0010',
                'status' => AppStatus::REVISION_REQUIRED,
                'scores' => null,
                'decision' => null,
                'rank' => null,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => PaymentStatus::PENDING, // Bukti bayar antre di Keuangan!
            ],
            // 11. Masih Draf Formulir
            [
                'parent_email' => 'wali.alif@demo.test',
                'parent_name' => 'Gunawan Wibisono',
                'student_name' => 'Alif Danendra',
                'gender' => 'MALE',
                'nisn' => '0091234511',
                'birth_place' => 'Bandung',
                'birth_date' => '2011-12-01',
                'city' => 'Kota Bandung',
                'school' => 'SMP Negeri 8 Bandung',
                'reg_no' => null,
                'status' => AppStatus::DRAFT,
                'scores' => null,
                'decision' => null,
                'rank' => null,
                'student_no' => null,
                'mpls_group' => null,
                'payment_status' => null,
            ],
        ];

        $enrolledStudents = [];

        foreach ($applicantsData as $data) {
            // A. Akun Orang Tua
            $parentUser = User::firstOrCreate(['email' => $data['parent_email']], [
                'name' => $data['parent_name'],
                'password' => self::PASSWORD,
            ]);
            $parentRole = Role::where('code', 'parent')->first();
            if ($parentRole) {
                UserRole::firstOrCreate(['user_id' => $parentUser->id, 'role_id' => $parentRole->id]);
            }

            // B. Profil Calon Siswa
            $applicant = Applicant::firstOrCreate(
                ['owner_user_id' => $parentUser->id, 'full_name' => $data['student_name']],
                [
                    'nisn' => $data['nisn'],
                    'gender' => $data['gender'],
                    'birth_place' => $data['birth_place'],
                    'birth_date' => $data['birth_date'],
                    'religion' => 'Islam',
                    'nationality' => 'Indonesia',
                    'address' => 'Jl. Pendidikan No. ' . rand(10, 150),
                    'province' => 'Jawa Barat',
                    'city' => $data['city'],
                    'previous_school_name' => $data['school'],
                ]
            );

            // C. Data Wali
            Guardian::firstOrCreate(
                ['applicant_id' => $applicant->id, 'relationship' => 'FATHER'],
                [
                    'full_name' => $data['parent_name'],
                    'phone' => '0812' . rand(10000000, 99999999),
                    'email' => $data['parent_email'],
                    'occupation' => 'Karyawan Swasta',
                    'is_primary_contact' => true,
                ]
            );

            // D. Berkas Pendaftaran (Aplikasi)
            $isDraft = $data['status'] === AppStatus::DRAFT;
            $submittedAt = $isDraft ? null : now()->subDays(rand(5, 12));
            $verifiedAt = in_array($data['status'], [AppStatus::VERIFIED, AppStatus::ASSESSMENT_SCHEDULED, AppStatus::ASSESSED, AppStatus::ACCEPTED, AppStatus::RE_REGISTRATION, AppStatus::ENROLLED, AppStatus::WAITLISTED, AppStatus::REJECTED])
                ? now()->subDays(4)
                : null;
            $assessedAt = $data['scores'] ? now()->subDays(3) : null;
            $decidedAt = $data['decision'] ? now()->subDays(2) : null;
            $enrolledAt = $data['status'] === AppStatus::ENROLLED ? now()->subDay() : null;

            $app = Application::firstOrCreate(
                ['applicant_id' => $applicant->id, 'admission_period_id' => $period->id],
                [
                    'registration_number' => $data['reg_no'],
                    'status' => $data['status'],
                    'submitted_at' => $submittedAt,
                    'verified_at' => $verifiedAt,
                    'assessed_at' => $assessedAt,
                    'decided_at' => $decidedAt,
                    'enrolled_at' => $enrolledAt,
                    'current_step' => $isDraft ? 2 : 5,
                    'completion_percentage' => $isDraft ? 40 : 100,
                ]
            );

            // E. Dokumen Terunggah
            if (! $isDraft) {
                $docStatusKk = $data['status'] === AppStatus::REVISION_REQUIRED ? DocumentStatus::REVISION_REQUIRED : DocumentStatus::VALID;
                ApplicationDocument::firstOrCreate(
                    ['application_id' => $app->id, 'requirement_id' => $reqKk->id],
                    [
                        'storage_key' => "documents/{$app->id}/kk.pdf",
                        'original_filename' => 'kartu_keluarga_' . Str::slug($data['student_name']) . '.pdf',
                        'mime_type' => 'application/pdf',
                        'file_size' => rand(350000, 750000),
                        'status' => $docStatusKk,
                        'uploaded_at' => $submittedAt,
                        'verified_at' => $verifiedAt,
                        'verified_by' => $verifiedAt ? $verifier->id : null,
                        'verification_note' => $docStatusKk === DocumentStatus::REVISION_REQUIRED ? 'Teks pada bagian NIK buram, mohon pindai ulang dokumen asli.' : null,
                    ]
                );

                ApplicationDocument::firstOrCreate(
                    ['application_id' => $app->id, 'requirement_id' => $reqAkta->id],
                    [
                        'storage_key' => "documents/{$app->id}/akta.jpg",
                        'original_filename' => 'akta_kelahiran_' . Str::slug($data['student_name']) . '.jpg',
                        'mime_type' => 'image/jpeg',
                        'file_size' => rand(250000, 600000),
                        'status' => DocumentStatus::VALID,
                        'uploaded_at' => $submittedAt,
                        'verified_at' => $verifiedAt,
                        'verified_by' => $verifiedAt ? $verifier->id : null,
                    ]
                );
            }

            // F. Keuangan (Tagihan Pendaftaran Rp 250.000)
            if (! $isDraft && $data['payment_status']) {
                $invStatus = $data['payment_status'] === PaymentStatus::PAID ? InvoiceStatus::PAID : InvoiceStatus::UNPAID;
                $invoice = Invoice::firstOrCreate(
                    ['application_id' => $app->id, 'type' => 'REGISTRATION'],
                    [
                        'invoice_number' => 'INV-REG-' . str_pad((string) rand(100, 9999), 5, '0', STR_PAD_LEFT),
                        'amount' => 250000.00,
                        'due_date' => now()->addDays(7),
                        'status' => $invStatus,
                        'description' => 'Biaya Formulir & Seleksi Pendaftaran',
                        'created_by' => $financeStaff->id,
                    ]
                );

                Payment::firstOrCreate(
                    ['invoice_id' => $invoice->id],
                    [
                        'amount' => 250000.00,
                        'method' => 'TRANSFER',
                        'reference_number' => 'TRX-' . strtoupper(Str::random(10)),
                        'proof_storage_key' => "payments/{$invoice->id}/proof.jpg",
                        'proof_original_filename' => 'bukti_transfer_' . Str::slug($data['student_name']) . '.jpg',
                        'proof_mime_type' => 'image/jpeg',
                        'proof_file_size' => rand(150000, 450000),
                        'status' => $data['payment_status'],
                        'paid_at' => now()->subDays(3),
                        'verified_at' => $data['payment_status'] === PaymentStatus::PAID ? now()->subDays(2) : null,
                        'verified_by' => $data['payment_status'] === PaymentStatus::PAID ? $financeStaff->id : null,
                    ]
                );
            }

            // G. Jadwal & Penilaian Seleksi
            if ($verifiedAt) {
                AssessmentSchedule::firstOrCreate(
                    ['application_id' => $app->id, 'component_id' => $compWritten->id],
                    [
                        'scheduled_at' => now()->subDays(3)->setTime(8, 0),
                        'location' => 'Gedung Utama Lt. 2',
                        'room' => 'Ruang Ujian A-101',
                        'status' => 'COMPLETED',
                    ]
                );

                AssessmentSchedule::firstOrCreate(
                    ['application_id' => $app->id, 'component_id' => $compInterview->id],
                    [
                        'scheduled_at' => now()->subDays(3)->setTime(10, 30),
                        'location' => 'Ruang Konseling & Wawancara',
                        'room' => 'Meja 03',
                        'status' => 'COMPLETED',
                    ]
                );
            }

            if ($data['scores']) {
                [$sWritten, $sInterview] = $data['scores'];
                $wWritten = ($sWritten * 60) / 100;
                $wInterview = ($sInterview * 40) / 100;
                $finalScore = $wWritten + $wInterview;

                Assessment::firstOrCreate(
                    ['application_id' => $app->id, 'component_id' => $compWritten->id],
                    [
                        'assessor_id' => $assessorStaff->id,
                        'score' => $sWritten,
                        'weighted_score' => $wWritten,
                        'assessed_at' => now()->subDays(3),
                        'notes' => 'Penguasaan logika dan literasi sangat baik.',
                    ]
                );

                Assessment::firstOrCreate(
                    ['application_id' => $app->id, 'component_id' => $compInterview->id],
                    [
                        'assessor_id' => $assessorStaff->id,
                        'score' => $sInterview,
                        'weighted_score' => $wInterview,
                        'assessed_at' => now()->subDays(3),
                        'notes' => 'Komunikatif, percaya diri, dan berakhlak mulia.',
                    ]
                );

                ApplicationScore::firstOrCreate(
                    ['application_id' => $app->id],
                    [
                        'raw_score' => $sWritten + $sInterview,
                        'final_score' => $finalScore,
                        'rank' => $data['rank'],
                        'calculated_at' => now()->subDays(3),
                    ]
                );

                if ($data['decision']) {
                    ApplicationDecision::firstOrCreate(
                        ['application_id' => $app->id],
                        [
                            'decision' => $data['decision'],
                            'final_score' => $finalScore,
                            'rank' => $data['rank'],
                            'decided_by' => $principalStaff->id,
                            'reason' => $data['decision'] === DecisionType::ACCEPTED
                                ? 'Selamat! Anda dinyatakan lolos seleksi penerimaan peserta didik baru.'
                                : ($data['decision'] === DecisionType::WAITLISTED
                                    ? 'Memenuhi passing grade, berada pada kuota antrean cadangan.'
                                    : 'Nilai seleksi belum memenuhi batas minimum kelulusan.'),
                            'published_at' => now()->subDays(2),
                        ]
                    );

                    if ($data['decision'] === DecisionType::WAITLISTED) {
                        WaitingListEntry::firstOrCreate(
                            ['application_id' => $app->id],
                            [
                                'position' => 1,
                                'score' => $finalScore,
                                'status' => 'WAITING',
                            ]
                        );
                    }
                }
            }

            // H. Daftar Ulang & Siswa Resmi
            if (in_array($data['status'], [AppStatus::ACCEPTED, AppStatus::RE_REGISTRATION, AppStatus::ENROLLED])) {
                $reRegStatus = $data['status'] === AppStatus::ENROLLED
                    ? ReRegistrationStatus::COMPLETED
                    : ($data['status'] === AppStatus::RE_REGISTRATION ? ReRegistrationStatus::IN_PROGRESS : ReRegistrationStatus::PENDING);

                $reReg = ReRegistration::firstOrCreate(
                    ['application_id' => $app->id],
                    [
                        'status' => $reRegStatus,
                        'confirmed_at' => now()->subDays(2),
                        'completed_at' => $reRegStatus === ReRegistrationStatus::COMPLETED ? now()->subDay() : null,
                    ]
                );

                ReRegistrationItem::firstOrCreate(
                    ['re_registration_id' => $reReg->id, 'requirement_id' => $reqUniform->id],
                    [
                        'status' => $reRegStatus === ReRegistrationStatus::COMPLETED ? ReRegistrationItemStatus::COMPLETED : ReRegistrationItemStatus::PENDING,
                        'notes' => 'Ukuran Seragam: L (Dewasa)',
                        'completed_at' => $reRegStatus === ReRegistrationStatus::COMPLETED ? now()->subDay() : null,
                    ]
                );

                ReRegistrationItem::firstOrCreate(
                    ['re_registration_id' => $reReg->id, 'requirement_id' => $reqAgreement->id],
                    [
                        'status' => $reRegStatus === ReRegistrationStatus::COMPLETED ? ReRegistrationItemStatus::COMPLETED : ReRegistrationItemStatus::PENDING,
                        'notes' => 'Surat pernyataan bermaterai telah ditandatangani orang tua.',
                        'completed_at' => $reRegStatus === ReRegistrationStatus::COMPLETED ? now()->subDay() : null,
                    ]
                );

                // Invoice Daftar Ulang Rp 3.500.000
                $tuitionPaid = $data['status'] === AppStatus::ENROLLED;
                $invTuition = Invoice::firstOrCreate(
                    ['application_id' => $app->id, 'type' => 'TUITION'],
                    [
                        'invoice_number' => 'INV-REG-' . str_pad((string) rand(5000, 9999), 5, '0', STR_PAD_LEFT),
                        'amount' => 3500000.00,
                        'due_date' => now()->addDays(5),
                        'status' => $tuitionPaid ? InvoiceStatus::PAID : InvoiceStatus::UNPAID,
                        'description' => 'Biaya Daftar Ulang & Seragam Sekolah',
                        'created_by' => $financeStaff->id,
                    ]
                );

                if ($tuitionPaid) {
                    Payment::firstOrCreate(
                        ['invoice_id' => $invTuition->id],
                        [
                            'amount' => 3500000.00,
                            'method' => 'TRANSFER',
                            'reference_number' => 'TRX-DU-' . strtoupper(Str::random(8)),
                            'proof_storage_key' => "payments/{$invTuition->id}/proof_tuition.jpg",
                            'proof_original_filename' => 'bukti_daftar_ulang_' . Str::slug($data['student_name']) . '.jpg',
                            'proof_mime_type' => 'image/jpeg',
                            'proof_file_size' => 280000,
                            'status' => PaymentStatus::PAID,
                            'paid_at' => now()->subDay(),
                            'verified_at' => now()->subDay(),
                            'verified_by' => $financeStaff->id,
                        ]
                    );
                }

                // Siswa Resmi & MPLS
                if ($data['status'] === AppStatus::ENROLLED && $data['student_no']) {
                    $enrollment = Enrollment::firstOrCreate(
                        ['application_id' => $app->id],
                        [
                            'status' => EnrollmentStatus::ACTIVE,
                            'enrolled_at' => now()->subDay(),
                            'enrolled_by' => $superAdmin->id,
                            'notes' => 'Daftar ulang tuntas dan divalidasi bagian kesiswaan.',
                        ]
                    );

                    $student = Student::firstOrCreate(
                        ['enrollment_id' => $enrollment->id],
                        [
                            'student_number' => $data['student_no'],
                            'nisn' => $data['nisn'],
                            'full_name' => $data['student_name'],
                            'gender' => $data['gender'],
                            'birth_place' => $data['birth_place'],
                            'birth_date' => $data['birth_date'],
                            'status' => StudentStatus::ACTIVE,
                        ]
                    );

                    $enrolledStudents[] = [
                        'student' => $student,
                        'group' => $data['mpls_group'] ?? $gugus1,
                    ];
                }
            }
        }

        // 8. Kegiatan MPLS & Presensi Siswa
        $eventApel = MplsEvent::firstOrCreate(
            ['academic_year_id' => $year->id, 'title' => 'Apel Pembukaan MPLS 2026/2027'],
            [
                'description' => 'Upacara pembukaan masa pengenalan lingkungan sekolah di lapangan utama.',
                'start_at' => now()->setTime(7, 30),
                'end_at' => now()->setTime(9, 0),
                'location' => 'Lapangan Utama Sekolah',
                'is_mandatory' => true,
            ]
        );

        $eventWawasan = MplsEvent::firstOrCreate(
            ['academic_year_id' => $year->id, 'title' => 'Materi Wawasan Wiyata Mandala'],
            [
                'description' => 'Pengenalan visi, misi, dan budaya berprestasi sekolah.',
                'start_at' => now()->setTime(9, 30),
                'end_at' => now()->setTime(11, 30),
                'location' => 'Aula Serbaguna',
                'is_mandatory' => true,
            ]
        );

        foreach ($enrolledStudents as $idx => $item) {
            $student = $item['student'];
            $group = $item['group'];

            $participant = MplsParticipant::firstOrCreate(
                ['student_id' => $student->id],
                [
                    'group_id' => $group->id,
                    'qr_token' => Str::random(32),
                    'status' => MplsParticipantStatus::ACTIVE,
                    'joined_at' => now()->subDay(),
                ]
            );

            // Presensi Apel: Semua Hadir
            MplsAttendance::firstOrCreate(
                ['event_id' => $eventApel->id, 'participant_id' => $participant->id],
                [
                    'status' => MplsAttendanceStatus::PRESENT,
                    'checked_at' => now()->setTime(7, 25),
                    'checked_by' => $mplsOfficer->id,
                    'notes' => 'Tepat waktu',
                ]
            );

            // Presensi Wawasan: Siswa ke-3 Izin/Sakit
            $statusWawasan = $idx === 2 ? MplsAttendanceStatus::SICK : MplsAttendanceStatus::PRESENT;
            MplsAttendance::firstOrCreate(
                ['event_id' => $eventWawasan->id, 'participant_id' => $participant->id],
                [
                    'status' => $statusWawasan,
                    'checked_at' => now()->setTime(9, 28),
                    'checked_by' => $mplsOfficer->id,
                    'notes' => $statusWawasan === MplsAttendanceStatus::SICK ? 'Izin ke UKS karena pusing' : 'Hadir aktif',
                ]
            );
        }

        // 9. Jejak Audit Realistis
        $auditLogs = [
            ['user' => $superAdmin, 'action' => 'SYSTEM_CONFIG_UPDATED', 'resource' => 'AcademicYear', 'reason' => 'Mengaktifkan tahun ajaran baru 2026/2027'],
            ['user' => $verifier, 'action' => 'DOCUMENT_VERIFIED', 'resource' => 'ApplicationDocument', 'reason' => 'Memverifikasi berkas pendaftar Aisyah Nur Ramadhani'],
            ['user' => $financeStaff, 'action' => 'PAYMENT_APPROVED', 'resource' => 'Payment', 'reason' => 'Konfirmasi pembayaran formulir pendaftaran'],
            ['user' => $assessorStaff, 'action' => 'SCORE_SUBMITTED', 'resource' => 'Assessment', 'reason' => 'Input nilai tes potensi akademik gelombang 1'],
            ['user' => $principalStaff, 'action' => 'SELECTION_ANNOUNCED', 'resource' => 'ApplicationDecision', 'reason' => 'Penetapan dan publikasi hasil kelulusan seleksi'],
            ['user' => $superAdmin, 'action' => 'SYSTEM_CLEAR_CACHE', 'resource' => 'System', 'reason' => 'Pembersihan cache berkala oleh Super Admin'],
        ];

        foreach ($auditLogs as $i => $log) {
            AuditLog::firstOrCreate(
                ['action' => $log['action'], 'reason' => $log['reason']],
                [
                    'user_id' => $log['user']->id,
                    'resource_type' => $log['resource'],
                    'resource_id' => (string) Str::uuid(),
                    'old_values' => ['status' => 'PENDING'],
                    'new_values' => ['status' => 'APPROVED'],
                    'ip_address' => '127.0.0.1',
                    'user_agent' => 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0',
                    'created_at' => now()->subHours(rand(1, 48)),
                ]
            );
        }
    }
}
