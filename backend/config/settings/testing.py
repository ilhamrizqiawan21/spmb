"""Test settings: fast password hashing, predictable defaults."""

from .base import *  # noqa: F403

DEBUG = False

ENVIRONMENT_NAME = "testing"

ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
