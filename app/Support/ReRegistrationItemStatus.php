<?php

namespace App\Support;

final class ReRegistrationItemStatus
{
    public const PENDING = 'PENDING';

    public const COMPLETED = 'COMPLETED';

    public const WAIVED = 'WAIVED';

    public const ALL = [self::PENDING, self::COMPLETED, self::WAIVED];
}
