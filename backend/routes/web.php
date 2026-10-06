<?php

use App\Http\Controllers\Api\SystemController;
use Illuminate\Support\Facades\Route;

// Infrastructure probes (no auth, outside the versioned API prefix).
Route::get('/health', [SystemController::class, 'health']);
Route::get('/ready', [SystemController::class, 'ready']);
