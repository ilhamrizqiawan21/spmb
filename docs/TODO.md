# TODO.md
## SPMB Terpadu 2026/2027 — Execution Roadmap for Codex / AI Coding Agents

**Status:** Active Development Plan  
**Version:** 1.0  
**Project Architecture:** Modular Monolith  
**Frontend:** React + TypeScript + Vite  
**Backend:** Python + FastAPI  
**Database:** PostgreSQL  
**ORM:** SQLAlchemy  
**Migration:** Alembic  
**Cache / Queue:** Redis  
**Testing:** Pytest + Vitest + React Testing Library + Playwright

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
- [x] Create docs directory if documentation is grouped.
- [ ] Ensure root contains the project governance files.

Expected root:

```text
/
├── backend/
├── frontend/
├── docs/
├── .github/
├── docker-compose.yml
├── .env.example
├── AGENTS.md
├── AI_RULES.md
├── TODO.md
├── PRD_SPMB_Terpadu_2026_2027.md
└── ERD_SPMB_Terpadu_2026_2027.md
```

### Acceptance Criteria

- Repository structure is clear.
- No generated build artifacts committed.
- No secret files committed.
- `.gitignore` covers Python, Node, environment, IDE, test, and build artifacts.

---

## F0.2 Create `.gitignore`

- [x] Python cache.
- [x] `.venv`.
- [x] Node modules.
- [x] frontend build output.
- [x] `.env`.
- [x] test artifacts.
- [x] coverage.
- [x] temporary upload files.
- [x] editor-specific files where appropriate.

### Acceptance Criteria

```bash
git status
```

must not show dependency folders or secret environment files.

---

## F0.3 Create `.env.example`

- [x] Add placeholder DB configuration.
- [x] Add Redis placeholder.
- [x] Add object storage placeholder.
- [x] Add auth secret placeholder.
- [x] Add frontend API base URL.
- [x] Add email/notification placeholder.

Never place real credentials inside `.env.example`.

---

## F0.4 README Bootstrap

- [x] Project summary.
- [x] Architecture summary.
- [x] Prerequisites.
- [x] Local setup instructions.
- [x] Development commands.
- [x] Link to PRD, ERD, AGENTS, AI_RULES, TODO.

---

## F0.5 GitHub Workflow Skeleton

- [x] Add backend lint/test workflow placeholder.
- [x] Add frontend lint/typecheck/test/build workflow placeholder.
- [x] Keep deploy workflow disabled until production deployment phase.

---

# F1 — Backend Core Foundation

## Goal

Create a clean FastAPI foundation with clear module boundaries.

---

## F1.1 Initialize Python Backend

- [x] Create Python project.
- [x] Add FastAPI.
- [x] Add Uvicorn.
- [x] Add SQLAlchemy.
- [x] Add Alembic.
- [x] Add Pydantic settings.
- [x] Add PostgreSQL driver.
- [x] Add testing dependencies.
- [x] Add linting/formatting tools.

Suggested tools:

```text
fastapi
uvicorn
sqlalchemy
alembic
psycopg
pydantic-settings
pytest
httpx
ruff
mypy
```

### Acceptance Criteria

Backend starts successfully.

Example:

```bash
uvicorn app.main:app --reload
```

---

## F1.2 Create Backend Structure

- [x] `app/main.py`
- [x] `app/api/v1/`
- [x] `app/core/`
- [x] `app/models/`
- [x] `app/schemas/`
- [x] `app/repositories/`
- [x] `app/services/`
- [x] `app/workflows/`
- [x] `app/permissions/`
- [x] `app/tasks/`
- [x] `app/integrations/`
- [x] `tests/`

---

## F1.3 Application Configuration

- [x] Environment-based settings.
- [x] Development settings.
- [x] Production-safe defaults (`AUTH_SECRET` strength + no wildcard CORS enforced when `APP_ENV=production`; see `app/core/config.py`).
- [x] Database URL validation.
- [x] CORS configuration.
- [x] App metadata.

Never use production wildcard CORS.

---

## F1.4 Health Endpoints

- [x] `GET /health`
- [x] `GET /ready`

### Acceptance Criteria

`/health` verifies app process.

`/ready` should eventually verify required infrastructure.

---

## F1.5 Global Error Handling

- [x] Validation errors.
- [x] Domain/business errors.
- [x] Authentication errors.
- [x] Authorization errors.
- [x] 404 handling.
- [x] Safe 500 response.

### Acceptance Criteria

Production-safe errors do not expose stack traces or SQL.

---

## F1.6 API Versioning

- [x] Mount all domain endpoints under:

```text
/api/v1
```

---

# F2 — Database & Infrastructure Foundation

## Goal

Prepare PostgreSQL, Alembic, Redis, and storage abstractions.

---

## F2.1 PostgreSQL Integration

- [x] Configure SQLAlchemy engine.
- [x] Configure session factory.
- [x] Create DB dependency.
- [x] Add connection test.

---

## F2.2 SQLAlchemy Base Models

- [x] UUID primary key helper/mixin.
- [x] Timestamp mixin.
- [ ] Optional soft-delete strategy if needed.
- [x] Naming conventions for constraints.

---

## F2.3 Alembic Setup

- [x] Initialize Alembic.
- [x] Connect metadata.
- [x] Support autogeneration.
- [ ] Test upgrade/downgrade on development DB.

---
## F2.4 Redis Integration

- [x] Add Redis client abstraction.
- [x] Add health/readiness check.
- [x] Keep business features independent of direct Redis calls.

---

## F2.5 Object Storage Abstraction

- [x] Define storage interface.
- [x] Local development adapter.
- [x] S3-compatible adapter contract.
- [ ] Protected/signed URL abstraction.

Do not implement public permanent document URLs.

---

## F2.6 Docker Compose Development Stack

- [ ] backend
- [ ] frontend
- [x] PostgreSQL
- [x] Redis
- [ ] optional local object storage such as MinIO if selected

### Acceptance Criteria

New developer can start dependencies from documented commands.

---

# F3 — Authentication & RBAC

## Goal

Implement secure user authentication and permission-based authorization.

---

## F3.1 Users Model

- [x] Implement `users` (`app/models/user.py`).
- [x] Migration (`alembic/versions/b589f1d165a2_create_users_table.py`; now verified — the test suite runs `alembic upgrade head` against a real ephemeral PostgreSQL instance, see F3 Tests note below).
- [x] Unique email constraint.
- [x] Unique phone constraint.
- [x] Active state (`is_active`, DB default `TRUE`).

---

## F3.2 Roles Model

- [x] Implement `roles` (`app/models/role.py`).
- [x] Migration (`alembic/versions/f5e3162632a8_create_rbac_tables.py`).
- [x] Seed system roles (`alembic/versions/42a959998a57_seed_rbac_baseline_data.py`).

Required initial roles:

```text
super_admin
admission_admin
verifier
finance
assessor
principal
mpls_officer
parent
```

---

## F3.3 Permissions Model

- [x] Implement `permissions` (`app/models/permission.py`).
- [x] Implement `user_roles` (`app/models/user_role.py`).
- [x] Implement `role_permissions` (`app/models/role_permission.py`).
- [x] Seed baseline permissions (`alembic/versions/42a959998a57_seed_rbac_baseline_data.py`).
  Note: the role -> permission grants seeded there are a first-cut development
  baseline (documented in that migration's docstring), not a spec'd PRD/ERD
  rule — revisit via an admin RBAC UI before production.

---

## F3.4 Password Security

- [x] Secure password hashing (`app/core/security.py`, Argon2id via `argon2-cffi`).
- [x] Password verification.
- [x] Password validation policy (8-128 chars; see `validate_password_strength`).
- [x] Never log password content (no logging calls touch password fields).

---

## F3.5 Registration Endpoint

- [x] Parent registration (`POST /api/v1/auth/register`).
- [x] Input validation (Pydantic `RegisterRequest`; email-or-phone required).
- [x] Duplicate email/phone prevention (409 `EMAIL_TAKEN` / `PHONE_TAKEN`).
- [x] Default parent role assignment.

---

## F3.6 Login / Logout

- [x] Login endpoint (`POST /api/v1/auth/login`).
- [x] Secure session/token strategy (opaque token in Redis, HttpOnly/Secure/SameSite=Lax cookie; see `app/core/session.py`). Login throttling implemented (`app/core/rate_limit.py`, 5 attempts / 15 min).
- [x] Logout endpoint (`POST /api/v1/auth/logout`).
- [x] Active account check.

---

## F3.7 Current User Endpoint

- [x] `GET /api/v1/auth/me`
- [x] Return safe user profile (no `password_hash`).
- [x] Return roles/permissions needed by frontend.

---

## F3.8 Permission Dependency

- [x] Implement reusable backend permission guard (`app/permissions/dependencies.py`: `get_current_user`, `require_permission`).
- [x] Deny unauthorized API calls server-side.

### Tests

- [x] valid login
- [x] invalid password
- [x] inactive user
- [x] permitted endpoint
- [x] forbidden endpoint

All in `backend/tests/test_auth.py` (31/31 backend tests passing, `ruff`/`mypy`
clean on all files touched). Tests run against a real ephemeral PostgreSQL
(via the `pgserver` dev dependency) and an in-process Redis-compatible server
(via `fakeredis`), wired in `backend/tests/conftest.py` — not mocks; this also
made the CI test suite (which previously had no DB/Redis service) able to
verify DB-backed behavior for the first time. No `require_permission`-guarded
business endpoint exists yet (F4+), so its allow/deny logic is tested by
calling the dependency directly rather than through a route.

---

# F4 — Academic Year & Admission Period

## Goal

Make yearly admission configuration fully manageable.

---

## F4.1 Academic Year

- [x] Model (`app/models/academic_year.py`).
- [x] Migration (`alembic/versions/c7b2a9e34512_create_academic_years_and_admission_periods.py`).
- [x] Repository (`app/repositories/academic_year_repository.py`).
- [x] Service (`app/services/academic_year_service.py`).
- [x] Schemas (`app/schemas/academic_year.py`).
- [x] Admin CRUD API (`app/api/v1/endpoints/academic_years.py`, guarded by `academic_year.manage`).
- [x] Active academic year rule (PostgreSQL partial unique index `uq_academic_years_single_active` + transactional service auto-deactivation).

---

## F4.2 Admission Period

- [x] Model (`app/models/admission_period.py`).
- [x] Migration (`alembic/versions/c7b2a9e34512_create_academic_years_and_admission_periods.py`).
- [x] CRUD (`app/repositories/admission_period_repository.py`, `app/services/admission_period_service.py`, `app/api/v1/endpoints/admission_periods.py`).
- [x] Registration open/close dates (`registration_start < registration_end`).
- [x] Quota (`quota IS NULL OR quota >= 0`).
- [x] Active state (`is_active`, default `TRUE`).
- [x] Optional settings JSONB (`settings`).

---

## F4.3 Registration Availability Service

- [x] Determine whether registration is currently open (`app/services/registration_availability_service.py`).
- [x] Reject new submission outside allowed period (`assert_can_submit` with codes `REGISTRATION_NOT_STARTED`, `REGISTRATION_CLOSED`, `PERIOD_INACTIVE`, `ACADEMIC_YEAR_INACTIVE`).
- [x] Draft behavior defined (`assert_can_create_draft` allowing draft initialization only during active open windows).

### Tests

- [x] before opening
- [x] during opening
- [x] after closing
- [x] inactive period

All in `backend/tests/test_academic_years.py`, `backend/tests/test_admission_periods.py`, and `backend/tests/test_registration_availability.py` (52/52 backend tests passing, `ruff` and `mypy` strict clean across all 48 source files).


---

# F5 — Applicant & Guardian

## Goal

Implement reusable student identity data owned by parent accounts.

---

## F5.1 Applicant Model

- [x] Implement fields defined by ERD (`app/models/applicant.py`).
- [x] Migration (`alembic/versions/c7b2a9e34513_create_applicants_and_guardians.py`).
- [x] Sensitive field handling (NIK, KK, NISN formatted, protected by parental ownership and `application.read` permission checks).
- [x] Ownership relation to user (`owner_user_id` FK to `users.id` with `RESTRICT`).

---

## F5.2 Guardian Model

- [x] Father (`relationship = 'FATHER'`).
- [x] Mother (`relationship = 'MOTHER'`).
- [x] Optional guardian (`relationship = 'GUARDIAN'`).
- [x] Primary contact (`is_primary_contact` boolean with automatic single-active switching).
- [x] Migration (`alembic/versions/c7b2a9e34513_create_applicants_and_guardians.py`, check constraint `ck_guardians_relationship`, unique constraint `uq_guardians_applicant_relationship`).

---

## F5.3 Applicant CRUD

Parent can:

- [x] create applicant (`POST /api/v1/applicants`);
- [x] view own applicant (`GET /api/v1/applicants/{id}`);
- [x] edit applicant before locked stages (`PATCH /api/v1/applicants/{id}`);
- [x] list children (`GET /api/v1/applicants` isolated to logged-in parent).

### Security Tests

- [x] parent cannot access another parent's applicant (403 `PERMISSION_DENIED`).
- [x] admin with permission can access appropriate records (`application.read` role e.g. `admission_admin`, `verifier`).

---

## F5.4 Guardian CRUD

- [x] create/update guardian (`POST`/`PATCH /api/v1/applicants/{applicant_id}/guardians`).
- [x] ownership validation (strict check that the requesting parent owns the applicant).
- [x] relationship validation (uniqueness check per applicant, preventing duplicate father/mother).

### Tests

All in `backend/tests/test_applicants.py` and `backend/tests/test_guardians.py` (73/73 backend tests passing, `ruff check` and `mypy` strict clean across all 58 source files).

---

# F6 — Application / Registration Workflow

## Goal

Create the core admission application and controlled state machine.

---

## F6.1 Application Model

- [ ] Implement `applications`.
- [ ] Migration.
- [ ] Unique registration number.
- [ ] Current step.
- [ ] Completion percentage.
- [ ] State enum.

---

## F6.2 Status History

- [ ] Implement `application_status_histories`.
- [ ] Migration.
- [ ] Append history for every transition.

---

## F6.3 State Machine Service

- [ ] Central transition map.
- [ ] Validation of legal transitions.
- [ ] Transition permission support.
- [ ] Reason support.
- [ ] Atomic transaction.
- [ ] History creation.
- [ ] Audit integration hook.

### Required Tests

- [ ] valid transition
- [ ] invalid transition
- [ ] repeated transition
- [ ] missing prerequisite
- [ ] history creation

---

## F6.4 Create Draft Application

- [ ] Parent selects applicant.
- [ ] Parent selects admission period.
- [ ] Prevent duplicate application if policy requires.
- [ ] Start as `DRAFT`.

---

## F6.5 Registration Number Generator

Format recommendation:

```text
REG-2027-000001
```

- [ ] Central generator.
- [ ] Collision-safe.
- [ ] Not used as PK.

---

## F6.6 Completion Calculator

- [ ] Calculate wizard completion percentage.
- [ ] Do not trust frontend percentage.

---

## F6.7 Submit Application

Before transition to `SUBMITTED`, validate:

- [ ] mandatory applicant fields;
- [ ] required guardians;
- [ ] required documents;
- [ ] active admission period;
- [ ] registration period;
- [ ] consent requirements.

### Acceptance Criteria

Invalid application cannot submit.

---

# F7 — Document Management

## Goal

Provide secure configurable upload and verification-ready document handling.

---

## F7.1 Document Requirement Model

- [ ] Model.
- [ ] Migration.
- [ ] Admission-period-specific requirements.
- [ ] Required/optional.
- [ ] MIME types.
- [ ] Size limit.
- [ ] Sort order.

---

## F7.2 Admin Requirement CRUD

- [ ] list
- [ ] create
- [ ] edit
- [ ] disable

Do not delete historically referenced requirements.

---

## F7.3 Application Document Model

- [ ] Model.
- [ ] Migration.
- [ ] Metadata.
- [ ] Version.
- [ ] Status.
- [ ] Verifier relation.

---

## F7.4 Secure Upload Endpoint

Validate:

- [ ] ownership;
- [ ] requirement exists;
- [ ] MIME;
- [ ] extension;
- [ ] file size;
- [ ] checksum if implemented.

---

## F7.5 Secure Download / Preview

- [ ] Permission check.
- [ ] Ownership check.
- [ ] Signed/protected access.
- [ ] No public permanent URL.

---

## F7.6 Document Revision

- [ ] Implement revision request.
- [ ] Preserve old version.
- [ ] Upload new version.
- [ ] Resolution workflow.

### Tests

- [ ] valid upload
- [ ] invalid MIME
- [ ] oversized file
- [ ] unauthorized access
- [ ] revision flow

---

# F8 — Verification Center

## Goal

Enable efficient administrative verification with work queues.

---

## F8.1 Verification Assignment

- [ ] `verification_assignments`.
- [ ] Assign manually.
- [ ] Optional auto-assignment strategy later.
- [ ] Completion tracking.

---

## F8.2 Verification Review

- [ ] `verification_reviews`.
- [ ] Status.
- [ ] Notes.
- [ ] Start/completion timestamps.

---

## F8.3 Verifier Queue API

Filters:

- [ ] unassigned
- [ ] assigned to me
- [ ] pending
- [ ] revision required
- [ ] verified
- [ ] admission period
- [ ] search applicant

---

## F8.4 Verify Document

Actions:

- [ ] valid
- [ ] invalid
- [ ] revision required

---

## F8.5 Complete Application Verification

Only allow `VERIFIED` if all mandatory documents and data satisfy rules.

### Tests

- [ ] complete application verifies
- [ ] missing required document blocks
- [ ] revision blocks verification
- [ ] unauthorized verifier blocked

---

# F9 — Selection & Assessment

## Goal

Implement configurable assessment components and scoring.

---

## F9.1 Selection Component

- [ ] Model.
- [ ] Migration.
- [ ] CRUD.
- [ ] Weight.
- [ ] Max score.
- [ ] Minimum score.
- [ ] Active status.

---

## F9.2 Weight Validation

- [ ] Prevent invalid negative/over-100 weight.
- [ ] Add service to validate total active weight.

---

## F9.3 Assessment Schedule

- [ ] Model.
- [ ] Migration.
- [ ] Schedule per applicant/component.
- [ ] Location.
- [ ] Status.

---

## F9.4 Assessment Model

- [ ] Model.
- [ ] Migration.
- [ ] Assessor relation.
- [ ] Score bounds.
- [ ] Notes.

---

## F9.5 Assessment API

Assessor can:

- [ ] view assigned candidates;
- [ ] submit score;
- [ ] edit score within policy;
- [ ] not access unrelated candidates.

---

## F9.6 Score Calculation Service

- [ ] Central weighted score calculator.
- [ ] Use Decimal.
- [ ] No hardcoded assessment components.
- [ ] Save aggregate if using `application_scores`.

---

## F9.7 Ranking Service

- [ ] rank by final score;
- [ ] scope by admission period;
- [ ] deterministic tie rule documented.

Do not invent a tie rule silently. If not specified, leave explicit TODO before production.

---

# F10 — Decision & Waiting List

## Goal

Convert assessment results into controlled admission decisions.

---

## F10.1 Application Decision Model

- [ ] Model.
- [ ] Migration.
- [ ] One decision per application.
- [ ] Score/rank snapshot.
- [ ] Decided by.

---

## F10.2 Decision Service

Allowed decision:

```text
ACCEPTED
WAITLISTED
REJECTED
```

- [ ] Require permission.
- [ ] Validate assessment status.
- [ ] Store reason when relevant.
- [ ] Update application through state machine.

---

## F10.3 Decision History

- [ ] Implement override history.
- [ ] Mandatory reason for override.
- [ ] Audit log.

---

## F10.4 Waiting List

- [ ] Model.
- [ ] Migration.
- [ ] Position.
- [ ] Score.
- [ ] Status.

---

## F10.5 Waiting List Promotion

- [ ] privileged permission;
- [ ] reason;
- [ ] history;
- [ ] state transition;
- [ ] audit log.

### Tests

- [ ] normal decision
- [ ] invalid decision
- [ ] unauthorized override
- [ ] override with reason
- [ ] waiting-list promotion

---

# F11 — Announcement

## Goal

Publish results safely to applicants.

---

## F11.1 Publication Control

- [ ] Decision remains private before publication.
- [ ] Admin publish action.
- [ ] `published_at`.

---

## F11.2 Parent Result API

- [ ] Parent sees only own result.
- [ ] Only after publication.
- [ ] Include next-step instructions.

---

## F11.3 Result Letter / PDF

- [ ] Template.
- [ ] Generate asynchronously if needed.
- [ ] Secure download.

---

# F12 — Re-registration

## Goal

Handle accepted applicants from acceptance to final enrollment readiness.

---

## F12.1 Re-registration Model

- [ ] Model.
- [ ] Migration.
- [ ] Status workflow.

---

## F12.2 Re-registration Requirements

- [ ] configurable requirements;
- [ ] migration;
- [ ] admission period relation.

---

## F12.3 Re-registration Items

- [ ] requirement completion tracking.
- [ ] notes.
- [ ] timestamp.

---

## F12.4 Start Re-registration

Only:

```text
ACCEPTED
```

applications may start.

---

## F12.5 Complete Re-registration

Validate:

- [ ] mandatory items;
- [ ] required documents;
- [ ] payment conditions;
- [ ] confirmation.

Transition:

```text
RE_REGISTRATION
→ RE_REGISTRATION_VERIFIED
```

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

- [ ] Model.
- [ ] Migration.
- [ ] Append-only behavior.

---

## F18.2 Audit Integration

Must audit:

- [ ] status override
- [ ] decision override
- [ ] payment verification
- [ ] role assignment
- [ ] permission changes
- [ ] enrollment
- [ ] system settings changes

---

## F18.3 Consent Model

- [ ] Model.
- [ ] Migration.
- [ ] Privacy policy consent.
- [ ] Data processing consent.
- [ ] Version tracking.

---

## F18.4 Security Headers

- [ ] CSP
- [ ] HSTS in production
- [ ] X-Content-Type-Options
- [ ] appropriate frame protection
- [ ] Referrer Policy

---

## F18.5 Rate Limiting

Apply to:

- [ ] login
- [ ] registration
- [ ] password reset
- [ ] sensitive public endpoints
- [ ] upload endpoints as appropriate

---

## F18.6 File Access Review

- [ ] No private document is public.
- [ ] Ownership tests.
- [ ] Admin permission tests.
- [ ] Expiring links.

---

## F18.7 Secret Review

- [ ] scan repository;
- [ ] ensure `.env` ignored;
- [ ] rotate any accidentally exposed secrets.

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
→ F1.2 Backend Structure
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
F1  [-] Backend Core Foundation
F2  [-] Database & Infrastructure
F3  [x] Authentication & RBAC
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
