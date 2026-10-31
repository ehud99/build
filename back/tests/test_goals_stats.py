"""Estadísticas del Dashboard (docs/contrato-dashboard.md): `/api/goals/stats` y `/api/goals/heatmap`.

Las marcas y horas de días pasados no se pueden poner por la API (solo hoy), así que se siembran
directo en la base. «Hoy» por defecto: domingo 15 de noviembre de 2026 (el 1 también es domingo).
"""
from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Goal, GoalCheck, User, WorkHours
from tests.conftest import register


def seed_goal(username, month, title, days, position=0):
    """Crea el objetivo de `username` con marcas en `days` (números del mes)."""
    year, mon = int(month[:4]), int(month[5:])
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).one()
        goal = Goal(user_id=user.id, month=month, title=title, position=position)
        goal.checks = [GoalCheck(day=date(year, mon, d)) for d in days]
        db.add(goal)
        db.commit()
        return goal.id


def seed_hours(username, values):
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).one()
        for day, hours in values.items():
            db.add(WorkHours(user_id=user.id, day=day, hours=Decimal(hours)))
        db.commit()


def november(username="luz"):
    a = seed_goal(username, "2026-11", "Leer", range(1, 16), 0)
    b = seed_goal(username, "2026-11", "Correr", [1, 2, 3, 10], 1)
    return a, b


def test_needs_session(client):
    assert client.get("/api/goals/stats").status_code == 401
    assert client.get("/api/goals/heatmap").status_code == 401


def test_validation(user_client, today):
    r = user_client.get("/api/goals/stats", params={"month": "2026-13"})
    assert r.status_code == 422 and r.json()["detail"]["field"] == "month"
    r = user_client.get("/api/goals/heatmap", params={"year": 1999})
    assert r.status_code == 422 and r.json()["detail"]["field"] == "year"


def test_empty_month(user_client, today):
    s = user_client.get("/api/goals/stats").json()
    assert s["month"] == "2026-11"
    assert s["today"] == "2026-11-15"
    assert (s["days_in_month"], s["elapsed_days"], s["goals_count"]) == (30, 15, 0)
    assert (s["score"], s["max_score"], s["possible"], s["commitment"]) == (0, 0, 0, None)
    assert s["commitment_delta"] is None
    assert s["goals"] == [] and s["best_goal_id"] is None and s["worst_goal_id"] is None
    assert s["streaks"] == {"active": 0, "best_current": 0, "best": None}
    assert len(s["daily"]) == 30 and all(d["score"] == 0 for d in s["daily"])
    assert [w["percent"] for w in s["weekdays"]] == [None] * 7
    assert s["hours"]["total"] == "0" and s["hours"]["average"] is None
    assert s["hours"]["worked_days"] == 0


def test_commitment_and_previous_month(user_client, today):
    november()
    seed_goal("luz", "2026-10", "Leer", range(1, 21))
    s = user_client.get("/api/goals/stats", params={"month": "2026-11"}).json()
    # 15 + 4 marcas de 2 objetivos × 15 días transcurridos.
    assert (s["score"], s["max_score"], s["possible"]) == (19, 60, 30)
    assert s["commitment"] == "63.3"
    prev = s["previous"]
    assert prev["month"] == "2026-10"
    assert (prev["elapsed_days"], prev["score"], prev["possible"], prev["commitment"]) == (31, 20, 31, "64.5")
    assert s["commitment_delta"] == "-1.2"


def test_daily_and_weekdays(user_client, today):
    november()
    s = user_client.get("/api/goals/stats").json()
    daily = {d["day"]: d for d in s["daily"]}
    assert (daily[1]["score"], daily[4]["score"], daily[10]["score"], daily[16]["score"]) == (2, 1, 2, 0)
    assert daily[15]["elapsed"] is True and daily[16]["elapsed"] is False
    week = {w["weekday"]: w for w in s["weekdays"]}
    # Domingos 1, 8 y 15: Leer los 3, Correr el 1.
    assert (week[6]["done"], week[6]["possible"], week[6]["percent"]) == (4, 6, "66.7")
    # Lunes 2 y 9: Leer los 2, Correr el 2.
    assert (week[0]["done"], week[0]["possible"], week[0]["percent"]) == (3, 4, "75.0")
    assert sum(w["possible"] for w in s["weekdays"]) == 30


def test_goals_and_streaks(user_client, today):
    a, b = november()
    s = user_client.get("/api/goals/stats").json()
    goals = {g["id"]: g for g in s["goals"]}
    assert [g["title"] for g in s["goals"]] == ["Leer", "Correr"]
    assert goals[a] | {} == {
        "id": a,
        "title": "Leer",
        "position": 0,
        "done": 15,
        "possible": 15,
        "percent": "100.0",
        "current_streak": 15,
        "best_streak": 15,
        "full_month": False,
    }
    assert (goals[b]["percent"], goals[b]["current_streak"], goals[b]["best_streak"]) == ("26.7", 0, 3)
    assert (s["best_goal_id"], s["worst_goal_id"]) == (a, b)
    assert s["streaks"] == {"active": 1, "best_current": 15, "best": {"goal_id": a, "title": "Leer", "days": 15}}


def test_current_streak_ends_yesterday(user_client, today):
    goal = seed_goal("luz", "2026-11", "Meditar", [12, 13, 14])
    s = user_client.get("/api/goals/stats").json()
    assert s["goals"][0]["current_streak"] == 3
    assert s["streaks"]["active"] == 1
    # Un solo objetivo: no hay «más» ni «menos» cumplido.
    assert s["best_goal_id"] is None and s["worst_goal_id"] is None
    # Dos días sin marcar cortan la racha viva, pero la mejor sigue.
    today.set(date(2026, 11, 16))
    g = user_client.get("/api/goals/stats").json()["goals"][0]
    assert (g["id"], g["current_streak"], g["best_streak"]) == (goal, 0, 3)


def test_tied_goals_have_no_best_or_worst(user_client, today):
    seed_goal("luz", "2026-11", "A", [1, 2], 0)
    seed_goal("luz", "2026-11", "B", [3, 4], 1)
    s = user_client.get("/api/goals/stats").json()
    assert s["best_goal_id"] is None and s["worst_goal_id"] is None


def test_past_month_full(user_client, today):
    seed_goal("luz", "2026-10", "Leer", range(1, 32), 0)
    seed_goal("luz", "2026-10", "Correr", [30, 31], 1)
    s = user_client.get("/api/goals/stats", params={"month": "2026-10"}).json()
    assert (s["elapsed_days"], s["possible"], s["score"], s["commitment"]) == (31, 62, 33, "53.2")
    full, other = s["goals"]
    assert full["full_month"] is True and full["best_streak"] == 31
    # Un mes pasado no tiene racha viva.
    assert full["current_streak"] == 0 and other["current_streak"] == 0
    assert s["streaks"]["active"] == 0
    assert s["streaks"]["best"]["days"] == 31
    assert s["previous"]["month"] == "2026-09" and s["previous"]["commitment"] is None
    assert s["commitment_delta"] is None


def test_future_month(user_client, today):
    november()
    seed_goal("luz", "2026-12", "Ahorrar", [])
    s = user_client.get("/api/goals/stats", params={"month": "2026-12"}).json()
    assert (s["elapsed_days"], s["goals_count"], s["possible"], s["max_score"]) == (0, 1, 0, 31)
    assert s["commitment"] is None and s["commitment_delta"] is None
    assert s["previous"]["commitment"] == "63.3"
    assert all(not d["elapsed"] for d in s["daily"])
    assert s["goals"][0]["percent"] is None


def test_hours_weeks_and_average(user_client, today):
    seed_hours(
        "luz",
        {
            date(2026, 11, 2): "8",
            date(2026, 11, 3): "7.5",
            date(2026, 11, 9): "4",
            date(2026, 11, 15): "0.5",
            date(2026, 10, 31): "9",  # otro mes
        },
    )
    h = user_client.get("/api/goals/stats").json()["hours"]
    assert (h["total"], h["worked_days"], h["average"]) == ("20", 4, "5")
    daily = {d["day"]: d["hours"] for d in h["daily"]}
    assert len(daily) == 30 and (daily[1], daily[2], daily[3]) == ("0", "8", "7.5")
    # Semanas de lunes a domingo, recortadas al mes (el 1 es domingo; el 30, lunes).
    assert [(w["start_day"], w["end_day"]) for w in h["weeks"]] == [
        (1, 1), (2, 8), (9, 15), (16, 22), (23, 29), (30, 30),
    ]
    assert [w["hours"] for w in h["weeks"]] == ["0", "15.5", "4.5", "0", "0", "0"]
    assert [w["worked_days"] for w in h["weeks"]] == [0, 2, 2, 0, 0, 0]
    assert (h["weeks"][1]["from"], h["weeks"][1]["to"]) == ("2026-11-02", "2026-11-08")


def test_hours_average_rounds(user_client, today):
    seed_hours("luz", {date(2026, 11, 1): "1", date(2026, 11, 2): "1", date(2026, 11, 3): "0.5"})
    h = user_client.get("/api/goals/stats").json()["hours"]
    assert (h["total"], h["average"]) == ("2.5", "0.8")


def test_heatmap(user_client, today):
    november()
    seed_goal("luz", "2026-10", "Leer", [1, 5])
    seed_goal("luz", "2025-12", "Viejo", [31])
    r = user_client.get("/api/goals/heatmap").json()
    assert (r["year"], r["today"]) == (2026, "2026-11-15")
    days = {d["date"]: d for d in r["days"]}
    # Octubre completo y noviembre hasta hoy; solo meses con objetivos.
    assert len(r["days"]) == 31 + 15
    assert "2026-09-30" not in days and "2026-11-16" not in days
    assert days["2026-10-01"] == {"date": "2026-10-01", "done": 1, "goals": 1}
    assert days["2026-10-02"]["done"] == 0
    assert days["2026-11-01"] == {"date": "2026-11-01", "done": 2, "goals": 2}
    assert days["2026-11-04"]["done"] == 1
    old = user_client.get("/api/goals/heatmap", params={"year": 2025}).json()
    assert [d["date"] for d in old["days"]][0] == "2025-12-01" and len(old["days"]) == 31
    assert user_client.get("/api/goals/heatmap", params={"year": 2027}).json()["days"] == []


def test_isolated_between_users(user_client, today):
    november()
    seed_hours("luz", {date(2026, 11, 2): "8"})
    with TestClient(app) as other:
        assert register(other, username="sol", name="Sol").status_code == 201
        s = other.get("/api/goals/stats").json()
        assert (s["goals_count"], s["score"], s["hours"]["total"]) == (0, 0, "0")
        assert other.get("/api/goals/heatmap").json()["days"] == []
        seed_goal("sol", "2026-11", "Propio", [15])
        assert other.get("/api/goals/stats").json()["score"] == 1
    mine = user_client.get("/api/goals/stats").json()
    assert (mine["goals_count"], mine["score"]) == (2, 19)
