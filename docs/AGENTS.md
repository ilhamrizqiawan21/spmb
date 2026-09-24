# AGENTS.md
## SPMB Terpadu 2026/2027

This file defines how AI coding agents must work inside this repository.

---

# 1. Project Identity

**Project:** SPMB Terpadu 2026/2027  
**Type:** End-to-end student admission management system  
**Architecture:** Modular Monolith  
**Frontend:** React + TypeScript + Vite  
**Backend:** Python + Django + Django REST Framework  
**Database:** PostgreSQL  
**ORM:** Django ORM  
**Migration:** Django Migrations  
**Cache / Queue:** Redis (Django cache framework + Celery)  
**Testing:** Pytest (pytest-django) + Vitest + React Testing Library + Playwright

> **Migration note:** v1 was originally built on FastAPI + SQLAlchemy +
> Alembic. The project is migrating to Django + DRF + the Django ORM. This is
> a rewrite of the backend, not a port — see `INFRASTRUCTURE.md` (once
> updated) for the cutover plan. Until the migration is complete, code under
> `backend/` may still reflect the old stack; do not assume it is current.

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

Django project structure should follow:

```text
config/                  # Django project package (settings, root urls, asgi/wsgi)
├── settings/
│   ├── base.py
│   ├── development.py
│   ├── testing.py
│   └── production.py
├── urls.py
└── asgi.py / wsgi.py

apps/
├── auth/
├── admission/
├── documents/
├── verification/
├── selection/
├── finance/
├── enrollment/
├── mpls/
├── communication/
└── system/
```

Each domain app under `apps/` should follow:

```text
apps/<domain>/
├── models.py            # or models/ package if large
├── migrations/
├── serializers.py        # DRF serializers (request/response contracts)
├── services.py            # or services/ package — business logic
├── permissions.py        # DRF permission classes for this domain
├── views.py               # or viewsets.py
├── urls.py
├── tasks.py                # Celery tasks
└── tests/
```

Preferred call flow:

```text
API View / ViewSet
   ↓
Service
   ↓
Manager / QuerySet (Django ORM)
   ↓
Database
```

Business rules must not live directly in views.

Views should mainly:

- parse input via a serializer;
- invoke service logic;
- enforce DRF permission classes;
- return a response built from a serializer.

Prefer function-based or class-based API views/viewsets that stay thin.
Fat models and fat views are both against this rule — put business logic in
`services.py`, not in `Model.save()` overrides or view methods.

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

```python
application.status = "ACCEPTED"
```

directly inside a route/controller without transition validation.

---

# 8. Database Rules

Use PostgreSQL relational design.

Primary keys:

```text
UUID
```

Use:

```python
uuid.UUID
```

in Python and UUID types in PostgreSQL.

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

All schema changes must use Django migrations (`makemigrations` / `migrate`).

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

# 11. DRF Serializer Rules

All external API input/output must use Django REST Framework serializers.

Separate serializers by purpose where needed:

```text
ApplicationCreateSerializer
ApplicationUpdateSerializer
ApplicationReadSerializer
ApplicationListItemSerializer
ApplicationSubmitRequestSerializer
```

Do not expose sensitive fields unintentionally (use `fields`/explicit
declarations, not `fields = "__all__"` on models with sensitive columns).

Do not reuse `ModelSerializer` defaults as the public API contract for
business-critical endpoints — declare fields explicitly once the contract is
stable, so a model change cannot silently change the API shape.

---

# 12. Django ORM Rules

Use modern Django ORM patterns (`QuerySet` methods, `F()`/`Q()` expressions,
custom `Manager`/`QuerySet` classes for reusable query logic).

Avoid N+1 queries: use `select_related()` for forward FK/O2O and
`prefetch_related()` for reverse FK/M2M.

Do not place large business rules inside `Model.save()`, `pre_save`/`post_save`
signals, or other model event hooks.

A custom `Manager`/`QuerySet` on the model handles data access patterns
(equivalent to a repository layer).

Service layer (`services.py`) handles business rules — not the model, not the
view.

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

```python
if user.role == "admin":
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
Pytest
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
pytest                                        # pytest-django
python manage.py migrate
python manage.py makemigrations <app_label>
python manage.py test                          # Django's own test runner, if used instead of pytest
ruff check .
mypy .
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
- replace PostgreSQL with another datastore without approval.

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
