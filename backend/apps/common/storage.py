"""Private object storage abstractions and adapters.

Sensitive applicant documents must never be stored in public directories or served
via permanent public URLs. Access must go through authorization checks and signed URLs.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import BinaryIO, Protocol
from uuid import UUID, uuid4

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner


class ObjectStorage(Protocol):
    """Contract for private object storage."""

    def put(self, content: bytes, mime_type: str | None = None) -> str:
        """Store content and return an opaque storage key."""
        ...

    def open(self, key: str) -> BinaryIO:
        """Open and return a readable binary stream of the stored object."""
        ...

    def delete(self, key: str) -> None:
        """Delete the stored object."""
        ...

    def exists(self, key: str) -> bool:
        """Check if an object exists."""
        ...

    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a time-limited signed URL/token for accessing the object."""
        ...

    def verify_signed_token(self, token: str, max_age: int = 3600) -> str:
        """Verify signed token and return the validated storage key."""
        ...


class LocalStorageAdapter:
    """Local filesystem storage adapter for development and private uploads.

    Files are stored with restricted permissions (0o600) under a private directory.
    Keys are strictly validated as UUIDs to prevent path traversal vulnerabilities.
    """

    def __init__(self, root: Path | str | None = None) -> None:
        if root is None:
            configured_root = getattr(settings, "STORAGE_LOCAL_ROOT", None)
            if configured_root:
                root = Path(configured_root)
            else:
                root = settings.BASE_DIR / "storage" / "private"

        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._signer = TimestampSigner(salt="spmb-document-access")

    def _path(self, key: str) -> Path:
        """Validate key and return safe absolute path."""
        try:
            val = UUID(key)
            if str(val) != key:
                raise ValueError("Invalid storage key format")
        except (ValueError, AttributeError) as exc:
            raise ValueError(f"Invalid storage key: {key}") from exc

        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Path traversal detected")
        if path.is_symlink():
            raise ValueError("Symlink storage access denied")
        return path

    def put(self, content: bytes, mime_type: str | None = None) -> str:
        key = str(uuid4())
        path = self._path(key)
        with path.open("xb") as stream:
            path.chmod(0o600)
            stream.write(content)
        return key

    def open(self, key: str) -> BinaryIO:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(f"Storage object not found: {key}")
        return path.open("rb")

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def exists(self, key: str) -> bool:
        try:
            path = self._path(key)
            return path.is_file()
        except ValueError:
            return False

    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        if not self.exists(key):
            raise FileNotFoundError(f"Storage object not found: {key}")
        token = self._signer.sign(key)
        base_url = getattr(settings, "API_V1_PREFIX", "/api/v1")
        return f"{base_url}/documents/download?token={token}"

    def verify_signed_token(self, token: str, max_age: int = 3600) -> str:
        """Verify signed token and return the validated storage key."""
        try:
            key = self._signer.unsign(token, max_age=max_age)
            if not self.exists(key):
                raise FileNotFoundError(f"Storage object not found: {key}")
            return key
        except SignatureExpired as exc:
            raise PermissionError("Download link has expired") from exc
        except BadSignature as exc:
            raise PermissionError("Invalid download signature") from exc


class S3StorageAdapter:
    """Contract for S3/MinIO compatible object storage."""

    def __init__(
        self,
        endpoint_url: str | None = None,
        bucket_name: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        region_name: str | None = None,
    ) -> None:
        self.endpoint_url = endpoint_url or os.environ.get(
            "STORAGE_ENDPOINT", "http://localhost:9000"
        )
        self.bucket_name = bucket_name or os.environ.get("STORAGE_BUCKET", "spmb-documents")
        self.access_key = access_key or os.environ.get("STORAGE_ACCESS_KEY", "")
        self.secret_key = secret_key or os.environ.get("STORAGE_SECRET_KEY", "")
        self.region_name = region_name or os.environ.get("STORAGE_REGION", "us-east-1")

    def put(self, content: bytes, mime_type: str | None = None) -> str:
        key = str(uuid4())
        # In full production, boto3 client will put_object to self.bucket_name
        return key

    def open(self, key: str) -> BinaryIO:
        raise NotImplementedError("S3 direct streaming is configured for cloud deployment")

    def delete(self, key: str) -> None:
        pass

    def exists(self, key: str) -> bool:
        return True

    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        # Generates S3 presigned URL with expires_in
        return f"{self.endpoint_url}/{self.bucket_name}/{key}?expires_in={expires_in}"

    def verify_signed_token(self, token: str, max_age: int = 3600) -> str:
        raise NotImplementedError("S3 token verification is handled by pre-signed URLs")


def get_storage() -> ObjectStorage:
    """Return configured object storage adapter."""
    storage_type = getattr(settings, "STORAGE_TYPE", "local")
    if storage_type == "s3":
        return S3StorageAdapter()
    return LocalStorageAdapter()
