"""
Unit tests for src/agent_runtime/model_stack.py — resolve_model_stack().

Covers:
- Primary model resolution: local vs global
- Secondary/tertiary fallback chain
- Missing model IDs return None (not crash)
- No ModelDefaults row — graceful fallback
- Global flag picks defaults, not local model_id
- Fallback list excludes None slots
"""

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from src.database.models import Agent, Model, ModelDefaults


@pytest.fixture()
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def _make_model(
    session: Session, model_id: str, provider: str = "google", name: str = "gemini"
) -> Model:
    m = Model(
        model_id=model_id, provider=provider, name=name, api_key="key", description=""
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def _make_agent(
    session: Session,
    agent_id: str = "a1",
    primary_use_global: bool = False,
    primary_model_id: str | None = None,
    secondary_use_global: bool = False,
    secondary_model_id: str | None = None,
    tertiary_use_global: bool = False,
    tertiary_model_id: str | None = None,
) -> Agent:
    a = Agent(
        agent_id=agent_id,
        name="Agent",
        description="",
        primary_use_global=primary_use_global,
        primary_model_id=primary_model_id,
        secondary_use_global=secondary_use_global,
        secondary_model_id=secondary_model_id,
        tertiary_use_global=tertiary_use_global,
        tertiary_model_id=tertiary_model_id,
        isEnabled=True,
    )
    session.add(a)
    session.commit()
    session.refresh(a)
    return a


def _make_defaults(
    session: Session,
    primary: str | None = None,
    secondary: str | None = None,
    tertiary: str | None = None,
) -> ModelDefaults:
    d = ModelDefaults(
        id=1,
        primary_model_id=primary,
        secondary_model_id=secondary,
        tertiary_model_id=tertiary,
    )
    session.add(d)
    session.commit()
    return d


# ---------------------------------------------------------------------------
# Primary model — local
# ---------------------------------------------------------------------------


def test_primary_local_model_resolved(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    agent = _make_agent(session, primary_model_id="m1", primary_use_global=False)

    primary, fallbacks = resolve_model_stack(session, agent)

    assert primary is not None
    assert primary.model_id == "m1"
    assert fallbacks == []


def test_primary_local_model_not_in_db_returns_none(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    agent = _make_agent(
        session, primary_model_id="nonexistent", primary_use_global=False
    )

    primary, _ = resolve_model_stack(session, agent)

    assert primary is None


def test_primary_none_model_id_returns_none(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    agent = _make_agent(session, primary_model_id=None, primary_use_global=False)

    primary, _ = resolve_model_stack(session, agent)

    assert primary is None


# ---------------------------------------------------------------------------
# Primary model — global flag picks defaults, NOT local model_id
# ---------------------------------------------------------------------------


def test_primary_global_flag_uses_defaults_not_local(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "global-m")
    _make_model(session, "local-m")
    _make_defaults(session, primary="global-m")
    # Agent has a local model_id set, but use_global=True — must ignore it
    agent = _make_agent(session, primary_model_id="local-m", primary_use_global=True)

    primary, _ = resolve_model_stack(session, agent)

    assert primary is not None
    assert primary.model_id == "global-m"


def test_primary_global_flag_no_defaults_row_returns_none(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    # No ModelDefaults row in DB
    agent = _make_agent(session, primary_model_id="m1", primary_use_global=True)

    primary, _ = resolve_model_stack(session, agent)

    assert primary is None


def test_primary_global_defaults_model_not_in_db_returns_none(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_defaults(session, primary="missing-model")
    agent = _make_agent(session, primary_use_global=True)

    primary, _ = resolve_model_stack(session, agent)

    assert primary is None


# ---------------------------------------------------------------------------
# Fallback chain
# ---------------------------------------------------------------------------


def test_secondary_included_in_fallbacks(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "m2")
    agent = _make_agent(
        session,
        primary_model_id="m1",
        secondary_model_id="m2",
        secondary_use_global=False,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert len(fallbacks) == 1
    assert fallbacks[0].model_id == "m2"


def test_tertiary_included_in_fallbacks(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "m2")
    _make_model(session, "m3")
    agent = _make_agent(
        session,
        primary_model_id="m1",
        secondary_model_id="m2",
        secondary_use_global=False,
        tertiary_model_id="m3",
        tertiary_use_global=False,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert len(fallbacks) == 2
    assert fallbacks[0].model_id == "m2"
    assert fallbacks[1].model_id == "m3"


def test_fallback_order_secondary_before_tertiary(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "secondary")
    _make_model(session, "tertiary")
    agent = _make_agent(
        session,
        primary_model_id="m1",
        secondary_model_id="secondary",
        secondary_use_global=False,
        tertiary_model_id="tertiary",
        tertiary_use_global=False,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert fallbacks[0].model_id == "secondary"
    assert fallbacks[1].model_id == "tertiary"


def test_none_secondary_excluded_from_fallbacks(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "m3")
    # secondary is None — only tertiary should be in fallbacks
    agent = _make_agent(
        session,
        primary_model_id="m1",
        secondary_model_id=None,
        secondary_use_global=False,
        tertiary_model_id="m3",
        tertiary_use_global=False,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert len(fallbacks) == 1
    assert fallbacks[0].model_id == "m3"


def test_none_tertiary_excluded_from_fallbacks(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "m2")
    agent = _make_agent(
        session,
        primary_model_id="m1",
        secondary_model_id="m2",
        secondary_use_global=False,
        tertiary_model_id=None,
        tertiary_use_global=False,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert len(fallbacks) == 1
    assert fallbacks[0].model_id == "m2"


def test_all_slots_none_returns_empty_fallbacks(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    agent = _make_agent(session)

    primary, fallbacks = resolve_model_stack(session, agent)

    assert primary is None
    assert fallbacks == []


# ---------------------------------------------------------------------------
# Global fallback slots
# ---------------------------------------------------------------------------


def test_secondary_global_uses_defaults(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "global-sec")
    _make_defaults(session, secondary="global-sec")
    agent = _make_agent(
        session,
        primary_model_id="m1",
        secondary_use_global=True,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert len(fallbacks) == 1
    assert fallbacks[0].model_id == "global-sec"


def test_tertiary_global_uses_defaults(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "m1")
    _make_model(session, "global-tert")
    _make_defaults(session, tertiary="global-tert")
    agent = _make_agent(
        session,
        primary_model_id="m1",
        tertiary_use_global=True,
    )

    _, fallbacks = resolve_model_stack(session, agent)

    assert len(fallbacks) == 1
    assert fallbacks[0].model_id == "global-tert"


def test_all_slots_global_all_resolved_from_defaults(session: Session):
    from src.agent_runtime.model_stack import resolve_model_stack

    _make_model(session, "gp")
    _make_model(session, "gs")
    _make_model(session, "gt")
    _make_defaults(session, primary="gp", secondary="gs", tertiary="gt")
    agent = _make_agent(
        session,
        primary_use_global=True,
        secondary_use_global=True,
        tertiary_use_global=True,
    )

    primary, fallbacks = resolve_model_stack(session, agent)

    assert primary.model_id == "gp"
    assert [f.model_id for f in fallbacks] == ["gs", "gt"]
