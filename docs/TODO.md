# TODO.md
## SPMB Terpadu 2026/2027 — Execution Roadmap for Codex / AI Coding Agents

**Status:** Active Development Plan  
**Version:** 1.0  
**Project Architecture:** Modular Monolith  
**Backend:** PHP 8.3 + Laravel 13 (JSON API, Laravel Sanctum)  
**Database:** MySQL 8.0.16+  
**ORM:** Eloquent  
**Migration:** Laravel Migrations  
**Cache / Queue:** Laravel cache + queue (database driver; Redis optional)  
**Testing:** PHPUnit + Vitest + React Testing Library + Playwright  
**Frontend:** React + TypeScript + Vite (`frontend/README.md`)

## Laravel migration status and audit (2026-10-06)

The backend was rewritten from Django/DRF/PostgreSQL to Laravel/MySQL (see
`INFRASTRUCTURE.md`). **F0–F12 below were audited line by line against the
Laravel code and tests** (62 backend tests, 23 frontend tests); checkboxes
reflect what is actually implemented and verified. `[-]` marks partially done
items and `[ ]` real gaps — several need a business decision, noted inline.

Concept mapping for the remaining (not yet started) milestones, which were
written for the earlier stack:

| Task wording (earlier stacks) | Laravel equivalent |
| --- | --- |
| `apps/<domain>/models.py`, `services.py` | `app/Models/*.php`, `app/Services/*.php` |
| serializers / views | API Resources / controllers (`app/Http/...`) |
| permission classes | `permission:<codes>` route middleware |
| migrations (`makemigrations`) | `database/migrations/*.php` (`php artisan migrate`) |
| pytest | PHPUnit feature tests (`php artisan test`) |
| Celery + Redis | Laravel queue/cache (database driver; Redis optional) |
| JSONB | JSON |

**Status summary**

| Milestone | Status |
| --- | --- |
| F0–F12 | Implemented (backend) with the gaps listed per task |
| F13 Finance & Payment | Not started |
| F14 Enrollment & Student | Not started |
| F15 MPLS | Not started |
| F16 Notification System | Not started |
| F17 Dashboard & Reporting | Not started |
| F18 Audit, Privacy & Security | Partial: audit log + viewer, identity masking, security headers. Remaining: consent records, retention/erasure workflow, MFA |
| F19 Frontend | In progress — see `frontend/README.md` |
| F20–F22 | Not started (CI runs backend/frontend tests; MySQL job added) |

---

# 0. How Codex Must Use This File

This file is the primary execution checklist for development.

Before starting any task, Codex MUST read:

```text
1. PRD_SPMB_Terpadu_2026_2027.md
2. ERD_SPMB_Terpadu_2026_2027.md
3. AGENTS.md
4. AI_RULES.md
5. TODO.md
```

Task execution must follow this order:

```text
Read Task
↓
Inspect Existing Code
↓
Check Dependencies
↓
Implement Smallest Complete Unit
↓
Add / Update Tests
↓
Run Validation
↓
Update TODO Checkbox
↓
Summarize Changes
```

Codex MUST NOT skip to later phases if prerequisite tasks are unfinished.

---

# 1. Task Status Convention

Use:

```text
[ ] Not started
[-] In progress
[x] Completed
[!] Blocked
```

When a task is completed, Codex should update this file.

For blocked tasks, add a short note:

```text
[!] F2.4 Configure Redis
    Blocked: REDIS_URL not yet provided for production.
```

Do not mark a task complete if tests or acceptance criteria are not satisfied.

---

# 2. Development Rules

Every task must comply with:

```text
PRD
ERD
AGENTS.md
AI_RULES.md
```

Priority order:

```text
Correctness
→ Security
→ Data Integrity
→ Workflow Integrity
→ Maintainability
→ UX
→ Performance
```

Do not:

- invent business rules;
- change stack;
- introduce microservices;
- bypass state machine;
- hardcode yearly settings unnecessarily;
- expose private documents publicly;
- disable tests to make CI green;
- rewrite unrelated code;
- add dependencies without clear need.

---

# 3. Milestone Overview

```text
F0  Repository & Project Foundation
F1  Backend Core Foundation
F2  Database & Infrastructure
F3  Authentication & RBAC
F4  Academic Year & Admission Period
F5  Applicant & Guardian
F6  Application / Registration Workflow
F7  Document Management
F8  Verification Center
F9  Selection & Assessment
F10 Decision & Waiting List
F11 Announcement
F12 Re-registration
F13 Finance & Payment
F14 Enrollment & Student
F15 MPLS
F16 Notification System
F17 Dashboard & Reporting
F18 Audit, Privacy & Security Hardening
F19 Frontend UX Hardening
F20 Testing & Quality Assurance
F21 Deployment & Operations
F22 Production Readiness
```

---

# F0 — Repository & Project Foundation

## Goal

Create a clean, reproducible repository structure before implementing business features.

---

## F0.1 Initialize Repository Structure

- [x] Create backend directory.
- [x] Create frontend directory.
- [x] Create docs directory (governance files — PRD, ERD, AGENTS, AI_RULES, TODO — live in `docs/`).
- [x] `.github/` workflows, `docker-compose.yml`, `.env.example` at the root.

### Acceptance Criteria

- [x] Repository structure is clear.
- [x] No generated build artifacts or dependency folders committed (`backend/vendor`, `frontend/node_modules`, `dist`).
- [x] No secret files committed (`.env` ignored; only `.env.example`).
- [x] `.gitignore` covers PHP/Composer, Node, environment, IDE, test, and build artifacts.

---

## F0.2 Create `.gitignore`

- [x] Composer `vendor/` and PHPUnit cache.
- [x] Node modules.
- [x] Frontend build output.
- [x] `.env` and local SQLite databases.
- [x] Test artifacts and coverage.
- [x] Temporary upload files (private storage under `backend/storage`, ignored by Laravel's own rules).
- [x] Editor-specific files.

---

## F0.3 Create `.env.example`

- [x] Root `.env.example` (docker-compose DB credentials, `VITE_API_BASE_URL`).
- [x] `backend/.env.example` (MySQL, cache/queue, Redis placeholder, private storage disk, Sanctum token lifetime, CORS origins).
- [x] `frontend/.env.example` (API base URL).
- [ ] Email/notification provider placeholder (arrives with F16).

Never place real credentials inside `.env.example`.

---

## F0.4 README Bootstrap

- [x] Project summary.
- [x] Architecture summary.
- [x] Prerequisites.
- [x] Local setup instructions (including the zero-install Codespaces path).
- [x] Development commands.
- [x] Link to PRD, ERD, AGENTS, AI_RULES, TODO.

---

## F0.5 GitHub Workflow

- [x] Backend workflow: Pint + PHPUnit on SQLite, plus a MySQL 8.4 service-container job.
- [x] Frontend workflow: lint/typecheck/test/build (activates when `frontend/package.json` exists).
- [x] Deploy workflow intentionally absent until F21.

---

# F1 — Backend Core Foundation

## Goal

Create a clean Laravel API foundation with clear module boundaries.

> **History:** the backend was built on FastAPI (commit `b984024`), then
> Django/DRF/PostgreSQL (commit `e781905`), and is now Laravel 13 + MySQL.
> See `INFRASTRUCTURE.md`. Earlier commits remain valid references for domain
> rules.

---

## F1.1 Initialize Backend

- [x] Laravel 13 project (PHP 8.3).
- [x] Laravel Sanctum (API tokens).
- [x] MySQL driver (`pdo_mysql`); SQLite for tests.
- [x] PHPUnit.
- [x] Code style: Laravel Pint (enforced in CI).
- [ ] Static analysis (Larastan/PHPStan) — optional, not added yet.

### Acceptance Criteria

- [x] `php artisan serve` starts the API; `php artisan test` passes.

---

## F1.2 Create Backend Structure

- [x] `app/Services` (business rules), `app/Http/Controllers/Api`, `app/Http/Resources`, `app/Http/Middleware`, `app/Models`, `app/Support`, `app/Exceptions`.
- [x] `routes/api.php` (`/api/v1`) and `routes/web.php` (`/health`, `/ready`).
- [x] Domain code present: auth, admission, documents, verification, selection, enrollment (re-registration), system, audit.
- [ ] Domain code not started: finance, mpls, communication (F13, F15, F16).

See `AGENTS.md` §5 for the layered call flow (route → controller → service → model).

---

## F1.3 Application Configuration

- [x] Environment-based configuration (`.env`, `config/*.php`, `config/spmb.php` for project settings).
- [x] Missing `APP_KEY` fails closed (framework behavior).
- [-] Production-safe defaults: error rendering hides internals when `APP_DEBUG=false`, but there is no boot-time guard that refuses to start with `APP_DEBUG=true`/wildcard CORS in production.
- [x] Database configuration from `DB_*`; connection failures surface through `/ready`.
- [x] CORS from `CORS_ALLOWED_ORIGINS` (no wildcard default).
- [x] App metadata (`config/spmb.php`: name, version).

Never use production wildcard CORS.

---

## F1.4 Health Endpoints

- [x] `GET /health` (process).
- [x] `GET /ready` (database + cache probe, 503 `{"status":"not_ready"}` without internal details).

---

## F1.5 Global Error Handling

- [x] Validation errors → 400 `VALIDATION_ERROR` with per-field `details`.
- [x] Domain/business errors (`ApiException` with `details`).
- [x] Authentication errors → 401 `AUTHENTICATION_REQUIRED`.
- [x] Authorization errors → 403 `FORBIDDEN`.
- [x] 404 handling (`NOT_FOUND`, malformed UUIDs included), 429 `RATE_LIMIT_EXCEEDED`.
- [x] Safe 500 (`INTERNAL_SERVER_ERROR`, no stack trace/SQL/paths; covered by `WorkflowGapsTest`).

All errors use the envelope `{"error": {"code", "message", "details"}}`.

---

## F1.6 API Versioning

- [x] All domain endpoints are mounted under `/api/v1`.

---

# F2 — Database & Infrastructure Foundation

## Goal

Prepare MySQL, Laravel migrations, optional Redis, and storage abstractions.

---

## F2.1 MySQL Integration

- [x] Database configuration (`config/database.php`, default `mysql`).
- [x] Connection check in `/ready`.
- [ ] Verified on a real MySQL server — CI runs the suite on MySQL 8.4, local verification pending.

---

## F2.2 Base Model Conventions

- [x] UUID primary keys (`BaseModel` + `HasUuids`; `CHAR(36)`).
- [x] Timestamps (`created_at`, `updated_at`; `audit_logs` is append-only with `created_at` only).
- [ ] Soft delete strategy — not used so far; hard delete is limited to draft/configuration data (see AGENTS.md §8). Decide before F14.
- [-] Constraint/index naming: explicit short names where Laravel's generated name could exceed MySQL's 64-character limit; MySQL `CHECK` constraints in a dedicated migration.

---

## F2.3 Migrations Setup

- [x] `php artisan migrate` workflow; baseline RBAC data seeded by migration.
- [x] Rollback verified (`migrate:fresh` → `migrate:rollback --step=50` → `migrate`) on SQLite.
- [ ] Rollback verified on MySQL.

---

## F2.4 Cache / Queue / Redis

- [x] Cache and queue use the database driver by default; Redis selectable by env (`CACHE_STORE`, `QUEUE_CONNECTION`).
- [x] Readiness check covers the cache store.
- [x] Business features never call Redis directly.
- [ ] Redis driver exercised in an environment (docker-compose provides the service).

---

## F2.5 Object Storage Abstraction

- [x] `PrivateStorage` over a non-public Laravel disk (`SPMB_STORAGE_DISK`).
- [x] Local development adapter (`storage/app/private`).
- [-] S3-compatible adapter: swap the disk in config; the `league/flysystem-aws-s3-v3` package is not installed yet.
- [x] Time-limited signed token abstraction (`signedToken`/`verifyToken`).

Do not implement public permanent document URLs. (None exist; `serve` is disabled on the local disk.)

---

## F2.6 Docker Compose Development Stack

- [x] MySQL 8.4.
- [x] Redis (optional).
- [ ] backend container.
- [ ] frontend container.
- [ ] optional local object storage such as MinIO.

A Codespaces devcontainer (SQLite + demo seed) is provided for quick trials.

### Acceptance Criteria

- [x] A new developer can start dependencies and the app from documented commands.

---

# F3 — Authentication & RBAC

## Goal

Implement secure user authentication and permission-based authorization.

---

## F3.1 Users Model

- [x] `users` (UUID, email/phone optional but at least one required, `is_active`).
- [x] Migration.
- [x] Unique email and phone constraints.
- [x] Active state.

---

## F3.2 Roles Model

- [x] `roles` + migration.
- [x] System roles seeded by migration: `super_admin`, `admission_admin`, `verifier`, `finance`, `assessor`, `principal`, `mpls_officer`, `parent`.

---

## F3.3 Permissions Model

- [x] `permissions`, `user_roles`, `role_permissions`.
- [x] 12 baseline permissions seeded and mapped to roles.
- [ ] Admin UI/API to manage users and role assignments (`user.manage` exists but no endpoints yet).

---

## F3.4 Password Security

- [x] Password hashing via Laravel's `hashed` cast (bcrypt, `BCRYPT_ROUNDS`); Argon2id is a config switch if required.
- [x] Password verification.
- [-] Password policy: min 8 characters and not numeric-only; no common-password/breach check.
- [x] Passwords and tokens never logged (audit scrubber drops credential-like keys).

---

## F3.5 Registration Endpoint

- [x] Parent registration (email and/or phone).
- [x] Input validation.
- [x] Duplicate email/phone prevention (case-insensitive email).
- [x] Default `parent` role assignment.

---

## F3.6 Login / Logout

- [x] Login by email or phone → Sanctum bearer token (expiry configurable).
- [x] Logout revokes the current token.
- [x] Active account check.
- [x] Login throttling: 5 failed attempts / 15 minutes → 429; route throttles on register/login.
- [ ] Email/phone verification and password reset flows.

---

## F3.7 Current User Endpoint

- [x] `GET /api/v1/auth/me`.
- [x] Safe profile with roles and permission codes.

---

## F3.8 Permission Middleware

- [x] `permission:code1,code2` route middleware (any-of), server-side enforcement.

### Tests

- [x] valid login
- [x] invalid password (+ lockout)
- [x] inactive user
- [x] permitted endpoint
- [x] forbidden endpoint

---

# F4 — Academic Year & Admission Period

## Goal

Make yearly admission configuration fully manageable.

---

## F4.1 Academic Year

- [x] Model, migration, service, admin CRUD API.
- [x] Active academic year rule (single active; enforced in the service layer inside a transaction because MySQL has no partial unique index).
- [x] Cannot delete a year that has periods.

---

## F4.2 Admission Period

- [x] Model, migration, CRUD.
- [x] Registration open/close dates (ISO-8601, stored UTC), announcement date, quota, active state.
- [x] Optional settings JSON.

---

## F4.3 Registration Availability Service

- [x] Determine whether registration is open (`OPEN`, `BEFORE_OPENING`, `CLOSED`, `PERIOD_INACTIVE`, `ACADEMIC_YEAR_INACTIVE`).
- [x] Reject new drafts and submissions outside the allowed period.
- [x] Draft behavior defined (drafts need an open period; corrections after revision may be resubmitted after closing).

### Tests

- [x] before opening
- [x] during opening
- [x] after closing
- [x] inactive period / inactive academic year

---

# F5 — Applicant & Guardian

## Goal

Implement reusable student identity data owned by parent accounts.

---

## F5.1 Applicant Model

- [x] Fields defined by the ERD, migration.
- [x] Sensitive field handling: NIK/NISN/KK masked for staff without a verification need; personal-data edits audited as field names only.
- [x] Ownership relation to user.

---

## F5.2 Guardian Model

- [x] Father, mother, optional guardian (one per relationship).
- [x] Single primary contact rule.
- [x] Migration.

---

## F5.3 Applicant CRUD

Parent can:

- [x] create applicant;
- [x] view own applicant;
- [ ] edit applicant before locked stages — **no lock yet**: an applicant remains editable after submission. Needs a business decision on which statuses lock the data.
- [x] list children.

### Security Tests

- [x] parent cannot access another parent's applicant.
- [x] staff with permission can access appropriate records (identity numbers masked per role).

---

## F5.4 Guardian CRUD

- [x] create/update/delete guardian.
- [x] ownership validation.
- [x] relationship validation.

---

# F6 — Application / Registration Workflow

## Goal

Create the core admission application and controlled state machine.

---

## F6.1 Application Model

- [x] `applications`, migration.
- [x] Unique registration number.
- [x] Current step, completion percentage.
- [x] State vocabulary (17 states, `App\Support\ApplicationStatus`).

---

## F6.2 Status History

- [x] `application_status_histories`, migration.
- [x] History appended for every transition (including draft creation).

---

## F6.3 State Machine Service

- [x] Central transition map (`ApplicationStateMachine::LEGAL_TRANSITIONS`).
- [x] Validation of legal transitions.
- [-] Transition permission support: endpoint-level permissions plus an `application.override` bypass; no per-transition permission matrix.
- [x] Reason and metadata support.
- [x] Atomic transaction.
- [x] History creation.
- [x] Audit integration (`application.status_changed`).

### Required Tests

- [x] valid transition
- [x] invalid transition
- [x] repeated transition
- [x] missing prerequisite
- [x] history creation

---

## F6.4 Create Draft Application

- [x] Parent selects applicant and admission period.
- [x] Duplicate application per applicant/period prevented.
- [x] Starts as `DRAFT`.

---

## F6.5 Registration Number Generator

Format: `REG-<academic year start>-<6-digit sequence>`, e.g. `REG-2026-000001`.

- [x] Central generator.
- [x] Collision-safe (row lock + unique constraint); heavy concurrency not load-tested.
- [x] Not used as PK.

---

## F6.6 Completion Calculator

- [x] Calculated server-side (5 weighted checkpoints); frontend percentage is never trusted.

---

## F6.7 Submit / Resubmit Application

Before transition to `SUBMITTED`, validate:

- [x] mandatory applicant fields;
- [x] required guardians;
- [x] required documents;
- [x] active admission period;
- [x] registration period;
- [ ] consent requirements (no consent model yet — F18).

Resubmission after `REVISION_REQUIRED`:

- [x] allowed after registration closes;
- [x] blocked until the newest version of every flagged document is replaced;
- [x] transitions to `RESUBMITTED` and re-enters the verification queue.

### Acceptance Criteria

- [x] Invalid application cannot submit.

---

# F7 — Document Management

## Goal

Provide secure configurable upload and verification-ready document handling.

---

## F7.1 Document Requirement Model

- [x] Model, migration.
- [x] Admission-period-specific (or global) requirements.
- [x] Required/optional, allowed MIME types, size limit, sort order.

---

## F7.2 Admin Requirement CRUD

- [x] list, create, edit.
- [x] disable (a requirement already referenced by documents is deactivated, not deleted).

---

## F7.3 Application Document Model

- [x] Model, migration, metadata, checksum (SHA-256).
- [x] Version, status, verifier relation.

---

## F7.4 Secure Upload Endpoint

Validate:

- [x] ownership;
- [x] requirement exists and is active;
- [x] MIME (server-detected, not client-declared);
- [ ] extension allow-list;
- [x] file size;
- [x] checksum stored.

---

## F7.5 Secure Download / Preview

- [x] Permission and ownership checks (staff access is audited).
- [x] Private storage, streamed through the API.
- [-] Signed access: token verification exists, but no endpoint issues tokens yet.
- [x] No public permanent URL.

---

## F7.6 Document Revision

- [x] Revision request (moves the application to `REVISION_REQUIRED` when under verification).
- [x] Previous version preserved.
- [x] Upload of a new version resolves open revisions.
- [x] Resubmission workflow (see F6.7).

### Tests

- [x] valid upload
- [x] invalid MIME
- [x] oversized file
- [x] unauthorized access
- [x] revision flow

---

# F8 — Verification Center

## Goal

Enable efficient administrative verification with work queues.

---

## F8.1 Verification Assignment

- [x] `verification_assignments`.
- [x] Assign manually (admin picks a verifier from `GET /auth/staff`).
- [ ] Auto-assignment strategy (optional, later).
- [x] Completion tracking (reassignment closes the previous assignment).

---

## F8.2 Verification Review

- [x] `verification_reviews`.
- [x] Status, notes, start/completion timestamps.

---

## F8.3 Verifier Queue API

Filters:

- [x] unassigned
- [x] assigned to me
- [x] status (pending / revision required / verified …)
- [x] admission period
- [x] search applicant or registration number

---

## F8.4 Verify Document

Actions:

- [x] valid
- [x] invalid
- [x] revision required

---

## F8.5 Complete Application Verification

Only allow `VERIFIED` if all mandatory documents are present and valid.

### Tests

- [x] complete application verifies
- [x] missing required document blocks
- [x] revision/pending/invalid document blocks verification
- [x] unauthorized verifier blocked

Known behavior: completing with `REJECTED` is only possible with `application.override` (the state machine has no `UNDER_VERIFICATION → REJECTED` transition). Confirm with the school whether verifiers may reject outright.

---

# F9 — Selection & Assessment

## Goal

Implement configurable assessment components and scoring.

---

## F9.1 Selection Component

- [x] Model, migration, CRUD.
- [x] Weight, max score, active status.
- [-] Minimum score is stored but not enforced anywhere (needs a rule: does it block acceptance?).

---

## F9.2 Weight Validation

- [x] Prevent negative/over-100 weight.
- [x] Service validates the total active weight per period (≤ 100%).
- [ ] Require total = 100% before scoring/ranking is allowed.

---

## F9.3 Assessment Schedule

- [x] Model, migration, schedule per applicant/component.
- [x] Location, room, notes, status (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`).
- [x] Reschedule/cancel/no-show; owner can view their schedule.
- [ ] Conflict detection (room/time clashes).

---

## F9.4 Assessment Model

- [x] Model, migration, assessor relation.
- [x] Score bounds (0 … component max).
- [x] Notes.

---

## F9.5 Assessment API

Assessor can:

- [ ] view *assigned* candidates — there is no per-assessor assignment; every assessor sees all verified candidates of the period;
- [x] submit score;
- [-] edit score within policy — scores can be overwritten at any time (audited); no edit window;
- [ ] be restricted from unrelated candidates (depends on assignment).

---

## F9.6 Score Calculation Service

- [x] Central weighted score calculation (`score ÷ max_score × weight`).
- [x] Exact decimal arithmetic (brick/math).
- [x] No hardcoded components.
- [x] Aggregate saved in `application_scores`; status becomes `ASSESSED` once every active component is scored.

---

## F9.7 Ranking Service

- [x] Rank by final score.
- [x] Scoped by admission period.
- [-] Deterministic tie rule implemented (`final_score` desc, then `submitted_at` asc, then `registration_number` asc) but **not yet confirmed by the school** — confirm before production.

---

# F10 — Decision & Waiting List

## Goal

Convert assessment results into controlled admission decisions.

---

## F10.1 Application Decision Model

- [x] Model, migration.
- [x] One decision per application.
- [x] Score/rank snapshot.
- [x] Decided by.

---

## F10.2 Decision Service

Allowed decisions: `ACCEPTED`, `WAITLISTED`, `REJECTED`.

- [x] Require permission (`assessment.approve` or `application.override`).
- [x] Validate application status via the state machine (override can bypass).
- [x] Store reason (mandatory when changing an existing decision).
- [x] Update the application through the state machine.
- [x] A new decision is **private until published** (`published_at` is null).

---

## F10.3 Decision History

- [x] Override history (`decision_histories`).
- [x] Mandatory reason for override.
- [x] Audit log (`decision.made`, `decision.overridden`).

---

## F10.4 Waiting List

- [x] Model, migration.
- [x] Position, score, status.

---

## F10.5 Waiting List Promotion

- [x] privileged permission;
- [x] reason;
- [x] history;
- [x] state transition;
- [x] audit log.

### Tests

- [x] normal decision
- [x] invalid decision
- [x] unauthorized override
- [x] override with reason
- [x] waiting-list promotion

---

# F11 — Announcement

## Goal

Publish results safely to applicants.

---

## F11.1 Publication Control

- [x] Decision remains private before publication (also hidden from public lookup).
- [x] Admin publish action per admission period.
- [x] `published_at` / period `announcement_at`.
- [ ] Per-application publish endpoint (service exists, no route).

---

## F11.2 Parent Result API

- [x] Parent sees only their own result.
- [x] Only after publication (staff with publish permission can preview).
- [x] Includes next-step instructions.
- [x] Public lookup by registration number + birth date (masked name, throttled).

---

## F11.3 Result Letter / PDF

- [x] Template (minimal dependency-free PDF; not school-branded yet).
- [x] Generated on request (synchronous).
- [x] Secure download (authenticated, only when published).

---

# F12 — Re-registration

## Goal

Handle accepted applicants from acceptance to final enrollment readiness.

---

## F12.1 Re-registration Model

- [x] Model, migration.
- [-] Status workflow: `PENDING`, `IN_PROGRESS`, `COMPLETED` are used; `CANCELLED` and `EXPIRED` exist but nothing sets them (no deadline job).

---

## F12.2 Re-registration Requirements

- [x] Configurable requirements per admission period, migration.
- [x] Admin management UI.

---

## F12.3 Re-registration Items

- [x] Requirement completion tracking.
- [x] Notes and completion timestamp.

---

## F12.4 Start Re-registration

Only `ACCEPTED` applications may start.

- [x] Enforced; idempotent for an existing re-registration.
- [x] Items created from the period's requirements; application moves to `RE_REGISTRATION`.

---

## F12.5 Complete Re-registration

Validate:

- [x] mandatory items;
- [ ] required documents;
- [ ] payment conditions (needs F13);
- [-] confirmation (recorded as `confirmed_at` at start; no separate confirmation step).

Transition:

```text
RE_REGISTRATION
→ RE_REGISTRATION_VERIFIED
```

- [x] Owner or staff with `enrollment.manage`/`application.override` may complete.

---

# F13 — Finance & Payment

## Goal

Support invoices and manually verified payment proof safely.

---

## F13.1 Invoice Model

- [ ] Model.
- [ ] Migration.
- [ ] Invoice number.
- [ ] Amount as Decimal.
- [ ] Status.
- [ ] Due date.

---

## F13.2 Payment Model

- [ ] Model.
- [ ] Migration.
- [ ] Proof storage.
- [ ] Verification relation.
- [ ] Status.

---

## F13.3 Payment History

- [ ] Model.
- [ ] Migration.
- [ ] Append every status change.

---

## F13.4 Upload Payment Proof

- [ ] Secure upload.
- [ ] Ownership.
- [ ] MIME/size validation.
- [ ] status = PENDING.

---

## F13.5 Finance Verification

Finance may:

- [ ] approve;
- [ ] reject with note.

Server controls payment status.

---

## F13.6 Invoice Reconciliation

- [ ] Determine paid/partially paid.
- [ ] Prevent amount inconsistencies.
- [ ] Use Decimal only.

### Tests

- [ ] valid payment
- [ ] rejected payment
- [ ] duplicate verification
- [ ] unauthorized action
- [ ] invoice state update

---

# F14 — Enrollment & Student

## Goal

Convert fully completed accepted applications into official students.

---

## F14.1 Enrollment Model

- [ ] Model.
- [ ] Migration.
- [ ] Unique application relation.
- [ ] Enrollment operator.

---

## F14.2 Enrollment Preconditions

Service must validate:

- [ ] decision = ACCEPTED;
- [ ] re-registration completed;
- [ ] required payment satisfied or waived;
- [ ] required final documents valid;
- [ ] not previously enrolled.

---

## F14.3 Student Model

- [ ] Model.
- [ ] Migration.
- [ ] Student number.
- [ ] Snapshot operational identity.

---

## F14.4 Student Number Generator

- [ ] Define format.
- [ ] Collision safe.
- [ ] Separate from UUID.

---

## F14.5 Enrollment Transaction

Atomic flow:

```text
validate
→ create enrollment
→ create student
→ transition application to ENROLLED
→ create history
→ create audit log
```

### Tests

- [ ] valid enrollment
- [ ] duplicate enrollment blocked
- [ ] unpaid blocked
- [ ] rejected applicant blocked

---

# F15 — MPLS

## Goal

Manage onboarding of newly enrolled students.

---

## F15.1 MPLS Group

- [ ] Model.
- [ ] Migration.
- [ ] Capacity.
- [ ] Academic year.

---

## F15.2 MPLS Participant

- [ ] Model.
- [ ] Migration.
- [ ] Only enrolled student.
- [ ] Unique QR token.

---

## F15.3 Group Assignment

- [ ] manual assignment;
- [ ] capacity validation;
- [ ] optional balanced assignment.

---

## F15.4 MPLS Events

- [ ] Model.
- [ ] Migration.
- [ ] Global/group event.
- [ ] start/end.
- [ ] location.
- [ ] mandatory flag.

---

## F15.5 MPLS Attendance

- [ ] Model.
- [ ] Migration.
- [ ] Unique event/participant pair.
- [ ] Checked by.
- [ ] status.

---

## F15.6 QR Attendance

- [ ] QR contains opaque token only.
- [ ] Scan endpoint.
- [ ] permission validation.
- [ ] prevent duplicate attendance.
- [ ] optional manual correction with audit.

---

## F15.7 Complete MPLS

- [ ] completion rule.
- [ ] transition application to `MPLS_COMPLETED`.
- [ ] optional final transition to `COMPLETED`.

---

# F16 — Notification System

## Goal

Centralize notifications without coupling business logic to providers.

---

## F16.1 Notification Model

- [ ] Model.
- [ ] Migration.
- [ ] channel.
- [ ] type.
- [ ] status.
- [ ] payload.

---

## F16.2 Notification Templates

- [ ] Model.
- [ ] Migration.
- [ ] template CRUD.
- [ ] channel support.

---

## F16.3 Notification Service

Support:

```text
IN_APP
EMAIL
WHATSAPP
```

Business domains call one abstraction.

---

## F16.4 Background Worker

- [ ] queue abstraction;
- [ ] retry strategy;
- [ ] failure logging;
- [ ] idempotency strategy.

---

## F16.5 Initial Events

Implement:

- [ ] APPLICATION_SUBMITTED
- [ ] DOCUMENT_REVISION_REQUIRED
- [ ] APPLICATION_VERIFIED
- [ ] ASSESSMENT_SCHEDULED
- [ ] ACCEPTED
- [ ] WAITLISTED
- [ ] RE_REGISTRATION_REMINDER
- [ ] MPLS_INFORMATION

---

# F17 — Dashboard & Reporting

## Goal

Provide actionable operational visibility.

---

## F17.1 Admin Dashboard API

Metrics:

- [ ] total applicants;
- [ ] draft;
- [ ] submitted;
- [ ] verification;
- [ ] revision;
- [ ] verified;
- [ ] assessed;
- [ ] accepted;
- [ ] waiting list;
- [ ] rejected;
- [ ] re-registration;
- [ ] enrolled;
- [ ] MPLS.

---

## F17.2 Funnel Metrics

Example:

```text
Registered
→ Submitted
→ Verified
→ Assessed
→ Accepted
→ Re-registered
→ Enrolled
```

---

## F17.3 Search & Filters

Applications support:

- [ ] registration number
- [ ] applicant name
- [ ] NISN
- [ ] previous school
- [ ] admission period
- [ ] status
- [ ] decision
- [ ] payment status

---

## F17.4 Pagination & Sorting

Required for all large lists.

---

## F17.5 Reports

- [ ] applicant report
- [ ] origin school report
- [ ] verification report
- [ ] selection report
- [ ] accepted report
- [ ] waiting list report
- [ ] payment report
- [ ] enrollment report
- [ ] MPLS attendance report

---

## F17.6 Export

- [ ] CSV
- [ ] XLSX
- [ ] PDF where appropriate

Large export must run asynchronously.

---

# F18 — Audit, Privacy & Security Hardening

## Goal

Protect sensitive student/family information and provide traceability.

---

## F18.1 Audit Log Model

- [x] Model (`AuditLog`).
- [x] Migration (`audit_logs`).
- [x] Append-only behavior (model refuses update/delete; tested).
- [x] Viewer API (`GET /api/v1/audit/logs`, `/audit/actions`) and frontend page, permission `audit.read`.
- [ ] Retention/archival policy.

---

## F18.2 Audit Integration

Must audit:

- [x] status changes (every transition, including override)
- [x] decision made/override
- [ ] payment verification (needs F13)
- [ ] role assignment (no endpoint yet)
- [ ] permission changes (no endpoint yet)
- [-] enrollment (re-registration completion audited; student enrollment is F14)
- [x] system settings / master data changes
- [x] auth events, document access by staff, applicant views by staff, scoring, schedules, announcements

---

## F18.3 Consent Model

- [ ] Model.
- [ ] Migration.
- [ ] Privacy policy consent.
- [ ] Data processing consent.
- [ ] Version tracking.

---

## F18.4 Security Headers

- [ ] CSP (belongs to the host serving the frontend; not set by the JSON API)
- [x] HSTS in production
- [x] X-Content-Type-Options
- [x] frame protection (`X-Frame-Options: DENY`)
- [x] Referrer Policy
- [x] `Cache-Control: no-store` on API responses

---

## F18.5 Rate Limiting

Apply to:

- [x] login (route throttle + 5 failures / 15 min lockout)
- [x] registration
- [ ] password reset (flow does not exist yet)
- [x] sensitive public endpoints (result lookup)
- [ ] upload endpoints

---

## F18.6 File Access Review

- [x] No private document is public.
- [x] Ownership tests.
- [x] Admin/staff permission tests (access is audited).
- [-] Expiring links (token support exists; nothing issues them).

---

## F18.7 Secret Review

- [x] scan repository (pattern scan of tracked files: no keys/tokens found, 2026-10-06);
- [x] ensure `.env` ignored;
- [x] no exposed secrets found, nothing to rotate.

---

# F19 — Frontend Foundation & UX Hardening

## Goal

Build a modern, consistent, mobile-first interface.

---

## F19.1 Initialize React Frontend

- [ ] React.
- [ ] TypeScript strict mode.
- [ ] Vite.
- [ ] Router.
- [ ] TanStack Query.
- [ ] React Hook Form.
- [ ] Zod.
- [ ] Tailwind.
- [ ] shadcn/ui or selected component layer.

---

## F19.2 Frontend Structure

Create:

```text
src/
├── app/
├── components/
├── features/
├── hooks/
├── lib/
├── routes/
├── services/
├── types/
└── utils/
```

---

## F19.3 API Client

- [ ] base client;
- [ ] credentials/session support;
- [ ] typed errors;
- [ ] common response handling;
- [ ] no duplicated fetch logic.

---

## F19.4 Auth UI

- [ ] register
- [ ] login
- [ ] logout
- [ ] profile
- [ ] protected routes

---

## F19.5 Parent Dashboard

- [ ] children list
- [ ] active applications
- [ ] progress
- [ ] next required action
- [ ] notifications

---

## F19.6 Registration Wizard

Steps:

- [ ] student identity
- [ ] address
- [ ] previous school
- [ ] father
- [ ] mother
- [ ] guardian
- [ ] admission route/period
- [ ] documents
- [ ] review
- [ ] submit

Features:

- [ ] autosave
- [ ] progress indicator
- [ ] resume later
- [ ] field errors
- [ ] server error handling

---

## F19.7 Admin Shell

- [ ] responsive navigation;
- [ ] permission-driven menu;
- [ ] dashboard;
- [ ] work queue UX.

---

## F19.8 Verification UI

Prefer split layout:

```text
Applicant Data | Document Preview
```

- [ ] verify;
- [ ] revision;
- [ ] notes;
- [ ] next applicant.

---

## F19.9 Assessment UI

- [ ] assigned candidate list;
- [ ] score form;
- [ ] score validation;
- [ ] assessor notes.

---

## F19.10 Finance UI

- [ ] invoice list;
- [ ] payment proof preview;
- [ ] approve/reject;
- [ ] filters.

---

## F19.11 MPLS UI

- [ ] groups;
- [ ] participants;
- [ ] events;
- [ ] QR attendance;
- [ ] attendance correction.

---

## F19.12 UI State Coverage

All async views handle:

- [ ] loading
- [ ] error
- [ ] empty
- [ ] success
- [ ] permission denied

---

## F19.13 Responsive Audit

- [ ] mobile 360px;
- [ ] common tablet width;
- [ ] desktop;
- [ ] large desktop.

---

# F20 — Testing & Quality Assurance

## Goal

Prove the system works across critical business journeys.

---

## F20.1 Backend Unit Tests

Cover:

- [ ] state machine
- [ ] score calculation
- [ ] permissions
- [ ] payment logic
- [ ] enrollment rules
- [ ] registration availability

---

## F20.2 Backend Integration Tests

Cover:

- [ ] auth
- [ ] application
- [ ] upload
- [ ] verification
- [ ] assessment
- [ ] decision
- [ ] payment
- [ ] enrollment
- [ ] MPLS

---

## F20.3 Frontend Tests

- [ ] forms
- [ ] permission-based rendering
- [ ] query/error states
- [ ] critical components

---

## F20.4 Playwright E2E

Critical parent/admin journey:

```text
Register Parent
→ Add Applicant
→ Create Application
→ Upload Documents
→ Submit
→ Admin Verify
→ Assessor Scores
→ Admin Decides
→ Publish
→ Parent Re-registers
→ Payment Verified
→ Enrollment
→ MPLS Assignment
→ MPLS Attendance
```

- [ ] complete happy path.
- [ ] at least one revision path.
- [ ] at least one rejection/forbidden path.

---

## F20.5 Load Testing

Test realistic scenarios:

- [ ] registration opening spike;
- [ ] application list;
- [ ] document upload;
- [ ] admin filters.

Target baseline from PRD:

```text
API normal p95 < 500 ms
target 500 active sessions
```

Do not claim performance target achieved without test evidence.

---

## F20.6 Accessibility Review

- [ ] keyboard navigation;
- [ ] form labels;
- [ ] contrast;
- [ ] focus states;
- [ ] error announcements;
- [ ] semantic HTML.

---

# F21 — Deployment & Operations

## Goal

Create repeatable deployment and operational tooling.

---

## F21.1 Production Docker Build

- [ ] backend Dockerfile.
- [ ] frontend build.
- [ ] worker image/command.
- [ ] non-root container where practical.
- [ ] health checks.

---

## F21.2 Reverse Proxy

- [ ] HTTPS.
- [ ] frontend routing.
- [ ] `/api` proxy.
- [ ] security headers.
- [ ] upload size config.

---

## F21.3 Production Environment Template

Document required variables.

Do not commit real production values.

---

## F21.4 CI Pipeline

Required stages:

```text
lint
typecheck
test
build
security checks
```

---

## F21.5 CD / Deployment

- [ ] create controlled production deployment workflow;
- [ ] database migration step;
- [ ] failure strategy;
- [ ] health verification after deploy.

---

## F21.6 Backup

- [ ] database backup script/process;
- [ ] object storage backup/versioning;
- [ ] retention policy;
- [ ] restore documentation.

---

## F21.7 Restore Test

- [ ] restore database into clean environment;
- [ ] validate critical records;
- [ ] document recovery procedure.

---

## F21.8 Monitoring

- [ ] structured logs;
- [ ] error monitoring;
- [ ] DB health;
- [ ] worker health;
- [ ] uptime monitoring.

---

# F22 — Production Readiness

## Goal

Validate the complete system before real admissions open.

---

## F22.1 Security Review

- [ ] auth review
- [ ] RBAC review
- [ ] IDOR/ownership review
- [ ] upload review
- [ ] secrets review
- [ ] rate-limit review
- [ ] private document review
- [ ] dependency vulnerability review

---

## F22.2 Data Integrity Review

- [ ] no orphan records;
- [ ] all FK constraints correct;
- [ ] unique constraints correct;
- [ ] all critical transitions historical;
- [ ] all money uses Decimal/Numeric.

---

## F22.3 Business Workflow Review

Manually validate:

```text
Registration
Verification
Revision
Assessment
Decision
Waiting List
Announcement
Re-registration
Payment
Enrollment
MPLS
```

---

## F22.4 User Acceptance Testing

Roles:

- [ ] parent
- [ ] admission admin
- [ ] verifier
- [ ] finance
- [ ] assessor
- [ ] principal
- [ ] MPLS officer
- [ ] super admin

Record issues before launch.

---

## F22.5 Production Seed

Only safe system data:

- [ ] roles
- [ ] permissions
- [ ] initial super admin creation procedure
- [ ] system settings baseline

No real student personal data in source-controlled seeds.

---

## F22.6 Launch Checklist

```text
[ ] Domain configured
[ ] HTTPS valid
[ ] Production DB ready
[ ] Redis ready
[ ] Object storage ready
[ ] Backups running
[ ] Monitoring enabled
[ ] Admin users prepared
[ ] Admission year configured
[ ] Admission periods configured
[ ] Document requirements configured
[ ] Selection components configured
[ ] Notification templates reviewed
[ ] UAT passed
[ ] E2E passed
[ ] Production smoke test passed
```

---

# 4. Cross-Cutting Technical Debt Queue

Only work on these when they become relevant or are explicitly prioritized.

- [ ] Generate frontend API types from OpenAPI.
- [ ] Add DB query profiling in development.
- [ ] Add object-storage antivirus scanning integration.
- [ ] Add advanced notification delivery tracking.
- [ ] Add automated verifier assignment.
- [ ] Add advanced waiting-list auto-promotion.
- [ ] Add integration to external LMS/SIS/EMIS.
- [ ] Add payment gateway.
- [ ] Add PWA offline-safe informational pages.
- [ ] Add advanced analytics.
- [ ] Add multi-school support only if product scope changes.

Do not implement these ahead of core features without explicit instruction.

---

# 5. Recommended Codex Work Pattern

For each session, Codex should work on **one task group only**.

Example:

```text
Target:
F6.3 State Machine Service

Steps:
1. Read PRD state machine section.
2. Read ERD application/status-history section.
3. Inspect models/services already present.
4. Implement transition rules.
5. Add transaction/history handling.
6. Add unit tests.
7. Run tests.
8. Update TODO.
9. Summarize files changed and remaining risks.
```

Do not attempt five major phases in one uncontrolled change set.

---

# 6. Codex Completion Report Format

At the end of a task, report:

```text
Task:
F6.3 State Machine Service

Status:
Completed / Blocked / Partial

Implemented:
- ...
- ...

Tests:
- command
- result

Files changed:
- ...

Remaining:
- ...

TODO updated:
Yes / No
```

This format is preferred so the project owner can review progress quickly.

---

# 7. Stop Conditions

Codex must stop implementation and report the issue when:

- PRD and ERD materially conflict;
- migration risks production data loss;
- required business rule is genuinely undefined;
- a secret/credential appears exposed;
- existing user changes would be overwritten;
- implementation requires changing the agreed core architecture;
- a critical test fails for unrelated reasons that cannot be safely resolved.

Do not silently invent a workaround for business-critical ambiguity.

---

# 8. Definition of Done for the Entire Project

The project is considered production-ready only when:

```text
[ ] All critical F0–F22 tasks are complete
[ ] Full critical E2E flow passes
[ ] RBAC verified
[ ] State machine verified
[ ] Audit logs verified
[ ] Sensitive file access verified
[ ] Backup restore tested
[ ] Load test completed
[ ] UAT completed
[ ] CI green
[ ] Production smoke test completed
[ ] Documentation synchronized
```

---

# 9. Immediate Development Starting Point

Codex should begin here unless instructed otherwise:

```text
F0 — Repository & Project Foundation
```

Recommended first execution sequence:

```text
F0.1 Repository Structure
→ F0.2 .gitignore
→ F0.3 .env.example
→ F0.4 README
→ F1.1 Backend Initialization
→ F1.2 Backend Structure (apps/)
→ F1.3 Configuration
→ F1.4 Health Endpoints
→ F2 Database Foundation
```

Do not begin registration business features before the foundation is stable.

---

# 10. Project Progress

Update this section after completing milestones.

```text
F0  [-] Repository & Project Foundation
F1  [x] Backend Core Foundation
F2  [ ] Database & Infrastructure
F3  [ ] Authentication & RBAC
F4  [ ] Academic Year & Admission Period
F5  [ ] Applicant & Guardian
F6  [ ] Application / Registration Workflow
F7  [ ] Document Management
F8  [ ] Verification Center
F9  [ ] Selection & Assessment
F10 [ ] Decision & Waiting List
F11 [ ] Announcement
F12 [ ] Re-registration
F13 [ ] Finance & Payment
F14 [ ] Enrollment & Student
F15 [ ] MPLS
F16 [ ] Notification System
F17 [ ] Dashboard & Reporting
F18 [ ] Audit, Privacy & Security
F19 [ ] Frontend UX
F20 [ ] Testing & QA
F21 [ ] Deployment & Operations
F22 [ ] Production Readiness
```

---

**End of TODO.md — Version 1.0**
