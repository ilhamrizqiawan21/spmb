# Infrastructure status — Laravel + MySQL

**Status (2026-10-06):** the backend has been rewritten on **Laravel 13 +
MySQL**, replacing the Django + DRF + PostgreSQL implementation (which in turn
replaced the original FastAPI implementation).

## Stack history

| Stack | Where to find it |
| --- | --- |
| FastAPI + SQLAlchemy + Alembic (F0–F5) | git commit `b984024` |
| Django + DRF + PostgreSQL (F1–F9, F12 partial) | git commit `e781905` |
| Laravel 13 + MySQL (current) | `backend/` |

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
cd backend
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
(F17), audit log and privacy hardening (F18), and the frontend (F19).
