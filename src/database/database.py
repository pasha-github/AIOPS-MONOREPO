from sqlmodel import Session, SQLModel, create_engine

from src.utils.constants import MAIN_SERVER_DATABASE_URL

connect_args = (
    {"check_same_thread": False}
    if MAIN_SERVER_DATABASE_URL.startswith("sqlite")
    else {}
)
# TODO: Add support for async database.
engine = create_engine(MAIN_SERVER_DATABASE_URL, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
