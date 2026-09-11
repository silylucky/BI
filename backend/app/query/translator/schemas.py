from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

# L1 translator operators — subset of designer ALLOWED_OPERATORS.
# Designer includes not_in; translator L1 intentionally excludes it (see QUERY-008 PRD).
L1_OPERATORS = frozenset({
    "eq", "ne", "gt", "gte", "lt", "lte", "in", "like", "is_null", "is_not_null",
})
ALLOWED_LOGIC = frozenset({"AND", "OR"})


class TranslateError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 422,
        fields: list[dict[str, str]] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class TranslateConditionItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field_id: str = Field(alias="fieldId", min_length=1)
    operator: str
    value: object | None = None
    value_type: str = Field(default="string", alias="valueType")


class TranslateConditions(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    logic: str
    conditions: list[TranslateConditionItem]


class TranslateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    connector_type: str = Field(alias="connectorType")
    schema_name: str = Field(alias="schema")
    table: str
    columns: list[str] = Field(min_length=1)
    conditions: TranslateConditions | None = None
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)

    @field_validator("columns")
    @classmethod
    def reject_star(cls, cols: list[str]) -> list[str]:
        if any(c.strip() == "*" for c in cols):
            raise ValueError("wildcard * is not allowed in L1")
        return cols


class TranslateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sql: str
    parameters: dict[str, object]
    connector_type: str = Field(alias="connectorType")
