"""
Pruebas contra PostgreSQL real: la base `build_test` (`TEST_DATABASE_URL` la cambia). Las tablas se
crean una vez por sesión y se vacían antes de cada prueba.
"""
import os
from datetime import date

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/build_test"
)
os.environ["INVITE_CODE"] = "amigos-2026"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.auth import code_login  # noqa: E402
from app.modules.goals import service  # noqa: E402

INVITE = "amigos-2026"


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE work_hours, goal_checks, goals, users RESTART IDENTITY CASCADE"))
    code_login.ghosts.clear()
    yield


@pytest.fixture
def today(monkeypatch):
    """Fija «hoy» de los objetivos: `today.set(date(...))`."""

    class _Today:
        value = date(2026, 11, 15)

        def set(self, value: date) -> None:
            self.value = value

    holder = _Today()
    monkeypatch.setattr(service, "today", lambda: holder.value)
    return holder


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client, username="luz", code="Ab12-!", name="Luz"):
    return client.post(
        "/api/auth/register",
        json={"invite_code": INVITE, "name": name, "username": username, "access_code": code},
    )


@pytest.fixture
def user_client(client):
    """Un cliente con sesión de «luz»."""
    assert register(client).status_code == 201
    return client
