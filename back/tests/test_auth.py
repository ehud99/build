from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import User
from tests.conftest import INVITE, register


def login(client, username="luz", code="Ab12-!"):
    return client.post("/api/auth/login", json={"username": username, "access_code": code})


def test_register_sets_session_and_normalizes(client):
    r = register(client, username="@Luz.M", name="  Luz   María ")
    assert r.status_code == 201
    assert r.json()["user"]["username"] == "luz.m"
    assert r.json()["user"]["name"] == "Luz María"
    assert settings.COOKIE_NAME in r.cookies
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["username"] == "luz.m"


def test_register_needs_the_invite(client):
    r = client.post(
        "/api/auth/register",
        json={"invite_code": "otra", "name": "Ana", "username": "ana", "access_code": "123456"},
    )
    assert r.status_code == 403
    assert r.json()["error_code"] == "INVALID_INVITE"


def test_register_closed_without_invite_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "INVITE_CODE", "")
    r = register(client)
    assert r.status_code == 403
    assert r.json()["error_code"] == "REGISTRATION_CLOSED"


def test_register_validates_fields(client):
    bad_code = client.post(
        "/api/auth/register",
        json={"invite_code": INVITE, "name": "Ana", "username": "ana", "access_code": "12 456"},
    )
    assert bad_code.status_code == 422
    assert bad_code.json()["detail"]["field"] == "access_code"
    bad_user = client.post(
        "/api/auth/register",
        json={"invite_code": INVITE, "name": "Ana", "username": "a!", "access_code": "123456"},
    )
    assert bad_user.status_code == 422
    assert bad_user.json()["detail"]["field"] == "username"


def test_register_rejects_taken_username(client):
    assert register(client).status_code == 201
    r = register(client, name="Otra")
    assert r.status_code == 409
    assert r.json()["error_code"] == "USERNAME_TAKEN"


def test_username_available(client):
    register(client)
    assert client.get("/api/auth/username-available", params={"username": "LUZ"}).json() == {"available": False}
    assert client.get("/api/auth/username-available", params={"username": "sol"}).json() == {"available": True}
    assert client.get("/api/auth/username-available", params={"username": "x"}).json() == {"available": False}


def test_login_logout_and_me(client):
    register(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    r = login(client, username="@LUZ")
    assert r.status_code == 200
    assert r.json()["user"]["name"] == "Luz"
    assert client.get("/api/auth/me").status_code == 200


def test_code_is_case_sensitive(client):
    register(client)
    r = login(client, code="aB12-!")
    assert r.status_code == 401


def _sequence(client, username):
    """Códigos de los 8 fallos: (status, error_code, detail) de cada uno."""
    out = []
    for _ in range(8):
        r = login(client, username=username, code="zzzzzz")
        body = r.json()
        out.append((r.status_code, body["error_code"], body.get("detail")))
        # La espera pasa: se adelanta el reloj limpiando el `locked_until`.
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == username).first()
            if user is not None:
                user.login_locked_until = None
                db.commit()
        from app.modules.auth import code_login

        ghost = code_login.ghosts._state.get(username)
        if ghost is not None:
            ghost.login_locked_until = None
    return out


def test_lockout_wait_then_block_same_for_ghost(client):
    register(client)
    client.post("/api/auth/logout")
    real = _sequence(client, "luz")
    ghost = _sequence(client, "nadie")
    assert real == ghost
    assert real[0] == (401, "INVALID_CREDENTIALS", {"attempts_left": 2})
    assert real[1] == (401, "INVALID_CREDENTIALS", {"attempts_left": 1})
    assert real[2] == (429, "LOGIN_WAIT", {"retry_after": 60})
    assert real[6] == (429, "LOGIN_WAIT", {"retry_after": 60})
    assert real[7] == (403, "LOGIN_BLOCKED", None)
    # Bloqueado: ni el código correcto entra.
    r = login(client)
    assert r.status_code == 403


def test_wait_blocks_even_the_right_code(client):
    register(client)
    client.post("/api/auth/logout")
    for _ in range(3):
        login(client, code="zzzzzz")
    r = login(client)
    assert r.status_code == 429
    assert r.json()["error_code"] == "LOGIN_WAIT"
    assert 1 <= r.json()["detail"]["retry_after"] <= 60
    assert r.headers["Retry-After"]


def test_success_resets_the_count(client):
    register(client)
    client.post("/api/auth/logout")
    login(client, code="zzzzzz")
    login(client, code="zzzzzz")
    assert login(client).status_code == 200
    r = login(client, code="zzzzzz")
    assert r.json()["detail"]["attempts_left"] == 2


def test_expired_wait_lets_you_try_again(client):
    register(client)
    client.post("/api/auth/logout")
    for _ in range(3):
        login(client, code="zzzzzz")
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == "luz").first()
        user.login_locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert login(client).status_code == 200


def test_blocked_user_loses_session_and_unlock_script(client, monkeypatch):
    register(client)
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == "luz").first()
        user.login_blocked_at = datetime.now(timezone.utc)
        user.login_failures = 8
        db.commit()
    assert client.get("/api/auth/me").status_code == 401

    from scripts import unlock_user

    monkeypatch.setattr("sys.argv", ["unlock_user", "luz"])
    assert unlock_user.main() == 0
    with TestClient(app) as fresh:
        assert login(fresh).status_code == 200


def test_bad_cookie_is_401(client):
    client.cookies.set(settings.COOKIE_NAME, "basura")
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["error_code"] == "NOT_AUTHENTICATED"
