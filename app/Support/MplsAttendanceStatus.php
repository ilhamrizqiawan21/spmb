<?php

namespace App\Support;

final class MplsAttendanceStatus
{
    public const PRESENT = 'PRESENT';

    public const SICK = 'SICK';

    public const PERMITTED = 'PERMITTED';

    public const ABSENT = 'ABSENT';

    public const ALL = [self::PRESENT, self::SICK, self::PERMITTED, self::ABSENT];
}
