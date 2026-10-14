<?php

namespace App\Support;

final class ApplicationStatus
{
    public const DRAFT = 'DRAFT';

    public const SUBMITTED = 'SUBMITTED';

    public const UNDER_VERIFICATION = 'UNDER_VERIFICATION';

    public const REVISION_REQUIRED = 'REVISION_REQUIRED';

    public const RESUBMITTED = 'RESUBMITTED';

    public const VERIFIED = 'VERIFIED';

    public const ASSESSMENT_SCHEDULED = 'ASSESSMENT_SCHEDULED';

    public const ASSESSED = 'ASSESSED';

    public const ACCEPTED = 'ACCEPTED';

    public const WAITLISTED = 'WAITLISTED';

    public const REJECTED = 'REJECTED';

    public const RE_REGISTRATION = 'RE_REGISTRATION';

    public const RE_REGISTRATION_VERIFIED = 'RE_REGISTRATION_VERIFIED';

    public const ENROLLED = 'ENROLLED';

    public const MPLS_ACTIVE = 'MPLS_ACTIVE';

    public const MPLS_COMPLETED = 'MPLS_COMPLETED';

    public const COMPLETED = 'COMPLETED';

    /** @return list<string> */
    public static function all(): array
    {
        return array_values((new \ReflectionClass(self::class))->getConstants());
    }
}
