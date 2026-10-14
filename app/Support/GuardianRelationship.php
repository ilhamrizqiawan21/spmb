<?php

namespace App\Support;

final class GuardianRelationship
{
    public const FATHER = 'FATHER';

    public const MOTHER = 'MOTHER';

    public const GUARDIAN = 'GUARDIAN';

    public const ALL = [self::FATHER, self::MOTHER, self::GUARDIAN];
}
