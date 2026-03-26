from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker

from utils.config import get_config

SQLITE_PREFIX = "sqlite:///"


def normalize_database_url(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""

    if value.startswith(SQLITE_PREFIX) and value != "sqlite:///:memory:":
        sqlite_path = Path(value[len(SQLITE_PREFIX) :]).expanduser()
        if not sqlite_path.is_absolute():
            # Keep relative SQLite URLs rooted at the project directory
            # (same behavior as the pre-refactor db.py module location).
            project_root = Path(__file__).resolve().parents[2]
            sqlite_path = project_root / sqlite_path
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        return f"{SQLITE_PREFIX}{sqlite_path.as_posix()}"

    return value


def normalize_database_driver(url: str) -> str:
    """
    Normalize URLs so available drivers in requirements are used by default.

    - mysql://... -> mysql+pymysql://...
    - postgresql://... -> postgresql+psycopg://...
    """
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def resolve_database_url() -> str:
    """
    Resolve active database URL.

    DATABASE_URL must be provided in `.env`.
    """
    env_database_url = (get_config().DATABASE_URL or "").strip()
    if not env_database_url:
        raise RuntimeError(
            "DATABASE_URL is required in .env (example: sqlite:///.alert_storage.sqlite3)."
        )
    return normalize_database_driver(normalize_database_url(env_database_url))


DATABASE_URL = resolve_database_url()

IS_SQLITE = DATABASE_URL.startswith("sqlite:")
connect_args: dict[str, object] = {}
if IS_SQLITE:
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    try:
        from alembic import command
        from alembic.config import Config as AlembicConfig
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Alembic is required for DB initialization. Install dependencies from requirements.txt."
        ) from exc

    project_root = Path(__file__).resolve().parents[2]
    alembic_ini_path = project_root / "alembic.ini"
    migrations_path = project_root / "migrations"

    if not alembic_ini_path.exists():
        raise RuntimeError(f"Missing Alembic config file: {alembic_ini_path}")
    if not migrations_path.exists():
        raise RuntimeError(f"Missing Alembic migrations folder: {migrations_path}")

    alembic_config = AlembicConfig(str(alembic_ini_path))
    alembic_config.set_main_option("prepend_sys_path", str(project_root / "src"))
    alembic_config.set_main_option("script_location", str(migrations_path))

    with engine.begin() as connection:
        alembic_config.attributes["connection"] = connection

        # Bootstrap existing databases created before Alembic by stamping head.
        existing_tables = set(inspect(connection).get_table_names())
        has_version_table = "alembic_version" in existing_tables
        has_core_tables = {"subscriptions", "email_subscriptions"}.issubset(existing_tables)
        if not has_version_table and has_core_tables:
            command.stamp(alembic_config, "head")

        command.upgrade(alembic_config, "head")
