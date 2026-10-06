<?php

namespace App\Models;

/** Delivery log entry written when a notification is sent or fails. */
class NotificationLog extends BaseModel
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
