<?php

namespace App\Notifications;

use App\Support\ApplicationStatus as S;
use Illuminate\Notifications\Messages\MailMessage;

/** Tells the parent that their application moved to a status they need to know about. */
class ApplicationStatusNotification extends AppNotification
{
    /** Statuses that trigger an email. Decision statuses are deliberately absent (see ResultAnnouncedNotification). */
    public const NOTIFIED = [S::SUBMITTED, S::REVISION_REQUIRED, S::VERIFIED];

    public function __construct(
        public readonly string $applicationId,
        public readonly string $registrationNumber,
        public readonly string $applicantName,
        public readonly string $status,
    ) {
        parent::__construct();
    }

    public function toMail(object $notifiable): MailMessage
    {
        $who = "{$this->applicantName} (no. {$this->registrationNumber})";
        $mail = (new MailMessage)->greeting($this->greeting($notifiable));

        match ($this->status) {
            S::SUBMITTED => $mail->subject('Pendaftaran SPMB diterima')
                ->line("Pendaftaran atas nama {$who} sudah kami terima dan akan segera diverifikasi panitia."),
            S::REVISION_REQUIRED => $mail->subject('Berkas pendaftaran SPMB perlu diperbaiki')
                ->line("Panitia menemukan berkas pada pendaftaran {$who} yang perlu diperbaiki.")
                ->line('Buka halaman pendaftaran untuk melihat catatan perbaikan, lalu unggah ulang berkas yang diminta.'),
            S::VERIFIED => $mail->subject('Pendaftaran SPMB terverifikasi')
                ->line("Pendaftaran atas nama {$who} sudah terverifikasi. Panitia akan menghubungi Anda untuk tahap seleksi berikutnya."),
        };

        return $mail->action('Lihat Pendaftaran', url('/applications/'.$this->applicationId));
    }
}
