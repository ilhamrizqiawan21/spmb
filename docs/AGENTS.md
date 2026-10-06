# AGENTS.md
## SPMB Terpadu 2026/2027

This file defines how AI coding agents must work inside this repository.

---

# 1. Project Identity

**Project:** SPMB Terpadu 2026/2027  
**Type:** End-to-end student admission management system  
**Architecture:** Modular Monolith  
**Frontend:** React + TypeScript + Vite  
**Backend:** PHP 8.3 + Laravel 13 (JSON API, Laravel Sanctum bearer tokens)  
**Database:** MySQL 8.0.16+ (utf8mb4)  
**ORM:** Eloquent  
**Migration:** Laravel Migrations  
**Cache / Queue:** Laravel cache + queue (database driver by default, Redis optional)  
**Testing:** PHPUnit (Laravel feature tests) + Vitest + React Testing Library + Playwright  
**Frontend:** React + TypeScript + Vite (see `docs/FRONTEND.md`)

> **Migration note:** the backend was first built on FastAPI + SQLAlchemy +
> Alembic (git commit `b984024`), then on Django + DRF + PostgreSQL (git
> commit `e781905`), and has now been rewritten on Laravel + MySQL. The
> Django implementation is kept in git history as a behavioral reference only.
> Do not reintroduce Python, Django, FastAPI, or PostgreSQL without an
> explicit architectural decision.

Primary product documents:

```text
PRD_SPMB_Terpadu_2026_2027.md
ERD_SPMB_Terpadu_2026_2027.md
AI_RULES.md
```

These documents are the source of truth.

If implementation conflicts with those documents, stop and resolve the conflict before continuing.

---

# 2. Main Product Goal

The system must centralize the full SPMB lifecycle:

```text
Information
→ Account Registration
→ Applicant Data
→ Document Upload
→ Verification
→ Assessment
→ Decision
→ Announcement
→ Re-registration
→ Payment
→ Enrollment
→ MPLS
→ Official Student
```

The system must not behave like a simple CRUD form application.

The workflow and state transitions are core business logic.

---

# 3. Working Principles for Agents

Every agent must:

1. Read the relevant PRD and ERD sections before implementing.
2. Inspect existing code before creating new modules.
3. Reuse existing abstractions when suitable.
4. Avoid duplicate services, schemas, utilities, and components.
5. Keep changes scoped to the requested task.
6. Preserve existing working behavior unless explicitly asked to change it.
7. Add tests for business-critical changes.
8. Update documentation when behavior or architecture changes.
9. Never silently change business rules.
10. Never invent new requirements without documenting them.

---

# 4. Required Development Order

For every feature, follow this order:

```text
Understand Requirement
↓
Check PRD
↓
Check ERD
↓
Inspect Existing Code
↓
Define Domain Rules
↓
Define Schema / Contract
↓
Implement Service Logic
↓
Implement Persistence
↓
Implement API
↓
Implement UI
↓
Add Tests
↓
Run Tests
↓
Update Documentation
```

Do not start from UI and then invent backend behavior later.

---

# 5. Architecture Rules

Laravel project structure should follow:

```text
/
├── app/
│   ├── Exceptions/          # ApiException (standard error envelope)
│   ├── Http/
│   │   ├── Controllers/Api/ # thin controllers per domain
│   │   ├── Middleware/      # RequirePermission (RBAC)
│   │   └── Resources/       # API Resources (response contracts)
│   ├── Models/              # Eloquent models (UUID keys via HasUuids)
│   ├── Services/            # business logic and workflow rules
│   └── Support/             # status vocabularies, private storage
├── bootstrap/app.php        # routing, middleware aliases, error rendering
├── config/                  # app, database, sanctum, spmb (project settings)
├── database/migrations/     # schema, RBAC seed, MySQL CHECK constraints
├── routes/                  # api.php (/api/v1/*), web.php (/health, /ready)
└── tests/Feature/           # PHPUnit feature tests per domain
```

Domains (auth, admission, documents, verification, selection, finance,
enrollment, mpls, communication, system) map to services/controllers/resources
named after the domain. New domains follow the same layout.

Preferred call flow:

```text
Route (+ auth:sanctum, permission:<codes> middleware)
   ↓
Controller (validate input)
   ↓
Service (business rules, transactions)
   ↓
Eloquent model / query builder
   ↓
Database
```

Business rules must not live directly in controllers.

Controllers should mainly:

- validate input (`$request->validate()` / Form Requests);
- invoke service logic;
- rely on route middleware (`auth:sanctum`, `permission:...`) for authorization;
- return an API Resource.

Keep controllers thin. Fat models and fat controllers are both against this
rule — put business logic in `app/Services`, not in model events/observers or
controller methods.

---

# 6. Domain Modules

Backend ownership:

```text
auth
├── users
├── roles
└── permissions

admission
├── academic_years
├── admission_periods
├── applicants
├── guardians
├── applications
└── application_status_histories

documents
├── document_requirements
├── application_documents
└── document_revisions

verification
├── verification_assignments
└── verification_reviews

selection
├── selection_components
├── assessment_schedules
├── assessments
├── application_scores
├── application_decisions
└── waiting_list_entries

finance
├── invoices
├── payments
└── payment_histories

enrollment
├── re_registrations
├── enrollments
└── students

mpls
├── mpls_groups
├── mpls_participants
├── mpls_events
└── mpls_attendances

communication
├── notifications
└── notification_templates

system
├── system_settings
├── consents
└── audit_logs
```

Do not create a new domain if an existing domain already owns the responsibility.

---

# 7. Application State Machine

Application status is controlled.

Valid statuses:

```text
DRAFT
SUBMITTED
UNDER_VERIFICATION
REVISION_REQUIRED
RESUBMITTED
VERIFIED
ASSESSMENT_SCHEDULED
ASSESSED
ACCEPTED
WAITLISTED
REJECTED
RE_REGISTRATION
RE_REGISTRATION_VERIFIED
ENROLLED
MPLS_ACTIVE
MPLS_COMPLETED
COMPLETED
```

Agents must not update `applications.status` arbitrarily.

All transitions must:

1. be validated;
2. happen through a dedicated workflow/service;
3. create `application_status_histories`;
4. create audit log entries for sensitive changes;
5. reject illegal transitions.

Never do this:

```php
$application->status = 'ACCEPTED';
```

directly inside a route/controller without transition validation
(use `ApplicationStateMachine::transition()`).

---

# 8. Database Rules

Use MySQL (InnoDB) relational design.

Primary keys:

```text
UUID
```

Use Eloquent's `HasUuids` trait; UUIDs are stored as `CHAR(36)` in MySQL
(`$table->uuid('id')->primary()` / `foreignUuid()` in migrations).

All business tables should include:

```text
created_at
updated_at
```

unless deliberately append-only.

Avoid hard delete for:

- applicants;
- applications;
- documents;
- assessments;
- decisions;
- payments;
- enrollments;
- students;
- audit logs.

Use status, archive, or soft-delete strategy where appropriate.

---

# 9. Migration Rules

All schema changes must use Laravel migrations (`php artisan make:migration` / `migrate`).

Never modify production schema manually.

Every migration must:

- have a clear revision message;
- be reversible when reasonably possible;
- preserve existing data;
- avoid destructive changes without an explicit migration strategy.

Do not rename/drop important columns without handling existing records.

Migration order must respect the ERD.

---

# 10. API Rules

Base API:

```text
/api/v1
```

Use REST semantics.

Examples:

```text
GET    /api/v1/applications
POST   /api/v1/applications
GET    /api/v1/applications/{id}
PATCH  /api/v1/applications/{id}
POST   /api/v1/applications/{id}/submit
```

Use:

- correct HTTP methods;
- correct status codes;
- typed request schemas;
- typed response schemas;
- pagination;
- filtering;
- sorting;
- structured validation errors.

Avoid returning raw ORM objects without response schemas.

---

# 11. API Resource & Validation Rules

All external API output must go through Laravel API Resources
(`app/Http/Resources`); never return raw Eloquent models.

All external API input must be validated (`$request->validate()` or Form
Requests) with explicit rules per endpoint. Validation failures are rendered as
HTTP 400 with the standard `{"error": {code, message, details}}` envelope.

Separate rules by purpose (create vs. partial update) and never mass-assign
unvalidated request input. Do not expose sensitive attributes (password,
storage internals) unintentionally; declare resource fields explicitly so a
model change cannot silently change the API shape.

---

# 12. Eloquent Rules

Use modern Eloquent patterns (query scopes, relationships, `whereHas`,
eager loading).

Avoid N+1 queries: use `with()` / `load()` for relationships rendered by
resources.

Do not place large business rules inside model events, observers, or
accessors.

Service layer (`app/Services`) handles business rules — not the model, not the
controller. Wrap multi-step writes in `DB::transaction()`.

---

# 13. Frontend Architecture

Recommended:

```text
src/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── admission/
│   ├── documents/
│   ├── verification/
│   ├── assessment/
│   ├── finance/
│   ├── enrollment/
│   └── mpls/
├── hooks/
├── lib/
├── routes/
├── services/
├── types/
└── utils/
```

Use feature-based organization.

Avoid one giant:

```text
components/
```

folder containing unrelated business features.

---

# 14. TypeScript Rules

Do not use `any` unless unavoidable and documented.

Prefer:

```typescript
unknown
```

plus validation over unsafe `any`.

Use strict TypeScript.

Backend API types must match actual contracts.

Do not duplicate backend enums as arbitrary string values across multiple files.

Centralize domain types.

---

# 15. React Rules

Use functional components.

Keep components focused.

Separate:

- data fetching;
- business actions;
- reusable UI;
- page composition.

Avoid huge page components with hundreds of lines of mixed logic.

Use TanStack Query for server state.

Do not mirror server state unnecessarily in local React state.

Use React Hook Form + Zod for complex forms.

---

# 16. Form Rules

Registration is a multi-step wizard.

Requirements:

- autosave;
- resume later;
- server validation;
- client validation;
- progress indicator;
- incomplete drafts allowed;
- final submission only when required data is complete.

Never treat client-side validation as the final authority.

Backend validation is mandatory.

---

# 17. RBAC Rules

Permission model:

```text
User
↓
Role
↓
Permission
```

Never secure endpoints only with frontend menu visibility.

Backend must enforce permission.

Examples:

```text
application.read
application.verify
application.override
document.verify
payment.verify
assessment.input
assessment.approve
announcement.publish
enrollment.manage
mpls.manage
user.manage
audit.read
```

Avoid logic like:

```php
if ($user->role === 'admin') {
```

when a permission check is more appropriate.

---

# 18. Security Rules

Treat this application as handling sensitive student data.

Minimum requirements:

- HTTPS in production;
- password hashing;
- HttpOnly cookies;
- Secure cookies;
- login throttling;
- rate limiting;
- permission checks;
- server-side validation;
- upload MIME validation;
- file size validation;
- protected document access;
- signed URLs where appropriate;
- security headers;
- secret management;
- audit logging.

Never store secrets in source code.

Never commit:

```text
.env
private keys
API tokens
production credentials
database passwords
```

---

# 19. Document Upload Rules

Uploaded files must never be trusted.

Validate:

- MIME type;
- file extension;
- maximum size;
- upload ownership.

Store files in object storage.

Database stores metadata:

```text
storage_key
original_filename
mime_type
file_size
checksum
status
```

Never expose permanent public URLs for sensitive documents.

---

# 20. Audit Rules

Sensitive operations require audit logs.

Examples:

- application status changes;
- decision overrides;
- payment verification;
- role changes;
- permission changes;
- enrollment;
- sensitive configuration changes.

Audit logs should contain:

```text
user_id
action
resource_type
resource_id
old_values
new_values
reason
ip_address
user_agent
request_id
created_at
```

Audit logs are append-only.

Do not implement UI that edits audit history.

---

# 21. Payment Rules

Initial payment flow:

```text
Invoice
→ Upload Proof
→ Pending Verification
→ Verified / Rejected
```

Do not mark payment as paid solely because the frontend says it is paid.

Payment verification must happen server-side.

All payment status changes require history/audit.

---

# 22. Enrollment Rules

Enrollment is not just a status label.

Allowed only when:

- application decision = ACCEPTED;
- required re-registration steps are complete;
- required payments are complete or officially waived;
- required documents are valid.

Enrollment creates/activates official student data.

The original application history must remain intact.

---

# 23. MPLS Rules

Only enrolled students may become MPLS participants.

QR attendance token:

- must not contain student personal data directly;
- must be unique;
- should be revocable/rotatable if required.

Attendance uniqueness:

```text
(event_id, participant_id)
```

---

# 24. Background Jobs

Use background workers for:

- email;
- WhatsApp;
- PDF generation;
- large exports;
- scheduled reminders;
- heavy asynchronous processing.

Do not block HTTP requests for long-running operations when a queue is appropriate.

Jobs should be retry-safe where possible.

---

# 25. Notification Rules

Business logic should publish notification intents, not call providers everywhere.

Preferred:

```text
Business Event
↓
Notification Service
↓
Channel
├── IN_APP
├── EMAIL
└── WHATSAPP
```

Provider-specific logic belongs in integrations.

---

# 26. Testing Requirements

Critical business logic requires tests.

Backend:

```text
PHPUnit (Laravel feature tests)
```

Frontend:

```text
Vitest
React Testing Library
```

E2E:

```text
Playwright
```

Critical journey:

```text
Register
→ Login
→ Application
→ Upload
→ Submit
→ Verify
→ Assessment
→ Decision
→ Re-registration
→ Payment
→ Enrollment
→ MPLS
```

---

# 27. Minimum Test Expectations

When modifying:

### State transition
Add tests for:

- valid transition;
- invalid transition;
- history creation;
- permission failure.

### Payment
Add tests for:

- verification;
- rejection;
- duplicate action;
- audit/history.

### Document
Add tests for:

- valid upload;
- invalid MIME;
- oversized file;
- unauthorized access.

### RBAC
Add tests for:

- allowed user;
- forbidden user.

---

# 28. Definition of Done

A feature is not done until:

- requirement is satisfied;
- backend validation exists;
- permission checks exist;
- relevant tests pass;
- error handling exists;
- loading/empty/error UI states exist;
- audit exists where required;
- no secret is hardcoded;
- documentation is updated;
- lint/type-check/tests pass.

---

# 29. Commands

Agents should inspect project scripts before assuming exact commands.

Expected commands may include:

Backend:

```bash
composer install
php artisan migrate
php artisan test                               # PHPUnit (SQLite in-memory by default)
DB_CONNECTION=mysql php artisan test           # run the suite against MySQL
vendor/bin/pint --test                         # code style
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

E2E:

```bash
npx playwright test
```

Use the repository's actual package manager and scripts.

Do not introduce another package manager unnecessarily.

---

# 30. Git Rules

Before changing code:

```bash
git status
```

Do not overwrite unrelated user changes.

Do not commit secrets.

Do not force-push unless explicitly requested.

Keep commits logically scoped.

Suggested commit style:

```text
feat(admission): add application submission workflow
fix(documents): prevent unauthorized document access
test(selection): cover invalid score transitions
docs(erd): update enrollment relation
```

---

# 31. Refactoring Rules

Refactor only when:

- necessary for the requested task;
- reducing duplicated logic;
- fixing architectural debt blocking implementation;
- requested explicitly.

Do not rewrite large working areas merely for style preference.

Large refactors require preserved behavior and tests.

---

# 32. Prohibited Agent Behavior

Agents must not:

- invent tables that duplicate existing entities;
- bypass the state machine;
- modify application status directly from UI;
- trust frontend authorization;
- store uploaded documents publicly;
- hardcode academic year-specific values throughout code;
- use `any` broadly in TypeScript;
- return stack traces to end users;
- place all backend logic in routes;
- put all frontend logic inside pages;
- delete historical admission records;
- silently alter scoring rules;
- silently alter decision logic;
- introduce microservices without need;
- introduce Go into v1 without an architectural decision;
- add dependencies without a clear need;
- replace MySQL with another datastore without approval.

---

# 33. Decision Priority

When uncertain, use this order:

```text
1. User's explicit latest instruction
2. PRD
3. ERD
4. AI_RULES.md
5. AGENTS.md
6. Existing established architecture
7. Existing code conventions
```

If there is a conflict, document it before implementation.

---

# 34. Final Agent Checklist

Before declaring a task complete:

```text
[ ] Read relevant PRD section
[ ] Read relevant ERD section
[ ] Checked existing implementation
[ ] Did not duplicate existing abstraction
[ ] Followed module ownership
[ ] Added backend validation
[ ] Added permission checks
[ ] Preserved state machine rules
[ ] Added audit/history if required
[ ] Added/updated tests
[ ] Ran relevant tests
[ ] Ran lint/type checks
[ ] Updated docs when needed
[ ] No secrets committed
[ ] No unrelated files changed
```

---

**End of AGENTS.md**
