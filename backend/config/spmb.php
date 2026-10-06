<?php

return [
    'name' => env('APP_NAME', 'SPMB Terpadu'),
    'version' => '0.1.0',

    // Private document storage disk (see config/filesystems.php). Never a public disk.
    'storage_disk' => env('SPMB_STORAGE_DISK', 'local'),

    'login_max_attempts' => 5,
    'login_window_seconds' => 900,
];
