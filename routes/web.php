<?php

use App\Http\Controllers\Api\SystemController;
use Illuminate\Support\Facades\Route;

// Infrastructure probes (no auth, outside the versioned API prefix).
Route::get('/health', [SystemController::class, 'health']);
Route::get('/ready', [SystemController::class, 'ready']);

// React SPA shell: every other GET path is handled by the client-side router.
Route::view('/{any?}', 'app')->where('any', '^(?!api(/|$)).*$');
