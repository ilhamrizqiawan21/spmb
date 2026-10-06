<?php

namespace Tests\Feature;

use App\Models\Guardian;
use App\Support\Masking;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PrivacyTest extends TestCase
{
    private const NIK = '3273010101140001';

    private function seedApplicant(): array
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent);
        Guardian::where('applicant_id', $app->applicant_id)->update([
            'nik' => '3273015505800002', 'phone' => '081234567890', 'email' => 'ibu.budi@example.test',
            'monthly_income' => '7500000.00',
        ]);
        $app->applicant->update(['family_card_number' => '3273011234560003']);

        return [$parent, $app];
    }

    #[DataProvider('fullAccessRoles')]
    public function test_owner_and_verifying_roles_see_full_personal_data(?string $role): void
    {
        [$parent, $app] = $this->seedApplicant();
        $viewer = $role === null ? $parent : $this->makeUser($role);
        $base = self::API."/admission/applicants/{$app->applicant_id}";

        $this->as($viewer)->getJson($base)->assertOk()
            ->assertJsonPath('nik', self::NIK)->assertJsonPath('family_card_number', '3273011234560003');
        $this->getJson("{$base}/guardians")->assertOk()
            ->assertJsonPath('0.nik', '3273015505800002')->assertJsonPath('0.phone', '081234567890')
            ->assertJsonPath('0.email', 'ibu.budi@example.test')->assertJsonPath('0.monthly_income', '7500000.00');
    }

    /** @return array<string, array{?string}> */
    public static function fullAccessRoles(): array
    {
        return ['owner' => [null], 'verifier' => ['verifier'], 'admission_admin' => ['admission_admin'], 'principal' => ['principal']];
    }

    #[DataProvider('maskedRoles')]
    public function test_other_staff_get_masked_personal_data(string $role): void
    {
        [, $app] = $this->seedApplicant();
        $base = self::API."/admission/applicants/{$app->applicant_id}";

        $this->as($this->makeUser($role))->getJson($base)->assertOk()
            ->assertJsonPath('nik', '************0001')->assertJsonPath('family_card_number', '************0003')
            ->assertJsonPath('full_name', 'Budi Santoso');
        $this->getJson("{$base}/guardians")->assertOk()
            ->assertJsonPath('0.nik', '************0002')->assertJsonPath('0.phone', '********7890')
            ->assertJsonPath('0.email', 'i***@example.test')->assertJsonPath('0.monthly_income', null);
    }

    /** @return array<string, array{string}> */
    public static function maskedRoles(): array
    {
        return ['assessor' => ['assessor'], 'finance' => ['finance'], 'mpls_officer' => ['mpls_officer']];
    }

    public function test_masking_helpers(): void
    {
        $this->assertSame('************0001', Masking::value(self::NIK));
        $this->assertSame('***', Masking::value('123'), 'short values are fully masked');
        $this->assertNull(Masking::value(null));
        $this->assertSame('i***@example.test', Masking::email('ibu.budi@example.test'));
        $this->assertNull(Masking::email(null));
        $this->assertFalse(Masking::canSeeFull(null, null));
    }
}
