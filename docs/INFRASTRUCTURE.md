# F2 infrastructure status

Install backend dependencies from `backend/` with the selected virtual environment:
`../venv/bin/python -m pip install -e '.[dev]'`.

`/health` checks the process. `/ready` checks PostgreSQL and Redis with bounded
timeouts and returns 503 if either is unavailable. It does not expose connection
details. Redis clients and database pools close on application shutdown.

Alembic includes its revision template. Offline SQL generation works, but there
are currently no domain migrations or tables. Online upgrade/downgrade remains
unverified. Do not interpret an empty offline migration as a provisioned database.

`LocalObjectStorage` stores opaque UUID keys with private file permissions.
Use a private root outside any static directory. The caller must perform ownership
and permission checks before opening an object. There is no public download route
or signed URL implementation yet. The storage Protocol is also the contract for a
future S3 adapter; a working S3 provider has not been implemented.

Verification: 7 focused infrastructure/error tests pass. Full suite: 7 pass,
5 fail in existing configuration and health contracts. F1 is reopened accordingly.
Redis/PostgreSQL packages are installed in the root `venv`; live PostgreSQL migration
verification, protected document delivery, and complete Compose app services remain.
