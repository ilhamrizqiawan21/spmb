# Infrastructure status — Laravel + MySQL

**Status (2026-10-06):** the backend has been rewritten on **Laravel 13 +
MySQL**, replacing the Django + DRF + PostgreSQL implementation (which in turn
replaced the original FastAPI implementation).

## Stack history

| Stack | Where to find it |
| --- | --- |
| FastAPI + SQLAlchemy + Alembic (F0–F5) | git commit `b984024` |
| Django + DRF + PostgreSQL (F1–F9, F12 partial) | git commit `e781905` |
| Laravel 13 + MySQL (current) | repository root (`app/`, `resources/js/`) |

Earlier stacks are kept in git history purely as a behavioral reference.

## What was ported

All domain behavior that existed in the Django backend was ported to Laravel
with the same endpoints (`/api/v1/...`), error envelope
(`{"error": {code, message, details}}`), RBAC baseline, and state machine:

- auth/RBAC (register, login, logout, me, roles/permissions seed);
- academic years, admission periods, registration availability;
- applicants, guardians, applications (draft → submit), state machine + history;
- document requirements, private versioned document upload/download,
  verification and revision requests;
- verification queue, assignments, review completion;
- selection components, assessment schedules/scores, ranking, decisions,
  waiting list, announcements (public lookup, PDF result letter);
- re-registration requirements, items, and completion.

Intentional differences:

- **Auth:** Laravel Sanctum bearer tokens (`POST /api/v1/auth/login` returns
  `{token, token_type, user}`) instead of Django session cookies. Logout
  revokes the current token.
- **Rate limiting:** failed-login lockout answers `429` (was `403`).
- **IDs/Types:** UUIDs are `CHAR(36)`; MySQL has no partial unique index, so the
  "single active academic year" rule is enforced in the service layer.
- **Cache/queue:** database driver by default; Redis is optional.
- **Document storage:** a private Laravel filesystem disk
  (`SPMB_STORAGE_DISK`, default `local`; set an S3-compatible disk for
  production). Files are never served from a public path.

## Running locally

```bash
docker compose up -d mysql          # MySQL 8.4 on 127.0.0.1:3306
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve                   # http://localhost:8000
php artisan test                    # PHPUnit (SQLite in-memory)
```

CI (`.github/workflows/backend.yml`) additionally runs the whole test suite
against a MySQL service container.

## Not yet implemented

Per `TODO.md`: finance/payment (F13), enrollment/student records beyond
re-registration (F14), MPLS (F15), notifications (F16), dashboards/reporting
(F17), audit log and privacy hardening (F18), and most of the frontend (F19): a React + TypeScript + Vite foundation exists (`resources/js/`).

## Production environment variables

Set these in the deployment environment (never commit values). `.env.example` lists
the full set with local defaults.

| Variable | Production value / notes |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | Generate once (`php artisan key:generate --show`) and keep stable; rotating it invalidates sessions |
| `APP_URL` | Public HTTPS URL of the app |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Managed MySQL 8.0.16+ (CHECK constraints need it); use a least-privilege user, not root |
| `SESSION_DRIVER` | `file` or `redis` (the API is token-based; the `sessions` table does not exist) |
| `CACHE_STORE`, `QUEUE_CONNECTION` | `database` (default) or `redis` (+ `REDIS_*`); run a queue worker either way |
| `SPMB_STORAGE_DISK`, `FILESYSTEM_DISK` | `local` (persistent volume) or `s3` (+ `AWS_*`, `AWS_ENDPOINT` for S3-compatible) |
| `SANCTUM_TOKEN_EXPIRATION_MINUTES` | Token lifetime; default 10080 (7 days) |
| `CORS_ALLOWED_ORIGINS` | Only if the SPA is served from another origin; empty/unused when Laravel serves it |
| `LOG_CHANNEL`, `LOG_LEVEL` | e.g. `stack` / `warning` in production |
| `VITE_API_BASE_URL` | Build-time only; `/api/v1` when same-origin |

`DemoSeeder` must never run in production (`php artisan db:seed` is for local/dev only).

## Security headers and proxies

`App\Http\Middleware\SecurityHeaders` runs on every response (`nosniff`, `X-Frame-Options: DENY`,
Referrer-Policy, Permissions-Policy) and adds a strict Content-Security-Policy to the HTML shell of the
SPA. The CSP is skipped while the Vite dev server is running (`public/hot` exists). HSTS is sent only
for HTTPS requests when `APP_ENV=production`.

Behind a TLS-terminating reverse proxy, make sure the proxy sends `X-Forwarded-Proto: https` and that
Laravel trusts it (`$middleware->trustProxies(at: ...)` in `bootstrap/app.php`); otherwise
`$request->isSecure()` is false and HSTS is never sent.

Personal data in API responses (NIK, family card number, guardian NIK/phone/email/income) is masked for
staff roles that do not verify applications; see `App\Support\Masking` and `tests/Feature/PrivacyTest.php`.

## Email and queue worker

Transactional emails (password reset, application status, assessment schedule, announcement) are queued
notifications (`app/Notifications`, sent through `App\Services\NotificationService`). In production:

- Set a real mailer: `MAIL_MAILER=smtp` with `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
  `MAIL_SCHEME`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`. The dev default is `log` (emails are written to `storage/logs`).
- `APP_URL` must be the public HTTPS URL: it is used to build the links inside emails.
- Run a queue worker (`php artisan queue:work --tries=3`, under a supervisor/systemd service). Without a worker nothing is sent.
- Deliveries are recorded in `notification_logs` (`SENT` / `FAILED`); failed queue jobs land in `failed_jobs`.
