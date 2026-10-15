<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** ERD §14: an enrollment turns an accepted, re-registered application into an official student. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->unique()->constrained('applications')->restrictOnDelete();
            $table->string('status', 30)->default('ACTIVE')->index();
            $table->dateTime('enrolled_at');
            $table->foreignUuid('enrolled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Operational snapshot of the applicant's core data; the application history stays untouched.
        Schema::create('students', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('enrollment_id')->unique()->constrained('enrollments')->restrictOnDelete();
            $table->string('student_number', 50)->unique();
            $table->string('nisn', 20)->nullable();
            $table->string('full_name', 200);
            $table->string('gender', 20);
            $table->string('birth_place', 150);
            $table->date('birth_date');
            $table->string('status', 30)->default('ACTIVE')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
        Schema::dropIfExists('enrollments');
    }
};
