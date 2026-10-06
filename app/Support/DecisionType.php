<?php

namespace App\Support;

final class DecisionType
{
    public const ACCEPTED = 'ACCEPTED';

    public const WAITLISTED = 'WAITLISTED';

    public const REJECTED = 'REJECTED';

    public const ALL = [self::ACCEPTED, self::WAITLISTED, self::REJECTED];
}
