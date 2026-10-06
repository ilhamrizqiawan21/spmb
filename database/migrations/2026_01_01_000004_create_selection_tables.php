<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('selection_components', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('admission_period_id')->constrained('admission_periods')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('code', 100);
            $table->text('description')->nullable();
            $table->decimal('weight', 5, 2);
            $table->decimal('max_score', 8, 2)->default(100);
            $table->decimal('minimum_score', 8, 2)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['admission_period_id', 'code'], 'uq_sel_comp_period_code');
        });

        Schema::create('assessment_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignUuid('component_id')->constrained('selection_components')->cascadeOnDelete();
            $table->dateTime('scheduled_at')->index();
            $table->string('location', 255)->nullable();
            $table->string('room', 100)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 30)->default('SCHEDULED');
            $table->timestamps();
        });

        Schema::create('assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignUuid('component_id')->constrained('selection_components')->cascadeOnDelete();
            $table->foreignUuid('assessor_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('score', 8, 2);
            $table->decimal('weighted_score', 10, 4)->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('assessed_at')->nullable();
            $table->timestamps();
            $table->unique(['application_id', 'component_id'], 'uq_assessments_app_comp');
        });

        Schema::create('application_scores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->unique()->constrained('applications')->cascadeOnDelete();
            $table->decimal('raw_score', 12, 4);
            $table->decimal('final_score', 12, 4)->index();
            $table->integer('rank')->nullable()->index();
            $table->dateTime('calculated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('application_decisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->unique()->constrained('applications')->cascadeOnDelete();
            $table->string('decision', 30)->index();
            $table->decimal('final_score', 12, 4)->nullable();
            $table->integer('rank')->nullable();
            $table->foreignUuid('decided_by')->constrained('users')->cascadeOnDelete();
            $table->text('reason')->nullable();
            $table->dateTime('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('waiting_list_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->unique()->constrained('applications')->cascadeOnDelete();
            $table->integer('position')->index();
            $table->decimal('score', 12, 4);
            $table->string('status', 30)->default('WAITING')->index();
            $table->dateTime('promoted_at')->nullable();
            $table->foreignUuid('promoted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('decision_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_decision_id')->constrained('application_decisions')->cascadeOnDelete();
            $table->string('old_decision', 30);
            $table->string('new_decision', 30);
            $table->foreignUuid('changed_by')->constrained('users')->cascadeOnDelete();
            $table->text('reason');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach ([
            'decision_histories', 'waiting_list_entries', 'application_decisions',
            'application_scores', 'assessments', 'assessment_schedules', 'selection_components',
        ] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
