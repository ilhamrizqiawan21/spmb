"""Private object storage contract and local development adapter.

Callers must enforce ownership/permissions before opening a stored object.
The local root must never be mounted as a public static directory.
"""

from pathlib import Path
from typing import BinaryIO, Protocol
from uuid import UUID, uuid4


class ObjectStorage(Protocol):
    """Contract also implementable by an S3-compatible provider."""

    def put(self, content: bytes) -> str: ...

    def open(self, key: str) -> BinaryIO: ...


class LocalObjectStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    def _path(self, key: str) -> Path:
        # Only server-generated opaque identifiers are accepted, never filenames.
        if str(UUID(key)) != key:
            raise ValueError("Invalid storage key")
        path = self.root / key
        if path.is_symlink():
            raise ValueError("Invalid storage object")
        return path

    def put(self, content: bytes) -> str:
        key = str(uuid4())
        path = self._path(key)
        with path.open("xb") as stream:
            path.chmod(0o600)
            stream.write(content)
        return key

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")
