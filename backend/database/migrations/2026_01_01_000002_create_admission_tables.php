<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_years', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 50)->unique();
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        Schema::create('admission_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('code', 100);
            $table->dateTime('registration_start');
            $table->dateTime('registration_end');
            $table->dateTime('announcement_at')->nullable();
            $table->integer('quota')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('settings')->nullable();
            $table->timestamps();
            $table->unique(['academic_year_id', 'code'], 'uq_admission_periods_ay_code');
        });

        Schema::create('applicants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('nisn', 20)->nullable();
            $table->string('full_name', 200);
            $table->string('nickname', 100)->nullable();
            $table->string('gender', 20);
            $table->string('birth_place', 150);
            $table->date('birth_date');
            $table->string('religion', 50)->nullable();
            $table->string('nationality', 50)->default('Indonesia');
            $table->string('nik', 30)->nullable();
            $table->string('family_card_number', 30)->nullable();
            $table->text('address');
            $table->string('province', 100)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('village', 100)->nullable();
            $table->string('postal_code', 10)->nullable();
            $table->string('previous_school_name', 200)->nullable();
            $table->string('previous_school_npsn', 30)->nullable();
            $table->text('previous_school_address')->nullable();
            $table->timestamps();
        });

        Schema::create('guardians', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('applicant_id')->constrained('applicants')->cascadeOnDelete();
            $table->string('relationship', 30);
            $table->string('full_name', 200);
            $table->string('nik', 30)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('occupation', 150)->nullable();
            $table->string('education', 100)->nullable();
            $table->decimal('monthly_income', 15, 2)->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_primary_contact')->default(false);
            $table->timestamps();
            $table->unique(['applicant_id', 'relationship'], 'uq_guardians_applicant_rel');
        });

        Schema::create('applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('applicant_id')->constrained('applicants')->cascadeOnDelete();
            $table->foreignUuid('admission_period_id')->constrained('admission_periods')->restrictOnDelete();
            $table->string('registration_number', 50)->nullable()->unique();
            $table->string('status', 50)->default('DRAFT')->index();
            $table->dateTime('submitted_at')->nullable();
            $table->dateTime('verified_at')->nullable();
            $table->dateTime('assessed_at')->nullable();
            $table->dateTime('decided_at')->nullable();
            $table->dateTime('enrolled_at')->nullable();
            $table->integer('current_step')->default(1);
            $table->integer('completion_percentage')->default(0);
            $table->timestamps();
            $table->unique(['applicant_id', 'admission_period_id'], 'uq_applications_applicant_period');
        });

        Schema::create('application_status_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('applications')->cascadeOnDelete();
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50);
            $table->foreignUuid('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('document_requirements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('admission_period_id')->nullable()->constrained('admission_periods')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('code', 100);
            $table->text('description')->nullable();
            $table->boolean('is_required')->default(true);
            $table->json('allowed_mime_types');
            $table->unsignedBigInteger('max_file_size_bytes')->default(5242880);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['admission_period_id', 'code'], 'uq_doc_req_period_code');
        });

        Schema::create('application_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignUuid('requirement_id')->constrained('document_requirements')->restrictOnDelete();
            $table->text('storage_key');
            $table->string('original_filename', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('file_size');
            $table->string('checksum', 128)->nullable();
            $table->string('status', 30)->default('PENDING')->index();
            $table->dateTime('uploaded_at')->nullable();
            $table->dateTime('verified_at')->nullable();
            $table->foreignUuid('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('verification_note')->nullable();
            $table->integer('version')->default(1);
            $table->timestamps();
            $table->unique(['application_id', 'requirement_id', 'version'], 'uq_app_docs_app_req_ver');
        });

        Schema::create('document_revisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_document_id')->constrained('application_documents')->cascadeOnDelete();
            $table->foreignUuid('requested_by')->constrained('users')->cascadeOnDelete();
            $table->text('reason');
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach ([
            'document_revisions', 'application_documents', 'document_requirements',
            'application_status_histories', 'applications', 'guardians', 'applicants',
            'admission_periods', 'academic_years',
        ] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
