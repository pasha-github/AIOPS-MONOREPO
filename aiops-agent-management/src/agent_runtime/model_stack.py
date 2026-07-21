from sqlmodel import Session

from src.database.models import Agent, Model, ModelDefaults


def resolve_model_stack(
    session: Session,
    agent_config: Agent,
) -> tuple[Model | None, list[Model]]:
    # Resolve the primary model and optional fallback chain from agent settings
    # or shared defaults.
    defaults = session.get(ModelDefaults, 1)

    def _resolve_slot(
        use_global: bool,
        explicit_model_id: str | None,
        default_model_id: str | None,
    ) -> Model | None:
        model_id = default_model_id if use_global else explicit_model_id
        if model_id is None:
            return None
        return session.get(Model, model_id)

    primary_model = _resolve_slot(
        agent_config.primary_use_global,
        agent_config.primary_model_id,
        defaults.primary_model_id if defaults else None,
    )
    secondary_model = _resolve_slot(
        agent_config.secondary_use_global,
        agent_config.secondary_model_id,
        defaults.secondary_model_id if defaults else None,
    )
    tertiary_model = _resolve_slot(
        agent_config.tertiary_use_global,
        agent_config.tertiary_model_id,
        defaults.tertiary_model_id if defaults else None,
    )
    fallbacks = [
        model for model in (secondary_model, tertiary_model) if model is not None
    ]
    return primary_model, fallbacks
