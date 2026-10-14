<?php

return [
    'name' => env('APP_NAME', 'SPMB Terpadu'),
    'version' => '0.1.0',

    // Private document storage disk (see config/filesystems.php). Never a public disk.
    'storage_disk' => env('SPMB_STORAGE_DISK', 'local'),

    // School identity and contact shown on the public home page. Empty values are hidden.
    'school' => [
        'name' => env('SPMB_SCHOOL_NAME', ''),
        'address' => env('SPMB_SCHOOL_ADDRESS', ''),
        'phone' => env('SPMB_SCHOOL_PHONE', ''),
        'whatsapp' => env('SPMB_SCHOOL_WHATSAPP', ''),
        'email' => env('SPMB_SCHOOL_EMAIL', ''),
        'website' => env('SPMB_SCHOOL_WEBSITE', ''),
        'office_hours' => env('SPMB_SCHOOL_OFFICE_HOURS', ''),
    ],

    'login_max_attempts' => 5,
    'login_window_seconds' => 900,

    // dompdf renders a whole report in memory; bigger reports must use XLSX or a narrower filter.
    'export_pdf_max_rows' => (int) env('SPMB_EXPORT_PDF_MAX_ROWS', 1000),
];
