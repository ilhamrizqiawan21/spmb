# TODO.md
## SPMB Terpadu 2026/2027 — Execution Roadmap for Codex / AI Coding Agents

**Status:** Active Development Plan  
**Version:** 1.0  
**Project Architecture:** Modular Monolith  
**Frontend:** React + TypeScript + Vite  
**Backend:** Python + Django + Django REST Framework  
**Database:** PostgreSQL  
**ORM:** Django ORM  
**Migration:** Django Migrations  
**Cache / Queue:** Redis (Django cache framework + Celery)  
**Testing:** Pytest (pytest-django) + Vitest + React Testing Library + Playwright

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

Create a clean Django + DRF foundation with clear module boundaries.

> **Django migration reset (2026-09-24):** F1-F5 below were previously
> implemented and fully passing (73/73 tests) on FastAPI + SQLAlchemy +
> Alembic. That implementation was removed from the working tree as part of
> the architecture decision recorded in `AGENTS.md`/`AI_RULES.md`, and is
> preserved in git history at commit `b984024` ("chore: checkpoint FastAPI
> backend (F0-F5) before Django migration") for reference — domain rules
> (single-active-academic-year constraint, NIK/KK/NISN handling, RBAC seed
> data, session/throttle design, etc.) are worth reading there before
> re-implementing in Django. All checkboxes below are reset to `[ ]` because
> no Django code exists yet; do not mark them done by pointing at the old
> FastAPI files.

---

## F1.1 Initialize Python Backend

- [ ] Create Python project.
- [ ] Add Django.
- [ ] Add Django REST Framework.
- [ ] Add PostgreSQL driver (`psycopg`).
- [ ] Add Celery (background jobs / Redis integration).
- [ ] Add testing dependencies (`pytest`, `pytest-django`).
- [ ] Add linting/formatting tools.

Suggested tools:

```text
django
djangorestframework
psycopg
celery
django-redis
pytest
pytest-django
ruff
mypy
django-stubs
```

### Acceptance Criteria

Backend starts successfully.

Example:

```bash
python manage.py runserver
```

---

## F1.2 Create Backend Structure

- [ ] `config/settings/` (base/development/testing/production)
- [ ] `config/urls.py`
- [ ] `apps/auth/`
- [ ] `apps/admission/`
- [ ] `apps/documents/`
- [ ] `apps/verification/`
- [ ] `apps/selection/`
- [ ] `apps/finance/`
- [ ] `apps/enrollment/`
- [ ] `apps/mpls/`
- [ ] `apps/communication/`
- [ ] `apps/system/`

See `AGENTS.md` §5 for the expected structure inside each app
(`models.py`, `serializers.py`, `services.py`, `permissions.py`, `views.py`).

---

## F1.3 Application Configuration

- [ ] Environment-based settings (`config/settings/{base,development,testing,production}.py`).
- [ ] Development settings.
- [ ] Production-safe defaults (`SECRET_KEY` strength + no wildcard `ALLOWED_HOSTS`/CORS when `DJANGO_ENV=production`).
- [ ] Database URL validation.
- [ ] CORS configuration (`django-cors-headers`).
- [ ] App metadata.

Never use production wildcard CORS.

---

## F1.4 Health Endpoints

- [ ] `GET /health`
- [ ] `GET /ready`

### Acceptance Criteria

`/health` verifies app process.

`/ready` should eventually verify required infrastructure.

---

## F1.5 Global Error Handling

- [ ] Validation errors (DRF exception handler).
- [ ] Domain/business errors.
- [ ] Authentication errors.
- [ ] Authorization errors.
- [ ] 404 handling.
- [ ] Safe 500 response.

### Acceptance Criteria

Production-safe errors do not expose stack traces or SQL. `DEBUG = False` in
production settings.

---

## F1.6 API Versioning

- [ ] Mount all domain endpoints under:

```text
/api/v1
```

---

# F2 — Database & Infrastructure Foundation

## Goal

Prepare PostgreSQL, Django migrations, Redis, and storage abstractions.

---

## F2.1 PostgreSQL Integration

- [ ] Configure Django `DATABASES` setting.
- [ ] Add connection test / `/ready` check.

---

## F2.2 Base Model Conventions

- [ ] UUID primary key mixin/abstract base model.
- [ ] Timestamp mixin (`created_at`, `updated_at`).
- [ ] Optional soft-delete strategy if needed.
- [ ] Naming conventions for constraints/indexes.

---

## F2.3 Django Migrations Setup

- [ ] Confirm `makemigrations`/`migrate` workflow per app.
- [ ] Test upgrade/downgrade (`migrate <app> <previous_migration>`) on development DB.

---

## F2.4 Redis Integration

- [ ] Add Redis cache backend (`django-redis`) / Celery broker config.
- [ ] Add health/readiness check.
- [ ] Keep business features independent of direct Redis calls.

---

## F2.5 Object Storage Abstraction

- [ ] Define storage interface (Django Storage backend or custom abstraction).
- [ ] Local development adapter.
- [ ] S3-compatible adapter contract.
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

> Reference: the FastAPI implementation (Argon2id hashing, Redis-backed
> opaque session cookie, login throttling, RBAC seed data for the 8 system
> roles and 12 baseline permission codes) is preserved at git commit
> `b984024`. The business rules there are still valid; only the framework
> changes (DRF serializers/views/permission classes instead of Pydantic
> schemas/FastAPI routes/dependencies, Django's own password hashers instead
> of calling `argon2-cffi` directly, etc.).

---

## F3.1 Users Model

- [ ] Implement `users` (custom Django user model, `AUTH_USER_MODEL`).
- [ ] Migration.
- [ ] Unique email constraint.
- [ ] Unique phone constraint.
- [ ] Active state.

---

## F3.2 Roles Model

- [ ] Implement `roles`.
- [ ] Migration.
- [ ] Seed system roles.

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

- [ ] Implement `permissions`.
- [ ] Implement `user_roles`.
- [ ] Implement `role_permissions`.
- [ ] Seed baseline permissions.

---

## F3.4 Password Security

- [ ] Secure password hashing (Django's built-in password hashers, Argon2id).
- [ ] Password verification.
- [ ] Password validation policy.
- [ ] Never log password content.

---

## F3.5 Registration Endpoint

- [ ] Parent registration.
- [ ] Input validation.
- [ ] Duplicate email/phone prevention.
- [ ] Default parent role assignment.

---

## F3.6 Login / Logout

- [ ] Login endpoint.
- [ ] Secure session/token strategy.
- [ ] Logout endpoint.
- [ ] Active account check.

---

## F3.7 Current User Endpoint

- [ ] `GET /api/v1/auth/me`
- [ ] Return safe user profile.
- [ ] Return roles/permissions needed by frontend.

---

## F3.8 Permission Dependency

- [ ] Implement reusable backend permission guard (DRF `permissions.BasePermission`).
- [ ] Deny unauthorized API calls server-side.

### Tests

- [ ] valid login
- [ ] invalid password
- [ ] inactive user
- [ ] permitted endpoint
- [ ] forbidden endpoint

---

# F4 — Academic Year & Admission Period

## Goal

Make yearly admission configuration fully manageable.

> Reference: git commit `b984024` has a working FastAPI implementation,
> including the single-active-academic-year rule (there done with a
> PostgreSQL partial unique index + transactional auto-deactivation) and the
> registration-availability rules (`REGISTRATION_NOT_STARTED`,
> `REGISTRATION_CLOSED`, `PERIOD_INACTIVE`, `ACADEMIC_YEAR_INACTIVE`).

---

## F4.1 Academic Year

- [ ] Model.
- [ ] Migration.
- [ ] Service.
- [ ] Serializers.
- [ ] Admin CRUD API.
- [ ] Active academic year rule.

---

## F4.2 Admission Period

- [ ] Model.
- [ ] Migration.
- [ ] CRUD.
- [ ] Registration open/close dates.
- [ ] Quota.
- [ ] Active state.
- [ ] Optional settings JSONB.

---

## F4.3 Registration Availability Service

- [ ] Determine whether registration is currently open.
- [ ] Reject new submission outside allowed period.
- [ ] Draft behavior defined.

### Tests

- [ ] before opening
- [ ] during opening
- [ ] after closing
- [ ] inactive period

---

# F5 — Applicant & Guardian

## Goal

Implement reusable student identity data owned by parent accounts.

> Reference: git commit `b984024` has a working FastAPI implementation,
> including NIK/KK/NISN field handling, parental-ownership access control,
> and the guardian single-primary-contact rule.

---

## F5.1 Applicant Model

- [ ] Implement fields defined by ERD.
- [ ] Migration.
- [ ] Sensitive field handling.
- [ ] Ownership relation to user.

---

## F5.2 Guardian Model

- [ ] Father.
- [ ] Mother.
- [ ] Optional guardian.
- [ ] Primary contact.
- [ ] Migration.

---

## F5.3 Applicant CRUD

Parent can:

- [ ] create applicant;
- [ ] view own applicant;
- [ ] edit applicant before locked stages;
- [ ] list children.

### Security Tests

- [ ] parent cannot access another parent's applicant.
- [ ] admin with permission can access appropriate records.

---

## F5.4 Guardian CRUD

- [ ] create/update guardian.
- [ ] ownership validation.
- [ ] relationship validation.

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
→ F1.1 Django Backend Initialization
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
F1  [ ] Backend Core Foundation
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
