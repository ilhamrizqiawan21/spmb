"""Password hashing and strength validation.

Never log a plaintext or hashed password. Callers must not pass password
values to logging calls or include them in exception details.
"""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.errors import DomainException

_hasher = PasswordHasher()

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def validate_password_strength(password: str) -> None:
    """Raise ``DomainException`` when the password fails the minimum policy."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise DomainException(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.",
            code="PASSWORD_TOO_SHORT",
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise DomainException(
            f"Password must be at most {MAX_PASSWORD_LENGTH} characters long.",
            code="PASSWORD_TOO_LONG",
        )


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return ``True`` when ``password`` matches the stored Argon2 hash."""
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
