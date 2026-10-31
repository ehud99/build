"""
Estadísticas de los objetivos y las horas para el Dashboard (docs/contrato-dashboard.md).

Todo se calcula aquí, en enteros y `Decimal` (nunca `float`): el compromiso del mes, el mes
anterior, el puntaje por día, por día de la semana y por objetivo, las rachas (con las mismas
reglas que `front/src/modules/goals/score.js`), las horas trabajadas y el mapa de calor del año.

«Días transcurridos» de un mes: el actual, hasta hoy (incluido); uno pasado, todos; uno futuro, 0.
"""
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Goal, GoalCheck, User, WorkHours
from app.modules.goals import service

ONE_DECIMAL = Decimal("0.1")
ACTIVE_STREAK = 2


def _text(value: Optional[Decimal]) -> Optional[str]:
    """`Decimal` con 1 decimal como texto (`'71.0'`), o `None`."""
    return None if value is None else format(value, "f")


def percent(done: int, possible: int) -> Optional[Decimal]:
    """`done / possible` en % con 1 decimal (`ROUND_HALF_UP`); `None` si no hay base."""
    if possible <= 0:
        return None
    return (Decimal(done) * 100 / Decimal(possible)).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP)


def elapsed_days(month: str) -> int:
    now = service.today()
    current = service.month_key(now)
    if month < current:
        return service.days_in_month(month)
    if month > current:
        return 0
    return now.day


def _streaks(days: set[int]) -> dict[int, int]:
    """`{día: racha}`: días seguidos marcados que terminan en ese día (el primero vale 1)."""
    out: dict[int, int] = {}
    for day in sorted(days):
        out[day] = out.get(day - 1, 0) + 1
    return out


def _current_streak(streaks: dict[int, int], today_day: Optional[int]) -> int:
    """La racha viva: la que termina hoy o, si hoy aún no se marcó, ayer. Fuera del mes actual, 0."""
    if not today_day:
        return 0
    return streaks.get(today_day) or streaks.get(today_day - 1) or 0


def _month_goals(db: Session, user: User, month: str) -> list[tuple[Goal, set[int]]]:
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == user.id, Goal.month == month)
        .order_by(Goal.position, Goal.id)
        .all()
    )
    days: dict[int, set[int]] = {g.id: set() for g in goals}
    if goals:
        rows = db.query(GoalCheck.goal_id, GoalCheck.day).filter(GoalCheck.goal_id.in_(days.keys())).all()
        for goal_id, day in rows:
            days[goal_id].add(day.day)
    return [(g, days[g.id]) for g in goals]


def _summary(month: str, goals: list[tuple[Goal, set[int]]]) -> dict:
    """Puntaje, máximo y compromiso de un mes (sobre los días transcurridos)."""
    elapsed = elapsed_days(month)
    count = len(goals)
    score = sum(len({d for d in days if d <= elapsed}) for _, days in goals)
    possible = count * elapsed
    return {
        "month": month,
        "days_in_month": service.days_in_month(month),
        "elapsed_days": elapsed,
        "goals_count": count,
        "score": score,
        "max_score": count * service.days_in_month(month),
        "possible": possible,
        "commitment": percent(score, possible),
    }


def _hours(db: Session, user: User, month: str) -> dict:
    first, last = service._month_range(month)
    rows = (
        db.query(WorkHours.day, WorkHours.hours)
        .filter(WorkHours.user_id == user.id, WorkHours.day >= first, WorkHours.day <= last)
        .all()
    )
    by_day = {day.day: hours for day, hours in rows}
    total = sum(by_day.values(), Decimal("0"))
    worked = len(by_day)
    average = (total / worked).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP) if worked else None

    weeks = []
    start = first
    while start <= last:
        end = min(last, start + timedelta(days=6 - start.weekday()))
        week_days = [d for d in by_day if start.day <= d <= end.day]
        weeks.append(
            {
                "from": start.isoformat(),
                "to": end.isoformat(),
                "start_day": start.day,
                "end_day": end.day,
                "hours": service.hours_text(sum((by_day[d] for d in week_days), Decimal("0"))),
                "worked_days": len(week_days),
            }
        )
        start = end + timedelta(days=1)

    return {
        "total": service.hours_text(total),
        "worked_days": worked,
        "average": None if average is None else service.hours_text(average),
        "daily": [
            {"day": d, "hours": service.hours_text(by_day.get(d, Decimal("0")))}
            for d in range(1, last.day + 1)
        ],
        "weeks": weeks,
    }


def month_stats(db: Session, user: User, month: str) -> dict:
    now = service.today()
    goals = _month_goals(db, user, month)
    current = _summary(month, goals)
    previous = _summary(service.previous_month(month), _month_goals(db, user, service.previous_month(month)))
    elapsed = current["elapsed_days"]
    dim = current["days_in_month"]
    count = len(goals)
    today_day = now.day if service.month_key(now) == month else None
    year, mon = int(month[:4]), int(month[5:])

    daily = [
        {"day": d, "score": sum(1 for _, days in goals if d in days), "elapsed": d <= elapsed}
        for d in range(1, dim + 1)
    ]

    weekdays = [{"weekday": w, "done": 0, "possible": 0} for w in range(7)]
    for d in range(1, elapsed + 1):
        w = date(year, mon, d).weekday()
        weekdays[w]["possible"] += count
        weekdays[w]["done"] += daily[d - 1]["score"]
    for row in weekdays:
        row["percent"] = _text(percent(row["done"], row["possible"]))

    per_goal = []
    for goal, days in goals:
        counted = {d for d in days if d <= elapsed}
        streaks = _streaks(days)
        per_goal.append(
            {
                "id": goal.id,
                "title": goal.title,
                "position": goal.position,
                "done": len(counted),
                "possible": elapsed,
                "percent": _text(percent(len(counted), elapsed)),
                "current_streak": _current_streak(streaks, today_day),
                "best_streak": max(streaks.values(), default=0),
                "full_month": dim > 0 and len(days) >= dim,
            }
        )

    # El más y el menos cumplido (por marcas; empate: el primero de la hoja). Si todos empatan, no hay.
    best_id = worst_id = None
    if elapsed > 0 and len(per_goal) >= 2:
        best = max(per_goal, key=lambda g: g["done"])
        worst = min(per_goal, key=lambda g: g["done"])
        if best["done"] != worst["done"]:
            best_id, worst_id = best["id"], worst["id"]

    best_streak = max(per_goal, key=lambda g: g["best_streak"], default=None)
    delta = None
    if current["commitment"] is not None and previous["commitment"] is not None:
        delta = current["commitment"] - previous["commitment"]

    def out(summary: dict) -> dict:
        return {**summary, "commitment": _text(summary["commitment"])}

    return {
        **out(current),
        "today": now.isoformat(),
        "previous": out(previous),
        "commitment_delta": _text(delta),
        "daily": daily,
        "weekdays": weekdays,
        "goals": per_goal,
        "best_goal_id": best_id,
        "worst_goal_id": worst_id,
        "streaks": {
            "active": sum(1 for g in per_goal if g["current_streak"] >= ACTIVE_STREAK),
            "best_current": max((g["current_streak"] for g in per_goal), default=0),
            "best": None
            if best_streak is None or best_streak["best_streak"] == 0
            else {
                "goal_id": best_streak["id"],
                "title": best_streak["title"],
                "days": best_streak["best_streak"],
            },
        },
        "hours": _hours(db, user, month),
    }


def parse_year(value: Optional[int]) -> int:
    if value is None:
        return service.today().year
    if not 2000 <= value <= 2100:
        raise ApiError(422, "El año va de 2000 a 2100.", "VALIDATION_ERROR", {"field": "year"})
    return value


def heatmap(db: Session, user: User, year: int) -> dict:
    """Por día del año (hasta hoy): marcas de ese día y objetivos de su mes. Solo días con objetivos."""
    now = service.today()
    goals_by_month = dict(
        db.query(Goal.month, func.count(Goal.id))
        .filter(Goal.user_id == user.id, Goal.month.like(f"{year:04d}-%"))
        .group_by(Goal.month)
        .all()
    )
    checks = dict(
        db.query(GoalCheck.day, func.count(GoalCheck.id))
        .join(Goal, Goal.id == GoalCheck.goal_id)
        .filter(Goal.user_id == user.id, GoalCheck.day >= date(year, 1, 1), GoalCheck.day <= date(year, 12, 31))
        .group_by(GoalCheck.day)
        .all()
    )
    days = []
    for month, count in sorted(goals_by_month.items()):
        first, last = service._month_range(month)
        day = first
        while day <= min(last, now):
            done = min(checks.get(day, 0), count)
            days.append({"date": day.isoformat(), "done": done, "goals": count})
            day += timedelta(days=1)
    return {"year": year, "today": now.isoformat(), "days": days}
