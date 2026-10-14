<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** ERD §15: MPLS groups, participants (enrolled students only), events and attendance. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mpls_groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('code', 50);
            $table->unsignedInteger('capacity')->nullable();
            $table->string('mentor_name', 200)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->unique(['academic_year_id', 'code'], 'uq_mpls_groups_year_code');
        });

        Schema::create('mpls_participants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->unique()->constrained('students')->restrictOnDelete();
            $table->foreignUuid('group_id')->constrained('mpls_groups')->restrictOnDelete();
            // Random token only: the QR code never carries personal data (PRD §10.16).
            $table->string('qr_token', 64)->unique();
            $table->string('status', 30)->default('ACTIVE')->index();
            $table->dateTime('joined_at');
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();
            $table->index('group_id');
        });

        Schema::create('mpls_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            // NULL = applies to every group of the academic year.
            $table->foreignUuid('group_id')->nullable()->constrained('mpls_groups')->restrictOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->string('location', 255)->nullable();
            $table->boolean('is_mandatory')->default(true);
            $table->timestamps();
            $table->index(['academic_year_id', 'start_at']);
        });

        Schema::create('mpls_attendances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('mpls_events')->restrictOnDelete();
            $table->foreignUuid('participant_id')->constrained('mpls_participants')->restrictOnDelete();
            $table->string('status', 30);
            $table->dateTime('checked_at')->nullable();
            $table->foreignUuid('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['event_id', 'participant_id'], 'uq_mpls_attendance_event_participant');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mpls_attendances');
        Schema::dropIfExists('mpls_events');
        Schema::dropIfExists('mpls_participants');
        Schema::dropIfExists('mpls_groups');
    }
};
