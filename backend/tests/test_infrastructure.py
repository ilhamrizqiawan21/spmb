from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main
from app.integrations.storage import LocalObjectStorage


@pytest.mark.asyncio
async def test_readiness_requires_both_services(monkeypatch):
    database = AsyncMock()
    cache = AsyncMock()
    monkeypatch.setattr(main, "check_database_connection", database)
    monkeypatch.setattr(main, "check_cache_connection", cache)
    async with AsyncClient(
        transport=ASGITransport(app=main.create_app()), base_url="http://test"
    ) as client:
        assert (await client.get("/ready")).status_code == 200
        cache.side_effect = ConnectionError("secret connection string")
        response = await client.get("/ready")
        assert response.status_code == 503
        assert "secret" not in response.text
    database.assert_awaited()
    cache.assert_awaited()


def test_private_storage_roundtrip_and_traversal(tmp_path: Path):
    store = LocalObjectStorage(tmp_path / "private")
    key = store.put(b"private document")
    with store.open(key) as stream:
        assert stream.read() == b"private document"
    assert (store.root / key).stat().st_mode & 0o777 == 0o600
    with pytest.raises(ValueError):
        store.open("../secret")
    link_key = "00000000-0000-0000-0000-000000000001"
    (store.root / link_key).symlink_to(store.root / key)
    with pytest.raises(ValueError):
        store.open(link_key)
