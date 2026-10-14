<?php

namespace Tests\Feature;

use Tests\TestCase;

class SpaShellTest extends TestCase
{
    public function test_root_and_client_side_routes_serve_the_spa_shell(): void
    {
        $this->withoutVite();

        $this->get('/')->assertOk()->assertSee('<div id="root">', false);
        $this->get('/verifikasi/123')->assertOk()->assertSee('<div id="root">', false);
    }

    public function test_unknown_api_paths_still_return_json_404(): void
    {
        $this->withoutVite();

        $this->getJson(self::API.'/does-not-exist')->assertNotFound();
        $this->get('/health')->assertOk()->assertJson(['status' => 'ok']);
    }
}
