<?php

namespace Tests\Feature;

use App\Models\ApplicationDecision;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    private function decided(string $decision = 'ACCEPTED', ?string $publishedAt = null, ?array $period = null)
    {
        $parent = $this->makeUser('parent');
        $app = $this->makeApplication($parent, $this->makePeriod($period ?? []), 'ASSESSED');
        ApplicationDecision::create([
            'application_id' => $app->id, 'decision' => $decision, 'final_score' => '88.5000', 'rank' => 3,
            'decided_by' => $this->makeUser('principal')->id, 'published_at' => $publishedAt,
        ]);

        return [$parent, $app];
    }

    public function test_owner_sees_result_only_after_publication(): void
    {
        [$parent, $app] = $this->decided('ACCEPTED', now()->addDay()->toDateTimeString());
        $url = self::API."/selection/applications/{$app->id}/announcement";

        $this->as($parent)->getJson($url)->assertOk()->assertJsonPath('is_published', false)->assertJsonPath('message', 'Hasil seleksi belum diumumkan.');
        $this->as($this->makeUser('admission_admin'))->getJson($url)->assertJsonPath('is_published', true)->assertJsonPath('decision', 'ACCEPTED');

        ApplicationDecision::query()->update(['published_at' => now()->subMinute()]);
        $this->as($parent)->getJson($url)->assertJsonPath('is_published', true)->assertJsonPath('final_score', '88.5000')->assertJsonPath('rank', 3)
            ->assertJsonCount(3, 'next_steps');
        $this->as($this->makeUser('parent'))->getJson($url)->assertForbidden();
    }

    public function test_publish_period_announcements(): void
    {
        [$parent, $app] = $this->decided('REJECTED', null);
        $periodId = $app->admission_period_id;

        $this->as($parent)->postJson(self::API."/selection/periods/{$periodId}/publish-announcement")->assertForbidden();
        $this->as($this->makeUser('admission_admin'))->postJson(self::API."/selection/periods/{$periodId}/publish-announcement")
            ->assertOk()->assertJsonPath('published_count', 1);

        $this->as($parent)->getJson(self::API."/selection/applications/{$app->id}/announcement")->assertJsonPath('is_published', true)->assertJsonPath('decision', 'REJECTED');
    }

    public function test_public_lookup_masks_name_and_hides_unpublished(): void
    {
        [, $app] = $this->decided('WAITLISTED', now()->subHour()->toDateTimeString());
        $body = ['registration_number' => strtolower($app->registration_number), 'birth_date' => '2014-05-17'];

        $this->postJson(self::API.'/selection/announcements/lookup', $body)->assertOk()
            ->assertJsonPath('is_published', true)->assertJsonPath('applicant_name_masked', 'B**i S*****o')
            ->assertJsonPath('decision', 'WAITLISTED')->assertJsonMissingPath('final_score');

        $this->postJson(self::API.'/selection/announcements/lookup', ['birth_date' => '2000-01-01'] + $body)->assertStatus(400)
            ->assertJsonPath('error.details.detail.0', 'Nomor pendaftaran atau tanggal lahir tidak cocok.');
        $this->postJson(self::API.'/selection/announcements/lookup', ['registration_number' => 'x'])->assertStatus(400);

        ApplicationDecision::query()->update(['published_at' => null]);
        $this->postJson(self::API.'/selection/announcements/lookup', $body)->assertOk()->assertJsonPath('is_published', false);
    }

    public function test_result_letter_is_a_pdf_and_gated(): void
    {
        [$parent, $app] = $this->decided('ACCEPTED', now()->subHour()->toDateTimeString());
        $url = self::API."/selection/applications/{$app->id}/announcement/letter";

        $res = $this->as($parent)->get($url)->assertOk();
        $this->assertSame('application/pdf', $res->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF-1.4', $res->getContent());
        $this->assertStringContainsString($app->registration_number, $res->getContent());
        $this->assertStringEndsWith("%%EOF\n", $res->getContent());

        ApplicationDecision::query()->update(['published_at' => now()->addDay()]);
        $this->getJson($url)->assertForbidden();
    }
}
