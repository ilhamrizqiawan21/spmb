"""Production settings: strict security, fails closed on weak configuration."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, SECRET_KEY

DEBUG = False

ENVIRONMENT_NAME = "production"

INSECURE_SECRET_KEY = "insecure-placeholder-change-me"

if SECRET_KEY == INSECURE_SECRET_KEY or len(SECRET_KEY) < 32:
    raise ImproperlyConfigured("SECRET_KEY must be set to a strong, unique value in production.")

if "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Wildcard ALLOWED_HOSTS is not allowed in production.")

if "*" in CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("Wildcard CORS origins are not allowed in production.")

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
