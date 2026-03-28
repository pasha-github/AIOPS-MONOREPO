import logging
import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from database.database import get_session
from main import app

logger = logging.getLogger(__name__)


@pytest.fixture(name="session")
def session_fixture():
    db_url = os.getenv("TEST_MAIN_DATABASE_URL") or "sqlite:///./test.db"
    logger.info(f"[tests] Running on DB: {db_url}")
    is_sqlite = db_url.startswith("sqlite")

    if is_sqlite:
        engine = create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool if db_url == "sqlite://" else None,
        )
    else:
        engine = create_engine(db_url)

    # Ensure test isolation across runs/backends (especially PostgreSQL).
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
