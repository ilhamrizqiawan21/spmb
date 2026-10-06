<?php

namespace App\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Private object storage for applicant documents.
 *
 * Backed by a non-public Laravel filesystem disk (`config('spmb.storage_disk')`, local by
 * default, S3-compatible via the `s3` disk). Objects are addressed by opaque UUID keys and are
 * never served via permanent public URLs; access goes through authorization or signed tokens.
 */
class PrivateStorage
{
    private function disk(): Filesystem
    {
        return Storage::disk(config('spmb.storage_disk'));
    }

    public function put(string $content): string
    {
        $key = (string) Str::uuid();
        $this->disk()->put($this->path($key), $content);

        return $key;
    }

    public function exists(string $key): bool
    {
        return Str::isUuid($key) && $this->disk()->exists($this->path($key));
    }

    public function delete(string $key): void
    {
        if (Str::isUuid($key)) {
            $this->disk()->delete($this->path($key));
        }
    }

    /** @return resource */
    public function readStream(string $key)
    {
        if (! $this->exists($key)) {
            throw new RuntimeException("Storage object not found: {$key}");
        }

        return $this->disk()->readStream($this->path($key));
    }

    /** Time-limited token granting access to a single storage key. */
    public function signedToken(string $key, int $expiresIn = 3600): string
    {
        return Crypt::encryptString(json_encode(['k' => $key, 'e' => time() + $expiresIn]));
    }

    /** @return string the validated storage key */
    public function verifyToken(string $token): string
    {
        try {
            $payload = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException) {
            throw new RuntimeException('Invalid download signature');
        }
        if (($payload['e'] ?? 0) < time()) {
            throw new RuntimeException('Download link has expired');
        }
        if (! $this->exists($payload['k'] ?? '')) {
            throw new RuntimeException('Storage object not found');
        }

        return $payload['k'];
    }

    private function path(string $key): string
    {
        return 'documents/'.$key;
    }
}
