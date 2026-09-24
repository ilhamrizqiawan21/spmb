from django.apps import AppConfig


class AuthConfig(AppConfig):
    """Owns the custom user model, roles, and permissions.

    ``label`` is ``spmb_auth`` (not ``auth``) to avoid colliding with
    ``django.contrib.auth``, which registers the app label ``auth``.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.auth"
    label = "spmb_auth"
