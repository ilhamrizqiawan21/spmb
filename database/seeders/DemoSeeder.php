<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\AdmissionPeriod;
use App\Models\DocumentRequirement;
use App\Models\ReRegistrationRequirement;
use App\Models\Role;
use App\Models\SelectionComponent;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Database\Seeder;

/** Demo data for trying the app locally. Idempotent; never run in production. */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'Rahasia-123';

    public function run(): void
    {
        $year = AcademicYear::firstOrCreate(['name' => '2026/2027'], [
            'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => true,
        ]);

        $period = AdmissionPeriod::firstOrCreate(['academic_year_id' => $year->id, 'code' => 'G1'], [
            'name' => 'Gelombang 1',
            'registration_start' => now()->subDay(),
            'registration_end' => now()->addMonths(2),
            'quota' => 100,
            'is_active' => true,
        ]);

        DocumentRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'KK'], [
            'name' => 'Kartu Keluarga',
            'allowed_mime_types' => ['application/pdf', 'image/jpeg', 'image/png'],
            'max_file_size_bytes' => 2 * 1024 * 1024,
            'sort_order' => 1,
        ]);
        DocumentRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => 'AKTA'], [
            'name' => 'Akta Kelahiran',
            'allowed_mime_types' => ['application/pdf', 'image/jpeg', 'image/png'],
            'max_file_size_bytes' => 2 * 1024 * 1024,
            'sort_order' => 2,
        ]);

        foreach ([['WRITTEN', 'Tes Tertulis', '60.00', '100.00', 1], ['INTERVIEW', 'Wawancara', '40.00', '100.00', 2]] as [$code, $name, $weight, $max, $order]) {
            SelectionComponent::firstOrCreate(['admission_period_id' => $period->id, 'code' => $code], [
                'name' => $name, 'weight' => $weight, 'max_score' => $max, 'sort_order' => $order,
            ]);
        }

        foreach ([['UNIFORM', 'Ukuran Seragam', 1], ['AGREEMENT', 'Surat Pernyataan Orang Tua', 2]] as [$code, $name, $order]) {
            ReRegistrationRequirement::firstOrCreate(['admission_period_id' => $period->id, 'code' => $code], [
                'name' => $name, 'sort_order' => $order,
            ]);
        }

        // One account per role: <role>@demo.test
        foreach (Role::all() as $role) {
            $user = User::firstOrCreate(['email' => "{$role->code}@demo.test"], [
                'name' => $role->name.' Demo',
                'password' => self::PASSWORD,
            ]);
            UserRole::firstOrCreate(['user_id' => $user->id, 'role_id' => $role->id]);
        }
    }
}
