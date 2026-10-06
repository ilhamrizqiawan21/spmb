<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Delivery log: one row per notification sent (or failed) through any channel.
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('notification', 100);
            $table->string('channel', 30);
            $table->string('status', 10)->index();
            $table->text('error')->nullable();
            $table->dateTime('created_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
