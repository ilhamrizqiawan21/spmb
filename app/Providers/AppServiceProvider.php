<?php

namespace App\Providers;

use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\Events\NotificationFailed;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // API responses are returned as plain JSON (no `data` envelope).
        JsonResource::withoutWrapping();

        // Delivery log for every notification, whatever the channel.
        Event::listen(NotificationSent::class, fn (NotificationSent $e) => $this->logDelivery($e, 'SENT'));
        Event::listen(NotificationFailed::class, fn (NotificationFailed $e) => $this->logDelivery($e, 'FAILED', json_encode($e->data) ?: null));
    }

    private function logDelivery(NotificationSent|NotificationFailed $event, string $status, ?string $error = null): void
    {
        NotificationLog::create([
            'user_id' => $event->notifiable instanceof User ? $event->notifiable->id : null,
            'notification' => class_basename($event->notification),
            'channel' => $event->channel,
            'status' => $status,
            'error' => $error,
            'created_at' => now(),
        ]);
    }
}
