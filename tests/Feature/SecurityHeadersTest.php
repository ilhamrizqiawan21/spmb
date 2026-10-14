<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_html_shell_gets_baseline_headers_and_a_strict_csp(): void
    {
        $this->withoutVite();

        $res = $this->get('/')->assertOk();

        $res->assertHeader('X-Content-Type-Options', 'nosniff');
        $res->assertHeader('X-Frame-Options', 'DENY');
        $res->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $csp = $res->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertStringContainsString("script-src 'self'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
        $this->assertStringNotContainsString('unsafe-eval', $csp);
        $this->assertStringNotContainsString('script-src \'self\' \'unsafe-inline\'', $csp);
    }

    public function test_json_responses_get_baseline_headers_but_no_csp(): void
    {
        $res = $this->getJson('/health')->assertOk();

        $res->assertHeader('X-Content-Type-Options', 'nosniff');
        $res->assertHeader('X-Frame-Options', 'DENY');
        $this->assertNull($res->headers->get('Content-Security-Policy'));
    }

    public function test_error_responses_also_carry_the_headers(): void
    {
        $this->getJson(self::API.'/audit-logs')->assertUnauthorized()
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_hsts_only_on_https_in_production(): void
    {
        $this->getJson('/health', ['X-Forwarded-Proto' => 'https'])->assertHeaderMissing('Strict-Transport-Security');

        $this->app->detectEnvironment(fn () => 'production');
        $this->getJson('/health')->assertHeaderMissing('Strict-Transport-Security');

        $this->call('GET', 'https://localhost/health', [], [], [], ['HTTPS' => 'on', 'HTTP_ACCEPT' => 'application/json'])
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    public function test_cors_never_allows_an_unlisted_origin(): void
    {
        $res = $this->call('OPTIONS', self::API.'/auth/login', [], [], [], [
            'HTTP_ORIGIN' => 'https://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        ]);

        $allowed = $res->headers->get('Access-Control-Allow-Origin');
        $this->assertNotSame('*', $allowed);
        $this->assertNotSame('https://evil.example', $allowed);
    }
}
