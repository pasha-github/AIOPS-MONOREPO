import json
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, col, func, select

from src.database.database import get_session
from src.database.models import ObservabilitySpan, ObservabilityTokenUsage

router = APIRouter(prefix="/observability", tags=["observability"])
LLM_MODEL_PRICING_PATH = Path("static/llm_model/pricing.json")
TOKENS_PER_MILLION = 1_000_000
COST_QUANTUM = Decimal("0.000001")


def _to_number(value: str | None) -> int | float | str | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value


def _span_response(span: ObservabilitySpan) -> dict[str, Any]:
    return {
        "name": span.name,
        "span_id": _to_number(span.span_id),
        "trace_id": _to_number(span.trace_id),
        "start_time": span.start_time,
        "end_time": span.end_time,
        "attributes": span.attributes,
        "parent_span_id": _to_number(span.parent_span_id),
    }


def _usage_response(
    *,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
) -> dict[str, int]:
    return {
        "input_tokens": input_tokens or 0,
        "output_tokens": output_tokens or 0,
        "total_tokens": total_tokens or 0,
    }


def _load_llm_model_pricing() -> dict[str, dict[str, float]]:
    if not LLM_MODEL_PRICING_PATH.exists():
        return {}

    with LLM_MODEL_PRICING_PATH.open(encoding="utf-8") as pricing_file:
        pricing = json.load(pricing_file)

    return {
        str(model_id): {
            "input_cost_per_million_tokens": float(
                model_pricing.get("input_cost_per_million_tokens", 0)
            ),
            "output_cost_per_million_tokens": float(
                model_pricing.get("output_cost_per_million_tokens", 0)
            ),
        }
        for model_id, model_pricing in pricing.items()
        if isinstance(model_pricing, dict)
    }


def _normalize_model_id(llm_model: str) -> str:
    if "/" in llm_model:
        return llm_model.rsplit("/", 1)[-1]
    return llm_model


def _pricing_for_model(
    llm_model: str,
    pricing: dict[str, dict[str, float]],
) -> dict[str, float]:
    return (
        pricing.get(llm_model)
        or pricing.get(_normalize_model_id(llm_model))
        or {
            "input_cost_per_million_tokens": 0.0,
            "output_cost_per_million_tokens": 0.0,
        }
    )


def _model_usage_response(
    *,
    llm_model: str,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
    pricing: dict[str, dict[str, float]],
) -> dict[str, Any]:
    usage = _usage_response(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )
    model_pricing = _pricing_for_model(llm_model, pricing)
    input_cost = (
        Decimal(usage["input_tokens"])
        / Decimal(TOKENS_PER_MILLION)
        * Decimal(str(model_pricing["input_cost_per_million_tokens"]))
    )
    output_cost = (
        Decimal(usage["output_tokens"])
        / Decimal(TOKENS_PER_MILLION)
        * Decimal(str(model_pricing["output_cost_per_million_tokens"]))
    )

    return {
        "llm_model": llm_model,
        **usage,
        "input_cost": float(input_cost.quantize(COST_QUANTUM, ROUND_HALF_UP)),
        "output_cost": float(output_cost.quantize(COST_QUANTUM, ROUND_HALF_UP)),
        "total_cost": float(
            (input_cost + output_cost).quantize(COST_QUANTUM, ROUND_HALF_UP)
        ),
        "pricing": model_pricing,
    }


def _sum_usage(session: Session, *conditions) -> dict[str, int]:
    statement = select(
        func.sum(ObservabilityTokenUsage.input_tokens),
        func.sum(ObservabilityTokenUsage.output_tokens),
        func.sum(ObservabilityTokenUsage.total_tokens),
    ).where(*conditions)
    input_tokens, output_tokens, total_tokens = session.exec(statement).one()
    return _usage_response(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )


@router.get("/token-usage/session/{agent_id}/{session_id}")
def get_session_token_usage(
    agent_id: str,
    session_id: str,
    session: Session = Depends(get_session),
):
    usage = _sum_usage(
        session,
        ObservabilityTokenUsage.agent_id == agent_id,
        ObservabilityTokenUsage.session_id == session_id,
    )
    return {"agent_id": agent_id, "session_id": session_id, **usage}


@router.get("/token-usage/agent/{agent_id}")
def get_agent_token_usage(agent_id: str, session: Session = Depends(get_session)):
    usage = _sum_usage(session, ObservabilityTokenUsage.agent_id == agent_id)
    return {"agent_id": agent_id, **usage}


@router.get("/token-usage/agents")
def get_all_agents_token_usage(session: Session = Depends(get_session)):
    statement = (
        select(
            ObservabilityTokenUsage.agent_id,
            func.sum(ObservabilityTokenUsage.input_tokens),
            func.sum(ObservabilityTokenUsage.output_tokens),
            func.sum(ObservabilityTokenUsage.total_tokens),
        )
        .group_by(ObservabilityTokenUsage.agent_id)
        .order_by(ObservabilityTokenUsage.agent_id)
    )
    return [
        {
            "agent_id": agent_id,
            **_usage_response(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
            ),
        }
        for agent_id, input_tokens, output_tokens, total_tokens in session.exec(
            statement
        ).all()
    ]


@router.get("/token-usage/model/{llm_model:path}")
def get_llm_model_token_usage(
    llm_model: str,
    session: Session = Depends(get_session),
):
    usage = _sum_usage(session, ObservabilityTokenUsage.llm_model == llm_model)
    return {"llm_model": llm_model, **usage}


@router.get("/token-usage/models")
def get_all_models_token_usage(
    days: int | None = Query(default=None, ge=1),
    session: Session = Depends(get_session),
):
    conditions = []
    if days is not None:
        conditions.append(
            col(ObservabilityTokenUsage.created_at)
            >= datetime.now() - timedelta(days=days)
        )

    statement = (
        select(
            ObservabilityTokenUsage.llm_model,
            func.sum(ObservabilityTokenUsage.input_tokens),
            func.sum(ObservabilityTokenUsage.output_tokens),
            func.sum(ObservabilityTokenUsage.total_tokens),
        )
        .where(*conditions)
        .group_by(ObservabilityTokenUsage.llm_model)
        .order_by(ObservabilityTokenUsage.llm_model)
    )
    pricing = _load_llm_model_pricing()
    return [
        _model_usage_response(
            llm_model=llm_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            pricing=pricing,
        )
        for llm_model, input_tokens, output_tokens, total_tokens in session.exec(
            statement
        ).all()
    ]


@router.get("/{agent_id}/{session_id}")
def get_observability_spans(
    agent_id: str,
    session_id: str,
    session: Session = Depends(get_session),
):
    spans = session.exec(
        select(ObservabilitySpan)
        .where(
            ObservabilitySpan.agent_id == agent_id,
            ObservabilitySpan.session_id == session_id,
        )
        .order_by(col(ObservabilitySpan.start_time))
    ).all()
    return [_span_response(span) for span in spans]
