"""Development settings: verbose errors, permissive local defaults."""

from .base import *  # noqa: F403

DEBUG = True

ENVIRONMENT_NAME = "development"

ALLOWED_HOSTS = ["*"]
