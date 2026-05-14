import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Runtime configuration used by alert and handler modules."""

    # Class attributes are kept for backward compatibility with existing imports.
    ALERT_API_KEY = os.environ.get("ALERT_API_KEY", "").strip()
    DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
    AGENT_ADK_BASE_URL = os.environ.get("AGENT_ADK_BASE_URL", "").strip()
    AGENT_APP_NAME = os.environ.get("AGENT_APP_NAME", "").strip()
    AGENT_ADK_USER_ID = os.environ.get("AGENT_ADK_USER_ID", "user").strip() or "user"

    def __init__(self) -> None:
        # Shared secret used by POST /api/alerts.
        self.ALERT_API_KEY = os.environ.get("ALERT_API_KEY", "").strip()

        # Full SQLAlchemy database URL (for example: sqlite:///bot.db).
        self.DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

        # ADK chat integration used for Teams message responses.
        self.AGENT_ADK_BASE_URL = os.environ.get("AGENT_ADK_BASE_URL", "").strip()
        self.AGENT_APP_NAME = os.environ.get("AGENT_APP_NAME", "").strip()
        self.AGENT_ADK_USER_ID = (
            os.environ.get("AGENT_ADK_USER_ID", "user").strip() or "user"
        )

    def validate_startup(self) -> None:
        """Fail fast on invalid runtime configuration."""
        required_values = {
            "DATABASE_URL": self.DATABASE_URL,
            "ALERT_API_KEY": self.ALERT_API_KEY,
        }
        missing_required = [key for key, value in required_values.items() if not value]
        if missing_required:
            missing = ", ".join(sorted(missing_required))
            raise RuntimeError(f"Missing required environment variable(s): {missing}")

        has_adk_base_url = bool(self.AGENT_ADK_BASE_URL)
        has_app_name = bool(self.AGENT_APP_NAME)
        if has_adk_base_url != has_app_name:
            raise RuntimeError(
                "AGENT_ADK_BASE_URL and AGENT_APP_NAME must both be set, or both be empty."
            )


@lru_cache(maxsize=1)
def get_config() -> Config:
    """Return a cached config instance for the running process."""
    return Config()
