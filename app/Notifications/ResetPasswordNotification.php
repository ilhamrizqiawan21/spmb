<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/** Password reset email (Indonesian) pointing at the SPA's /reset-password page. */
class ResetPasswordNotification extends ResetPassword implements ShouldQueue
{
    use Queueable;

    public function toMail($notifiable): MailMessage
    {
        $url = url('/reset-password').'?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
        $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Atur ulang kata sandi SPMB')
            ->greeting('Halo '.$notifiable->name.',')
            ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun SPMB Anda.')
            ->action('Atur Ulang Kata Sandi', $url)
            ->line("Tautan ini berlaku {$minutes} menit.")
            ->line('Jika Anda tidak meminta ini, abaikan email ini; kata sandi Anda tidak berubah.');
    }
}
