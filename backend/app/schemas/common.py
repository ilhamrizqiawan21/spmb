from typing import Any

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseSchema):
    status: str
    app: str
    version: str
    environment: str


class ReadyResponse(BaseSchema):
    status: str
    database: str
    redis: str


class ErrorDetail(BaseSchema):
    code: str
    message: str
    details: Any = None


class ErrorEnvelope(BaseSchema):
    error: ErrorDetail


class PaginationMeta(BaseSchema):
    total: int
    page: int
    limit: int
    total_pages: int


class PaginatedResponse[T](BaseSchema):
    items: list[T]
    meta: PaginationMeta
