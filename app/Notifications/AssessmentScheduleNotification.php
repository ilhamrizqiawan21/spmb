<?php

namespace App\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Notifications\Messages\MailMessage;

/** Assessment appointment for an applicant: newly scheduled, rescheduled, or cancelled. */
class AssessmentScheduleNotification extends AppNotification
{
    public const SCHEDULED = 'SCHEDULED';

    public const RESCHEDULED = 'RESCHEDULED';

    public const CANCELLED = 'CANCELLED';

    public function __construct(
        public readonly string $applicationId,
        public readonly string $applicantName,
        public readonly string $componentName,
        public readonly CarbonInterface $scheduledAt,
        public readonly ?string $location,
        public readonly ?string $room,
        public readonly ?string $notes,
        public readonly string $kind,
    ) {
        parent::__construct();
    }

    public function toMail(object $notifiable): MailMessage
    {
        $when = $this->scheduledAt->copy()->timezone('Asia/Jakarta')->locale('id')->translatedFormat('l, j F Y \p\u\k\u\l H.i').' WIB';
        $place = collect([$this->location, $this->room ? "ruang {$this->room}" : null])->filter()->implode(', ');

        $mail = (new MailMessage)->greeting($this->greeting($notifiable));

        if ($this->kind === self::CANCELLED) {
            return $mail->subject('Jadwal asesmen SPMB dibatalkan')
                ->line("Jadwal asesmen {$this->componentName} untuk {$this->applicantName} pada {$when} dibatalkan.")
                ->line('Panitia akan menginformasikan jadwal pengganti.')
                ->action('Lihat Pendaftaran', url('/applications/'.$this->applicationId));
        }

        $mail->subject($this->kind === self::RESCHEDULED ? 'Jadwal asesmen SPMB diubah' : 'Jadwal asesmen SPMB')
            ->line(($this->kind === self::RESCHEDULED ? 'Jadwal asesmen diperbarui. ' : '')."Asesmen {$this->componentName} untuk {$this->applicantName}:")
            ->line("Waktu: {$when}");
        if ($place !== '') {
            $mail->line("Tempat: {$place}");
        }
        if ($this->notes) {
            $mail->line("Catatan: {$this->notes}");
        }

        return $mail->action('Lihat Pendaftaran', url('/applications/'.$this->applicationId));
    }
}
