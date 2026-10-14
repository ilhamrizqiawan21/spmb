<?php

namespace App\Support;

final class InvoiceStatus
{
    public const UNPAID = 'UNPAID';

    public const PARTIALLY_PAID = 'PARTIALLY_PAID';

    public const PAID = 'PAID';

    public const EXPIRED = 'EXPIRED';

    public const CANCELLED = 'CANCELLED';

    /** Statuses that still stand between the applicant and re-registration/enrollment. */
    public const OUTSTANDING = [self::UNPAID, self::PARTIALLY_PAID, self::EXPIRED];

    /** Statuses that accept new payments. */
    public const PAYABLE = [self::UNPAID, self::PARTIALLY_PAID];
}
