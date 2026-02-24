import os
from sqlmodel import SQLModel, create_engine, Session

MAIN_SERVER_DATABASE_URL = os.getenv("MAIN_SERVER_DATABASE_URL", "sqlite:///agent_management.db")

connect_args = {"check_same_thread": False} if MAIN_SERVER_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(MAIN_SERVER_DATABASE_URL, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
