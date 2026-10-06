<?php

namespace Tests;

use App\Models\AcademicYear;
use App\Models\AdmissionPeriod;
use App\Models\Applicant;
use App\Models\Application;
use App\Models\Guardian;
use App\Models\Role;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected const API = '/api/v1';

    protected function makeUser(string $role = 'parent', array $attrs = []): User
    {
        static $n = 0;
        $n++;
        $user = User::create($attrs + [
            'name' => ucfirst($role)." {$n}",
            'email' => "{$role}{$n}@example.test",
            'password' => 'Str0ng-Passw0rd!',
        ]);
        UserRole::create(['user_id' => $user->id, 'role_id' => Role::where('code', $role)->firstOrFail()->id]);

        return $user;
    }

    protected function as(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
    }

    protected function makePeriod(array $attrs = [], bool $activeYear = true): AdmissionPeriod
    {
        static $n = 0;
        $n++;
        $year = AcademicYear::firstOrCreate(['name' => '2026/2027'], [
            'start_date' => '2026-07-01', 'end_date' => '2027-06-30', 'is_active' => $activeYear,
        ]);

        return AdmissionPeriod::create($attrs + [
            'academic_year_id' => $year->id,
            'name' => "Gelombang {$n}",
            'code' => "G{$n}",
            'registration_start' => now()->subDay(),
            'registration_end' => now()->addMonth(),
            'is_active' => true,
        ]);
    }

    protected function makeApplicant(User $owner, array $attrs = []): Applicant
    {
        return Applicant::create($attrs + [
            'owner_user_id' => $owner->id,
            'full_name' => 'Budi Santoso',
            'gender' => 'MALE',
            'birth_place' => 'Bandung',
            'birth_date' => '2014-05-17',
            'religion' => 'Islam',
            'address' => 'Jl. Merdeka 1',
            'nik' => '3273010101140001',
        ]);
    }

    /** Draft application owned by $owner, with one guardian so it can be submitted. */
    protected function makeApplication(User $owner, ?AdmissionPeriod $period = null, string $status = 'DRAFT'): Application
    {
        $applicant = $this->makeApplicant($owner);
        Guardian::create(['applicant_id' => $applicant->id, 'relationship' => 'FATHER', 'full_name' => 'Pak Santoso']);
        $period ??= $this->makePeriod();
        static $seq = 0;
        $seq++;

        return Application::create([
            'applicant_id' => $applicant->id,
            'admission_period_id' => $period->id,
            'registration_number' => sprintf('REG-2026-%06d', $seq),
            'status' => $status,
            'submitted_at' => $status === 'DRAFT' ? null : now(),
        ]);
    }
}
