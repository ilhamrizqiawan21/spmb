"""Shared pytest fixtures.

An ephemeral PostgreSQL instance (via ``pgserver``) and an in-process
Redis-compatible server (via ``fakeredis``) are started once per test
session so tests exercise real database/cache behavior instead of mocks.
Neither package is a runtime dependency of the application; both are
dev/test-only and installed separately (not in pyproject.toml's `dev`
extra) to keep the base dev install lightweight.
"""

import os
import tempfile
from pathlib import Path

_TMP_DIR = Path(__file__).resolve().parent.parent / ".tmp"
_TMP_DIR.mkdir(exist_ok=True)
os.environ["TMPDIR"] = str(_TMP_DIR)
os.environ["XDG_RUNTIME_DIR"] = str(_TMP_DIR)

import django_redis  # noqa: E402
import fakeredis  # noqa: E402
import pgserver  # noqa: E402
import redis  # noqa: E402
from django.conf import settings  # noqa: E402

_PG_DATA_DIR = tempfile.mkdtemp(prefix="spmb-test-pg-", dir=str(_TMP_DIR))
_pg_server = pgserver.get_server(_PG_DATA_DIR)
_pg_server.psql("CREATE DATABASE spmb_test;")

_socket_dir = str(_pg_server.get_postmaster_info().socket_dir)
os.environ["POSTGRES_DB"] = "spmb_test"
os.environ["POSTGRES_USER"] = "postgres"
os.environ["POSTGRES_PASSWORD"] = ""
os.environ["POSTGRES_HOST"] = _socket_dir
os.environ["POSTGRES_PORT"] = ""

if hasattr(settings, "DATABASES") and "default" in settings.DATABASES:
    settings.DATABASES["default"]["NAME"] = "spmb_test"
    settings.DATABASES["default"]["USER"] = "postgres"
    settings.DATABASES["default"]["PASSWORD"] = ""
    settings.DATABASES["default"]["HOST"] = _socket_dir
    settings.DATABASES["default"]["PORT"] = ""

_fake_cache = fakeredis.FakeStrictRedis(decode_responses=False)
redis.Redis.from_url = classmethod(lambda cls, *args, **kwargs: _fake_cache)  # type: ignore[assignment]
django_redis.get_redis_connection = lambda alias="default": _fake_cache  # type: ignore[assignment]
