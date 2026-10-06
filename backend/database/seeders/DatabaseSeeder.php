<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Roles and permissions come from migrations; demo data is for non-production only. */
    public function run(): void
    {
        if (! app()->environment('production')) {
            $this->call(DemoSeeder::class);
        }
    }
}
