from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import register


def add(client, title, month="2026-11"):
    return client.post("/api/goals", json={"month": month, "title": title})


def test_needs_session(client):
    assert client.get("/api/goals").status_code == 401


def test_month_defaults_to_current(user_client, today):
    r = user_client.get("/api/goals")
    assert r.status_code == 200
    assert r.json() == {
        "month": "2026-11",
        "days_in_month": 30,
        "today": "2026-11-15",
        "editable": True,
        "max_goals": 10,
        "goals": [],
    }


def test_month_validation_and_days(user_client, today):
    assert user_client.get("/api/goals", params={"month": "2026-13"}).status_code == 422
    assert user_client.get("/api/goals", params={"month": "2028-02"}).json()["days_in_month"] == 29
    assert user_client.get("/api/goals", params={"month": "2026-10"}).json()["editable"] is False


def test_create_rename_delete_in_order(user_client, today):
    a = add(user_client, "  Leer   20 min ").json()
    b = add(user_client, "Correr").json()
    assert a["title"] == "Leer 20 min"
    assert (a["position"], b["position"]) == (0, 1)
    r = user_client.patch(f"/api/goals/{a['id']}", json={"title": "Leer 30 min"})
    assert r.json()["title"] == "Leer 30 min"
    assert user_client.delete(f"/api/goals/{b['id']}").status_code == 204
    month = user_client.get("/api/goals").json()
    assert [g["title"] for g in month["goals"]] == ["Leer 30 min"]


def test_title_validation(user_client, today):
    r = add(user_client, "   ")
    assert r.status_code == 422
    assert r.json()["detail"]["field"] == "title"
    assert add(user_client, "x" * 81).status_code == 422


def test_max_ten_per_month(user_client, today):
    for i in range(10):
        assert add(user_client, f"Objetivo {i + 1}").status_code == 201
    r = add(user_client, "Once")
    assert r.status_code == 409
    assert r.json()["error_code"] == "GOAL_LIMIT"
    # Otro mes tiene su propio cupo.
    assert add(user_client, "Diciembre", month="2026-12").status_code == 201


def test_past_month_is_read_only(user_client, today):
    goal = add(user_client, "Leer").json()
    today.set(date(2026, 12, 1))
    for r in (
        add(user_client, "Tarde"),
        user_client.patch(f"/api/goals/{goal['id']}", json={"title": "Otro"}),
        user_client.delete(f"/api/goals/{goal['id']}"),
    ):
        assert r.status_code == 409
        assert r.json()["error_code"] == "MONTH_READ_ONLY"


def test_only_today_can_be_checked(user_client, today):
    goal = add(user_client, "Leer").json()
    r = user_client.put(f"/api/goals/{goal['id']}/checks/15", json={"done": True})
    assert r.status_code == 200
    assert r.json()["checked_days"] == [15]
    # Repetir no duplica.
    assert user_client.put(f"/api/goals/{goal['id']}/checks/15", json={"done": True}).json()["checked_days"] == [15]
    for day in (14, 16):
        r = user_client.put(f"/api/goals/{goal['id']}/checks/{day}", json={"done": True})
        assert r.status_code == 409
        assert r.json()["error_code"] == "DAY_NOT_EDITABLE"
    assert user_client.put(f"/api/goals/{goal['id']}/checks/32", json={"done": True}).status_code == 422
    # Al día siguiente, el 15 queda fijo y se marca el 16.
    today.set(date(2026, 11, 16))
    assert user_client.put(f"/api/goals/{goal['id']}/checks/15", json={"done": False}).status_code == 409
    r = user_client.put(f"/api/goals/{goal['id']}/checks/16", json={"done": True})
    assert r.json()["checked_days"] == [15, 16]
    r = user_client.put(f"/api/goals/{goal['id']}/checks/16", json={"done": False})
    assert r.json()["checked_days"] == [15]


def test_future_month_goal_cannot_be_checked(user_client, today):
    goal = add(user_client, "Leer", month="2026-12").json()
    r = user_client.put(f"/api/goals/{goal['id']}/checks/15", json={"done": True})
    assert r.status_code == 409


def test_copy_previous_month(user_client, today):
    add(user_client, "Leer", month="2026-10")  # el mes pasado no se edita…
    today.set(date(2026, 10, 20))
    add(user_client, "Leer", month="2026-10")
    add(user_client, "Correr", month="2026-10")
    leer = user_client.get("/api/goals", params={"month": "2026-10"}).json()["goals"][0]
    user_client.put(f"/api/goals/{leer['id']}/checks/20", json={"done": True})
    today.set(date(2026, 11, 2))

    r = user_client.post("/api/goals/copy-previous", json={"month": "2026-11"})
    assert r.status_code == 201
    goals = r.json()["goals"]
    assert [g["title"] for g in goals] == ["Leer", "Correr"]
    assert all(g["checked_days"] == [] for g in goals)

    again = user_client.post("/api/goals/copy-previous", json={"month": "2026-11"})
    assert again.status_code == 409
    assert again.json()["error_code"] == "MONTH_NOT_EMPTY"

    empty = user_client.post("/api/goals/copy-previous", json={"month": "2027-01"})
    assert empty.status_code == 404
    assert empty.json()["error_code"] == "NOTHING_TO_COPY"

    # Enero copia de diciembre (cambio de año).
    add(user_client, "Ahorrar", month="2026-12")
    r = user_client.post("/api/goals/copy-previous", json={"month": "2027-01"})
    assert [g["title"] for g in r.json()["goals"]] == ["Ahorrar"]


def test_users_only_see_their_own(user_client, today):
    goal = add(user_client, "Mío").json()
    with TestClient(app) as other:
        assert register(other, username="sol", name="Sol").status_code == 201
        assert other.get("/api/goals").json()["goals"] == []
        for r in (
            other.patch(f"/api/goals/{goal['id']}", json={"title": "Robado"}),
            other.delete(f"/api/goals/{goal['id']}"),
            other.put(f"/api/goals/{goal['id']}/checks/15", json={"done": True}),
        ):
            assert r.status_code == 404
            assert r.json()["error_code"] == "GOAL_NOT_FOUND"
