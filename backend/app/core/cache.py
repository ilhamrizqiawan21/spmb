"""Redis infrastructure; domain services depend on this adapter."""

from functools import lru_cache

from redis.asyncio import Redis

from app.core.config import get_settings


@lru_cache
def get_cache() -> Redis:
    return Redis.from_url(
        get_settings().redis_url,
        socket_connect_timeout=2,
        socket_timeout=2,
        decode_responses=True,
    )


async def check_cache_connection() -> None:
    if not await get_cache().ping():
        raise ConnectionError("Redis unavailable")


async def close_cache() -> None:
    if get_cache.cache_info().currsize:
        await get_cache().aclose()
        get_cache.cache_clear()
