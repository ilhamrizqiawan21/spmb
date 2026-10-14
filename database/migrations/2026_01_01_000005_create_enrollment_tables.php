<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('re_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->unique()->constrained('applications')->cascadeOnDelete();
            $table->string('status', 30)->default('PENDING')->index();
            $table->dateTime('confirmed_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('re_registration_requirements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('admission_period_id')->constrained('admission_periods')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('code', 100);
            $table->boolean('is_required')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['admission_period_id', 'code'], 'uq_re_reg_req_period_code');
        });

        Schema::create('re_registration_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('re_registration_id')->constrained('re_registrations')->cascadeOnDelete();
            $table->foreignUuid('requirement_id')->constrained('re_registration_requirements')->cascadeOnDelete();
            $table->string('status', 30)->default('PENDING');
            $table->text('notes')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['re_registration_id', 'requirement_id'], 'uq_re_reg_item_reg_req');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('re_registration_items');
        Schema::dropIfExists('re_registration_requirements');
        Schema::dropIfExists('re_registrations');
    }
};
