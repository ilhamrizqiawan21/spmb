# AI_RULES.md
## Mandatory AI Engineering Rules — SPMB Terpadu 2026/2027

This file contains non-negotiable rules for AI assistants, coding agents, copilots, and automated refactoring tools working on this repository.

---

# 1. Source of Truth

All AI tools must treat these documents as authoritative:

```text
1. PRD_SPMB_Terpadu_2026_2027.md
2. ERD_SPMB_Terpadu_2026_2027.md
3. AI_RULES.md
4. AGENTS.md
```

Do not generate behavior that contradicts them.

If requirements are unclear, prefer preserving current business rules rather than inventing new ones.

---

# 2. Core Architecture Is Fixed

Version 1 architecture:

```text
Frontend:
React + TypeScript + Vite

Backend:
PHP 8.3 + Laravel 13 (JSON API + Laravel Sanctum)

Database:
MySQL 8.0.16+

ORM:
Eloquent

Migrations:
Laravel Migrations

Cache / Queue:
Laravel cache + queue (database driver; Redis optional)

Deployment:
Docker Compose + Reverse Proxy
```

> **Migration note:** the backend moved from FastAPI → Django/DRF/PostgreSQL →
> Laravel/MySQL. See `AGENTS.md` §1 and `INFRASTRUCTURE.md`. Do not
> reintroduce Python backends (FastAPI, Django), SQLAlchemy/Alembic, or
> PostgreSQL without an explicit architectural decision — the same bar this
> file sets for any other stack change.

Do not replace this architecture unless explicitly requested.

Do not introduce:

- Django, FastAPI, or any other competing/parallel backend framework;
- NestJS;
- Go backend;
- MongoDB;
- Firebase as the primary database;
- microservices;
- Kubernetes;

without explicit architectural approval.

---

# 3. Use Modular Monolith

Version 1 is a modular monolith.

Correct:

```text
one backend application
+
clear domain boundaries
+
separate services
+
shared infrastructure
```

Incorrect:

```text
auth-service
admission-service
finance-service
mpls-service
```

as independent deployable microservices in v1.

---

# 4. Never Bypass Business Workflow

Application state is business-critical.

Do not modify status from arbitrary code.

All application transitions must go through a workflow/service layer.

Every status transition must verify:

```text
current state
requested target state
user permission
business prerequisites
```

Then record history.

---

# 5. Allowed Application States

Only these values are valid unless the PRD is formally updated:

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

Do not invent:

```text
APPROVED
SUCCESS
DONE
FINISHED
VALID
```

as application states.

---

# 6. Status Changes Require History

Every application status change must create:

```text
application_status_histories
```

with at least:

```text
application_id
from_status
to_status
changed_by
reason
created_at
```

Sensitive status changes also require audit logging.

---

# 7. Database Is Relational-First

Use normalized relational entities.

Do not collapse major domain models into JSON.

Wrong:

```json
{
  "student": {},
  "parents": {},
  "documents": [],
  "payments": [],
  "assessments": []
}
```

inside one `applications.data` field.

Use JSONB only for:

- metadata;
- provider payload;
- audit diff;
- settings;
- flexible integration data.

---

# 8. UUID Is Default Primary Key

Business tables use UUID primary keys.

Do not create mixed ID strategies without a clear reason.

Never expose sequential IDs just because they are convenient.

Human-readable identifiers such as registration numbers are separate from PKs.

---

# 9. Human Registration Number Is Not Primary Key

Correct:

```text
id = UUID
registration_number = REG-2027-00182
```

Do not use registration number as the database PK.

---

# 10. Protect Historical Records

Do not hard-delete:

- applications;
- applicants;
- documents;
- assessments;
- decisions;
- payments;
- enrollments;
- students;
- audit logs.

Prefer:

```text
status
archive
soft delete
```

where needed.

---

# 11. Audit Log Is Append-Only

Do not create normal edit/delete UI for `audit_logs`.

Audit records are historical evidence.

Audit log should never be silently mutated.

---

# 12. RBAC Must Be Enforced on Backend

UI hiding is not security.

Correct:

```text
frontend visibility
+
backend permission enforcement
```

Every sensitive API endpoint must enforce permission.

Never trust:

```json
{
  "role": "admin"
}
```

from frontend request bodies.

---

# 13. Prefer Permissions Over Role Comparisons

Avoid:

```php
if ($user->role === 'admin') {
```

Prefer:

```text
application.verify
payment.verify
assessment.approve
```

This keeps permissions flexible.

---

# 14. Authentication Rules

Never store plaintext passwords.

Never log passwords.

Never send passwords in analytics or audit logs.

Use secure password hashing.

Production authentication must use secure transport.

Sensitive session/token storage must follow secure cookie practices where applicable.

---

# 15. Do Not Leak Personal Data

Never expose another applicant's data because the frontend requested a different ID.

Every object access must verify authorization/ownership.

Particularly protect:

- NIK;
- KK;
- NISN;
- addresses;
- guardian information;
- documents;
- payment proof;
- assessment records.

---

# 16. Uploaded Documents Are Private

Never generate permanent public URLs for sensitive documents.

Use protected access or signed temporary URLs.

Validate:

```text
MIME
size
ownership
authorization
```

Do not trust extension alone.

---

# 17. Never Store Files in Database BLOB by Default

Files belong in object storage.

Database stores metadata.

Do not place PDFs/images into MySQL BLOB columns unless explicitly justified.

---

# 18. Validate on Both Frontend and Backend

Frontend validation improves UX.

Backend validation enforces truth.

Never assume Zod validation eliminates the need for Laravel request validation.

---

# 19. API Contracts Must Be Typed

Controllers must validate input with explicit rules and return API
Resources — not raw `$request->all()` mass assignment or hand-built
response arrays for stable resource endpoints.

Do not return arbitrary untyped dictionaries for stable public endpoints.

Do not expose internal ORM fields accidentally.

---

# 20. Error Responses Must Be Safe

Production responses must not include:

- stack traces;
- SQL;
- secret values;
- filesystem paths;
- internal credentials.

Errors should be understandable to clients without leaking internals.

---

# 21. Do Not Put Business Logic in Controllers

Wrong:

```php
class ApplicationController
{
    public function submit(Request $request, string $id)
    {
        // 100 lines of validation
        // query database
        // calculate score
        // change status
        // send notification
    }
}
```

Correct:

```text
controller
↓
service/workflow
↓
Eloquent model / query builder
```

---

# 22. Do Not Put Provider Logic in Business Services

Wrong:

```text
AdmissionService directly calls WhatsApp provider API
```

Correct:

```text
AdmissionService
↓
NotificationService
↓
Provider Adapter
```

External providers must remain replaceable.

---

# 23. Background Jobs for Slow Work

Use worker/queue for:

- email;
- WhatsApp;
- PDF generation;
- large export;
- scheduled reminders;
- expensive processing.

Do not make user HTTP requests wait unnecessarily.

---

# 24. Background Jobs Must Be Retry-Safe

Where possible, jobs must be idempotent.

Retries must not create duplicate:

- notifications;
- payments;
- enrollments;
- invoices;
- status transitions.

---

# 25. Assessment Rules Are Configurable

Do not hardcode:

```text
academic_score
quran_score
interview_score
```

as permanent application columns.

Use:

```text
selection_components
assessments
```

so components can change per admission period.

---

# 26. Selection Weight Rules

Weight belongs to selection configuration.

Do not calculate final score using constants scattered in code.

Correct:

```text
selection_components.weight
```

Centralize score calculation in one domain service.

---

# 27. Decision Override Requires Reason

Changing:

```text
WAITLISTED → ACCEPTED
REJECTED → ACCEPTED
ACCEPTED → REJECTED
```

must require:

- privileged permission;
- reason;
- decision history;
- audit log.

No silent override.

---

# 28. Enrollment Preconditions Are Mandatory

Do not create student records simply because an admin clicked a button.

Enrollment service must validate required conditions.

Typical preconditions:

```text
decision == ACCEPTED
re-registration complete
required payment satisfied/waived
required final documents valid
```

---

# 29. Student Record Must Preserve Admission History

Creating a student must not delete or replace the original application.

The admission record remains historical truth.

---

# 30. MPLS Participant Must Reference Enrolled Student

Do not create MPLS participants from arbitrary applicants.

Required chain:

```text
Application
→ Enrollment
→ Student
→ MPLS Participant
```

---

# 31. QR Codes Must Not Contain Sensitive Data

Never encode:

```text
NIK
full address
KK
guardian phone
birth date
```

inside attendance QR.

Use opaque token/identifier.

---

# 32. Payment Status Must Be Server-Controlled

Frontend must never be able to directly assert:

```text
PAID
```

without verification.

Payment state changes must happen through backend business logic.

---

# 33. Money Uses Decimal

Never use binary floating point for money.

Use:

```text
NUMERIC
Decimal
```

for currency amounts.

---

# 34. Date/Time Rules

Use timezone-aware timestamps.

MySQL:

```text
DATETIME / TIMESTAMP stored in UTC (config/app.php timezone = UTC)
```

The API accepts ISO-8601 with offsets, normalizes to UTC, and always returns
UTC (`...Z`). Application logic must avoid naive datetime values for
production events.

---

# 35. Do Not Duplicate Domain Types

Centralize enums and domain constants.

Do not define the same application statuses independently in many frontend files.

Prefer shared generated contracts or one canonical frontend module.

---

# 36. TypeScript Strictness

Do not disable strict mode to make errors disappear.

Avoid:

```typescript
any
```

Use:

```typescript
unknown
```

plus validation when input is uncertain.

Do not suppress errors broadly with:

```text
@ts-ignore
eslint-disable
```

unless narrowly justified.

---

# 37. React Server State Rule

Use TanStack Query for API/server state.

Do not copy server responses into local state without need.

Do not implement manual caching that duplicates TanStack Query behavior.

---

# 38. Forms Must Support Draft Workflow

Registration forms must allow:

```text
save draft
resume later
validate steps
final review
submit
```

Do not mark incomplete drafts as submitted.

---

# 39. Frontend Must Handle UI States

Every async page/component must handle:

```text
loading
error
empty
success
```

Do not leave blank screens when API responses are empty or fail.

---

# 40. No Hidden Destructive Actions

Destructive/sensitive operations require confirmation.

Examples:

- cancellation;
- enrollment reversal;
- payment rejection;
- decision override;
- role deletion.

Bulk operations require preview where practical.

---

# 41. No Dependency Bloat

Before adding a dependency:

1. verify existing library cannot handle it;
2. confirm maintenance quality;
3. check security implications;
4. confirm bundle/runtime impact.

Do not install packages for trivial utilities.

---

# 42. Do Not Rewrite Working Code Without Need

Avoid speculative refactors.

A requested bug fix should not become a repository-wide rewrite.

Refactor only when necessary to implement correctly or explicitly requested.

---

# 43. Tests Are Required for Critical Rules

At minimum, add tests when changing:

- status transitions;
- permissions;
- scoring;
- decisions;
- payment verification;
- enrollment;
- document authorization.

---

# 44. Never Disable Tests to Pass CI

Do not:

- comment out failing tests;
- skip critical tests;
- weaken assertions;
- remove coverage;

just to make CI green.

Fix the implementation or update the test only when behavior legitimately changed.

---

# 45. Migration Safety

Never create destructive migration casually.

Before:

```text
DROP COLUMN
DROP TABLE
ALTER TYPE
```

consider existing production data.

Provide migration path.

---

# 46. Naming Rules

Use clear business names.

Good:

```text
application_status_histories
document_requirements
verification_reviews
selection_components
```

Avoid vague names:

```text
data
items
temp
info
details2
helper_table
```

---

# 47. Keep Modules Domain-Oriented

Do not create generic mega-services:

```text
AppService
CommonService
MainManager
HelperService
```

Domain logic belongs to domain-specific services.

---

# 48. Avoid God Classes and God Files

Split code when responsibilities differ.

Do not create:

```text
application_service.py
```

with every feature of registration, assessment, finance, enrollment, and MPLS mixed together.

---

# 49. Logging Rules

Logs may include:

- request ID;
- event name;
- internal resource ID;
- status;
- timing.

Logs must not include:

- passwords;
- raw tokens;
- full sensitive documents;
- private credentials.

---

# 50. Secrets Rules

Secrets belong in environment/secret management.

Never commit real:

```text
DATABASE_URL
JWT_SECRET
SMTP_PASSWORD
WHATSAPP_TOKEN
S3_SECRET_KEY
```

Provide `.env.example` with placeholders only.

---

# 51. Configuration Rules

Things expected to change yearly should not be scattered constants.

Examples:

- academic year;
- registration periods;
- quota;
- selection components;
- document requirements;
- deadlines;
- MPLS groups.

Store them in database/configuration where appropriate.

---

# 52. Do Not Overengineer

Prefer the simplest architecture that correctly satisfies the PRD.

Do not introduce:

- CQRS;
- event sourcing;
- distributed saga;
- service mesh;
- Kafka;
- Kubernetes;

without a demonstrated need.

---

# 53. Performance Rules

Optimize based on evidence.

Still avoid obvious issues:

- N+1 queries;
- unbounded list endpoints;
- huge payloads;
- loading full binary documents through API unnecessarily;
- missing indexes on heavily filtered columns.

---

# 54. Pagination Is Required

Large list endpoints must paginate.

Examples:

```text
applications
payments
audit_logs
notifications
students
```

Do not return thousands of records by default.

---

# 55. Search Must Be Safe

User-provided search values must use parameterized queries / ORM filtering.

Never construct raw SQL by concatenating user input.

---

# 56. Reports Must Reuse Domain Truth

Reports must derive from the same canonical database state.

Do not maintain separate manually synchronized report tables unless justified.

---

# 57. API Versioning Is Required

Public backend route prefix:

```text
/api/v1
```

Do not expose unversioned production domain endpoints.

---

# 58. Backward Compatibility

When changing stable API contracts:

- assess frontend impact;
- update callers;
- update tests;
- update docs.

Avoid silent response shape changes.

---

# 59. Documentation Must Stay Synchronized

When changing:

- entity relationship;
- workflow;
- business status;
- permission;
- public API;
- major architecture;

update the relevant Markdown documentation.

---

# 60. No Fake Completeness

An AI must not claim a feature is complete when:

- tests were not run;
- migration was not created;
- required permission is missing;
- error states are not handled;
- required API is stubbed;
- core acceptance criteria remain unmet.

State clearly what was actually implemented.

---

# 61. Respect Existing User Changes

Before editing:

```bash
git status
```

Do not discard unrelated local changes.

Do not overwrite manually written user work without explicit reason.

---

# 62. File Scope Discipline

Only change files required for the task.

Do not run formatting that rewrites the entire repository unless explicitly needed.

---

# 63. No Unrequested UI Redesign

When fixing backend or isolated behavior, do not redesign unrelated UI.

When working on UI, preserve established design system unless redesign is requested.

---

# 64. No Hardcoded Demo Data in Production Logic

Do not commit production behavior that depends on:

```text
John Doe
REG-001
example school
fake score
dummy payment
```

Demo data belongs in seeds/fixtures.

---

# 65. Seeds Must Be Safe

Seeders should create:

- roles;
- permissions;
- optional local development data.

Do not seed real personal student data.

---

# 66. Audit Sensitive Admin Actions

At minimum audit:

```text
role assignment
permission changes
application override
decision override
payment verification
enrollment
system configuration changes
```

---

# 67. Privacy by Design

Collect only data required for the process.

Do not add personal fields merely because they might be useful someday.

New sensitive fields require clear product justification.

---

# 68. Development Priority

When forced to choose, prioritize:

```text
Correctness
→ Security
→ Data Integrity
→ Workflow Integrity
→ Maintainability
→ User Experience
→ Performance Optimization
```

Do not sacrifice data integrity for cosmetic speed.

---

# 69. AI Change Review Checklist

Before finalizing any implementation:

```text
[ ] Does this match the PRD?
[ ] Does this match the ERD?
[ ] Does this preserve the state machine?
[ ] Is backend authorization enforced?
[ ] Is sensitive data protected?
[ ] Is validation server-side?
[ ] Are database changes migrated?
[ ] Are historical records preserved?
[ ] Are critical actions audited?
[ ] Are tests added/updated?
[ ] Are docs updated if needed?
[ ] Were unrelated files left untouched?
```

---

# 70. Final Rule

When uncertain, do not invent hidden business behavior.

Prefer:

```text
explicit
traceable
typed
validated
audited
tested
```

over:

```text
implicit
magical
loosely typed
silent
untracked
```

The project must remain understandable by another developer without depending on the original AI session.

---

**End of AI_RULES.md**
