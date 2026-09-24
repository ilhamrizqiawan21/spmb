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

import fakeredis
import pgserver
import redis

_PG_DATA_DIR = tempfile.mkdtemp(prefix="spmb-test-pg-")
_pg_server = pgserver.get_server(_PG_DATA_DIR)
_pg_server.psql("CREATE DATABASE spmb_test;")

os.environ["POSTGRES_DB"] = "spmb_test"
os.environ["POSTGRES_USER"] = "postgres"
os.environ["POSTGRES_PASSWORD"] = ""
os.environ["POSTGRES_HOST"] = str(_pg_server.get_postmaster_info().socket_dir)
os.environ["POSTGRES_PORT"] = ""

_fake_cache = fakeredis.FakeStrictRedis(decode_responses=False)
redis.Redis.from_url = classmethod(lambda cls, *args, **kwargs: _fake_cache)  # type: ignore[assignment]
