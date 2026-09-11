from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.designer.schemas import (
    ALLOWED_LOGIC,
    ALLOWED_OPERATORS,
    ALLOWED_RULE_TYPES,
    ALLOWED_VALUE_TYPES,
    ARITH_EXPR_RE,
    AGG_EXPR_RE,
    DESIGNER_FIELD_REGISTRY,
    EXPR_RE,
    FORMAT_EXPR_RE,
    ComputeRuleItem,
    ComputeRulesConfig,
    ConditionItem,
    DesignerError,
    QueryConditionsConfig,
)
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigUpsert


def _check_value_type(item: ConditionItem) -> None:
    vt = item.value_type
    if vt not in ALLOWED_VALUE_TYPES:
        raise DesignerError("DESIGN_INVALID_VALUE_TYPE", f"Unknown value type: {vt}", 422)
    val = item.value
    if item.operator in ("is_null", "is_not_null"):
        return
    if item.operator in ("in", "not_in") and vt != "array":
        raise DesignerError(
            "DESIGN_VALUE_TYPE_MISMATCH",
            "Operator in/not_in requires valueType=array",
            422,
        )
    if vt == "string" and not isinstance(val, str):
        raise DesignerError("DESIGN_VALUE_TYPE_MISMATCH", "Value does not match valueType", 422)
    if vt == "number" and (not isinstance(val, (int, float)) or isinstance(val, bool)):
        raise DesignerError("DESIGN_VALUE_TYPE_MISMATCH", "Value does not match valueType", 422)
    if vt == "boolean" and not isinstance(val, bool):
        raise DesignerError("DESIGN_VALUE_TYPE_MISMATCH", "Value does not match valueType", 422)
    if vt == "date" and not isinstance(val, str):
        raise DesignerError("DESIGN_VALUE_TYPE_MISMATCH", "Value does not match valueType", 422)
    if vt == "array" and not isinstance(val, list):
        raise DesignerError("DESIGN_VALUE_TYPE_MISMATCH", "Value does not match valueType", 422)


def validate_conditions_config(config: QueryConditionsConfig) -> QueryConditionsConfig:
    if config.logic not in ALLOWED_LOGIC:
        raise DesignerError(
            "DESIGN_INVALID_LOGIC",
            f"Unknown logic: {config.logic}",
            422,
            fields=[{"field": "logic", "message": f"unknown logic {config.logic}"}],
        )
    if not config.conditions:
        raise DesignerError(
            "DESIGN_EMPTY_CONDITIONS",
            "At least one condition is required",
            422,
            fields=[{"field": "conditions", "message": "must not be empty"}],
        )
    field_ids = {c.field_id for c in config.conditions}
    for idx, item in enumerate(config.conditions):
        prefix = f"conditions[{idx}]"
        if item.field_id not in DESIGNER_FIELD_REGISTRY:
            raise DesignerError(
                "DESIGN_UNKNOWN_FIELD",
                "Unknown field in condition",
                422,
                fields=[
                    {
                        "field": f"{prefix}.fieldId",
                        "message": f"{item.field_id} is not a registered field",
                    }
                ],
            )
        if item.operator not in ALLOWED_OPERATORS:
            raise DesignerError(
                "DESIGN_INVALID_OPERATOR",
                f"Unknown operator: {item.operator}",
                422,
                fields=[
                    {"field": f"{prefix}.operator", "message": f"unknown operator {item.operator}"}
                ],
            )
        try:
            _check_value_type(item)
        except DesignerError as exc:
            exc.fields = [{"field": f"{prefix}.value", "message": exc.message}]
            raise
        if isinstance(item.value, str) and item.value in field_ids and item.value != item.field_id:
            raise DesignerError(
                "DESIGN_INVALID_CROSS_FIELD",
                "Cross-field reference is not allowed",
                422,
                fields=[
                    {"field": f"{prefix}.value", "message": "cannot reference another fieldId"}
                ],
            )
        if isinstance(item.value, str) and item.value == item.field_id:
            raise DesignerError(
                "DESIGN_INVALID_CROSS_FIELD",
                "Field cannot reference itself",
                422,
                fields=[{"field": f"{prefix}.value", "message": "self-reference not allowed"}],
            )
    return config


def detect_rule_cycle(rules: list[ComputeRuleItem]) -> None:
    graph = {r.id: set(r.depends_on) for r in rules}
    visiting: set[str] = set()
    visited: set[str] = set()

    def dfs(node: str) -> None:
        if node in visiting:
            raise DesignerError("DESIGN_RULE_CYCLE", "Circular rule dependency", 422)
        if node in visited:
            return
        visiting.add(node)
        for dep in graph.get(node, ()):
            if dep in graph:
                dfs(dep)
        visiting.remove(node)
        visited.add(node)

    for rule_id in graph:
        dfs(rule_id)


def _expression_matches_rule_type(rule: ComputeRuleItem) -> bool:
    expr = rule.expression
    rt = rule.rule_type
    if rt in ("sum", "avg"):
        return bool(AGG_EXPR_RE.match(expr)) and expr.startswith(f"{rt}(")
    if rt in ("add", "sub", "mul", "div"):
        return bool(ARITH_EXPR_RE.match(expr))
    if rt == "format":
        return bool(FORMAT_EXPR_RE.match(expr))
    return False


def validate_compute_rules_config(config: ComputeRulesConfig) -> ComputeRulesConfig:
    if not config.rules:
        raise DesignerError(
            "DESIGN_EMPTY_RULES",
            "At least one rule is required",
            422,
            fields=[{"field": "rules", "message": "must not be empty"}],
        )
    rule_ids = {r.id for r in config.rules}
    for idx, rule in enumerate(config.rules):
        prefix = f"rules[{idx}]"
        if rule.rule_type not in ALLOWED_RULE_TYPES:
            raise DesignerError(
                "DESIGN_INVALID_RULE_TYPE",
                f"Unknown rule type: {rule.rule_type}",
                422,
                fields=[
                    {"field": f"{prefix}.ruleType", "message": f"unknown rule type {rule.rule_type}"}
                ],
            )
        if rule.target_field not in DESIGNER_FIELD_REGISTRY:
            raise DesignerError(
                "DESIGN_UNKNOWN_TARGET_FIELD",
                "Unknown target field",
                422,
                fields=[
                    {
                        "field": f"{prefix}.targetField",
                        "message": f"{rule.target_field} is not a registered field",
                    }
                ],
            )
        if rule.expression.startswith("median(") or rule.expression.startswith("min("):
            raise DesignerError(
                "DESIGN_INVALID_AGGREGATE",
                "Aggregate function not allowed",
                422,
                fields=[{"field": f"{prefix}.expression", "message": "unsupported aggregate"}],
            )
        if not _expression_matches_rule_type(rule):
            if not EXPR_RE.match(rule.expression) and not FORMAT_EXPR_RE.match(rule.expression):
                raise DesignerError(
                    "DESIGN_INVALID_EXPRESSION",
                    "Expression is not allowed",
                    422,
                    fields=[{"field": f"{prefix}.expression", "message": "expression not allowed"}],
                )
            raise DesignerError(
                "DESIGN_RULE_TYPE_MISMATCH",
                "ruleType does not match expression",
                422,
                fields=[
                    {
                        "field": f"{prefix}.expression",
                        "message": f"does not match ruleType {rule.rule_type}",
                    }
                ],
            )
        for j, dep in enumerate(rule.depends_on):
            if dep not in rule_ids:
                raise DesignerError(
                    "DESIGN_RULE_BROKEN_CHAIN",
                    "Broken rule dependency",
                    422,
                    fields=[
                        {
                            "field": f"{prefix}.dependsOn[{j}]",
                            "message": f"unknown rule id {dep}",
                        }
                    ],
                )
    detect_rule_cycle(config.rules)
    return config


def _conditions_payload(config: QueryConditionsConfig) -> dict:
    return {
        "schemaVersion": config.schema_version,
        "logic": config.logic,
        "conditions": [c.model_dump(by_alias=True) for c in config.conditions],
    }


def _rules_payload(config: ComputeRulesConfig) -> dict:
    return {
        "schemaVersion": config.schema_version,
        "rules": [r.model_dump(by_alias=True) for r in config.rules],
    }


def save_conditions(session: Session, config: QueryConditionsConfig, owner_id: uuid.UUID | None = None):
    validate_conditions_config(config)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="query_conditions",
            schema_version=config.schema_version,
            ref_type=config.ref_type,
            ref_id=config.ref_id,
            payload=_conditions_payload(config),
            expected_revision=config.expected_revision,
        ),
        owner_id=owner_id,
    )
    return config, record


def get_conditions(session: Session, ref_type: str, ref_id: uuid.UUID) -> QueryConditionsConfig:
    record = config_store.get_config_by_ref(session, "query_conditions", ref_type, ref_id)
    payload = record.payload
    return QueryConditionsConfig(
        schema_version=payload.get("schemaVersion", "1.0"),
        logic=payload["logic"],
        conditions=[ConditionItem.model_validate(c) for c in payload["conditions"]],
        ref_type=ref_type,
        ref_id=ref_id,
    )


def save_compute_rules(session: Session, config: ComputeRulesConfig, owner_id: uuid.UUID | None = None):
    validate_compute_rules_config(config)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="compute_rules",
            schema_version=config.schema_version,
            ref_type=config.ref_type,
            ref_id=config.ref_id,
            payload=_rules_payload(config),
        ),
        owner_id=owner_id,
    )
    return config, record


def get_compute_rules(session: Session, ref_type: str, ref_id: uuid.UUID) -> ComputeRulesConfig:
    record = config_store.get_config_by_ref(session, "compute_rules", ref_type, ref_id)
    payload = record.payload
    return ComputeRulesConfig(
        schema_version=payload.get("schemaVersion", "1.0"),
        rules=[ComputeRuleItem.model_validate(r) for r in payload["rules"]],
        ref_type=ref_type,
        ref_id=ref_id,
    )


# DESIGN-001 preview translate (r245) — re-export from preview module
from app.designer import preview as designer_preview  # noqa: E402

build_preview_translate_request = designer_preview.build_preview_translate_request
list_designer_fields = designer_preview.list_designer_fields
preview_translate_sql = designer_preview.preview_translate_sql
probe_preview_translate_budget_ms = designer_preview.probe_preview_translate_budget_ms
