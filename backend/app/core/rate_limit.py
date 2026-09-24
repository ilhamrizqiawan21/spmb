"""Fixed-window rate limiting backed by Redis."""

from app.core.cache import get_cache
from app.core.errors import AppException

_RATE_LIMIT_KEY_PREFIX = "ratelimit:"


class RateLimitExceededException(AppException):
    """Raised when a caller exceeds an enforced rate limit."""

    def __init__(self, message: str = "Too many attempts. Try again later.") -> None:
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
        )


async def enforce_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Raise ``RateLimitExceededException`` once ``key`` exceeds ``max_attempts``
    within the current ``window_seconds`` fixed window."""
    cache = get_cache()
    redis_key = f"{_RATE_LIMIT_KEY_PREFIX}{key}"
    attempts = await cache.incr(redis_key)
    if attempts == 1:
        await cache.expire(redis_key, window_seconds)
    if attempts > max_attempts:
        raise RateLimitExceededException()
