from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_OPERATORS: dict[str, Any] = {
    "eq": lambda a, b: a == b,
    "ne": lambda a, b: a != b,
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "contains": lambda a, b: b in a,
}


def _evaluate_one(condition: dict, status_code: int, body: Any) -> bool:
    ctype = condition.get("type", "")
    op_name = condition.get("operator", "eq")
    op = _OPERATORS.get(op_name)
    if op is None:
        logger.warning("Unknown condition operator %r — skipping (False)", op_name)
        return False

    expected = condition.get("value")

    if ctype == "status_code":
        return op(status_code, expected)

    if ctype == "field":
        if not isinstance(body, dict):
            return False
        actual = body.get(condition.get("field", ""))
        return op(actual, expected)

    if ctype == "jsonpath":
        try:
            from jsonpath_ng import parse  # type: ignore[import-untyped]

            matches = [m.value for m in parse(condition.get("path", "$")).find(body)]
            if not matches:
                return False
            return op(matches[0], expected)
        except Exception as exc:
            logger.warning("JSONPath evaluation failed: %s", exc)
            return False

    logger.warning("Unknown condition type %r — skipping (False)", ctype)
    return False


def evaluate_conditions(
    conditions: list[dict],
    operator: str,
    status_code: int,
    body: Any,
) -> bool:
    """Return True when the condition set passes. Empty list → always True."""
    if not conditions:
        return True
    results = [_evaluate_one(c, status_code, body) for c in conditions]
    if operator.upper() == "OR":
        return any(results)
    return all(results)
