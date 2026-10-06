<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Domain CHECK constraints. Only applied on MySQL/MariaDB (8.0.16+); other drivers
 * (e.g. SQLite in tests) rely on the same rules enforced in the service layer.
 */
return new class extends Migration
{
    private const CHECKS = [
        ['academic_years', 'ck_academic_years_start_before_end', 'start_date < end_date'],
        ['admission_periods', 'ck_admission_periods_start_before_end', 'registration_start < registration_end'],
        ['admission_periods', 'ck_admission_periods_quota_non_negative', 'quota IS NULL OR quota >= 0'],
        ['guardians', 'ck_guardians_relationship_valid', "relationship IN ('FATHER','MOTHER','GUARDIAN')"],
        ['selection_components', 'ck_selection_comp_weight_range', 'weight >= 0 AND weight <= 100'],
    ];

    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }
        foreach (self::CHECKS as [$table, $name, $expr]) {
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$name} CHECK ({$expr})");
        }
    }

    public function down(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }
        foreach (self::CHECKS as [$table, $name]) {
            DB::statement("ALTER TABLE {$table} DROP CHECK {$name}");
        }
    }
};
