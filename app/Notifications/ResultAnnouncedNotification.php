<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;

/** Announcement is out. The email never states the decision itself: parents read it in the portal. */
class ResultAnnouncedNotification extends AppNotification
{
    public function __construct(
        public readonly string $applicationId,
        public readonly string $registrationNumber,
        public readonly string $applicantName,
    ) {
        parent::__construct();
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Hasil seleksi SPMB sudah diumumkan')
            ->greeting($this->greeting($notifiable))
            ->line("Hasil seleksi untuk {$this->applicantName} (no. {$this->registrationNumber}) sudah diumumkan.")
            ->line('Untuk menjaga kerahasiaan, isi keputusan tidak kami cantumkan di email ini. Silakan masuk ke portal untuk melihatnya.')
            ->action('Lihat Hasil Seleksi', url('/applications/'.$this->applicationId));
    }
}
