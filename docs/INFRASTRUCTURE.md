# Infrastructure status — Django migration

**Status (2026-09-24):** the backend is being rewritten on Django + Django
REST Framework, replacing the original FastAPI + SQLAlchemy + Alembic
implementation. See `AGENTS.md` §1 and `AI_RULES.md` §2 for the architecture
decision.

## What happened to the FastAPI implementation

The previous backend reached F0-F5 (repository foundation, backend core,
database/infrastructure, auth/RBAC, academic year/admission period,
applicant/guardian) with 73/73 tests passing. It was removed from the
working tree and is preserved at git commit `b984024`
("chore: checkpoint FastAPI backend (F0-F5) before Django migration").

Use that commit as a reference for domain rules and behavior, not as code to
port line-by-line — serializers, views, permission classes, and the ORM
layer all need to be re-authored in Django/DRF idioms per `AGENTS.md` §5,
§11, §12.

## Current state

`backend/` is empty except for `.env`. No Django project has been scaffolded
yet. Docker Compose currently provisions PostgreSQL and Redis only; backend
and frontend services are not yet defined (see `docker-compose.yml` and
TODO.md F2.6).

## Next steps

Follow `TODO.md` starting at F1.1 (Initialize Python Backend — Django) in
order. Do not skip ahead to business features (F4+) before F1-F3 are stable,
per `AGENTS.md` §4's required development order.
