<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SystemController extends ApiController
{
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'app' => config('spmb.name'),
            'version' => config('spmb.version'),
            'environment' => app()->environment(),
        ]);
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
}
