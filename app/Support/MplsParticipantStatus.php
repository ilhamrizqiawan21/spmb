<?php

namespace App\Support;

final class MplsParticipantStatus
{
    public const ACTIVE = 'ACTIVE';

    public const COMPLETED = 'COMPLETED';

    public const WITHDRAWN = 'WITHDRAWN';

    public const ALL = [self::ACTIVE, self::COMPLETED, self::WITHDRAWN];
}
