<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('application_id')->constrained('applications')->restrictOnDelete();
            $table->string('invoice_number', 50)->unique();
            $table->string('type', 50);
            $table->decimal('amount', 15, 2);
            $table->dateTime('due_date')->nullable();
            $table->string('status', 30)->default('UNPAID')->index();
            $table->text('description')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('application_id');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('method', 50);
            $table->string('reference_number', 100)->nullable();
            $table->text('proof_storage_key')->nullable();
            $table->string('proof_original_filename', 255)->nullable();
            $table->string('proof_mime_type', 100)->nullable();
            $table->unsignedBigInteger('proof_file_size')->nullable();
            $table->string('proof_checksum', 64)->nullable();
            $table->string('status', 30)->default('PENDING')->index();
            $table->dateTime('paid_at')->nullable();
            $table->dateTime('verified_at')->nullable();
            $table->foreignUuid('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('verification_note')->nullable();
            $table->timestamps();

            $table->index('invoice_id');
        });

        // Append-only status trail for payments.
        Schema::create('payment_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->foreignUuid('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->dateTime('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_histories');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
    }
};
