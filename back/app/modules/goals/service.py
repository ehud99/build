"""
Objetivos del mes (docs/contrato.md, «Objetivos»).

- Hasta `MAX_GOALS` objetivos por mes y usuario.
- Un mes pasado es de solo lectura; el actual y los futuros se editan.
- Solo se marca o desmarca el día de hoy (en `APP_TIMEZONE`).
"""
import calendar
import re
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.errors import ApiError
from app.models import Goal, GoalCheck, User

MAX_GOALS = 10
MONTH_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def today() -> date:
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def month_key(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def parse_month(value: Optional[str]) -> str:
    """'YYYY-MM' válido, o el mes actual si no viene."""
    if not value:
        return month_key(today())
    if not MONTH_RE.fullmatch(value) or not 2000 <= int(value[:4]) <= 2100:
        raise ApiError(422, "El mes va como AAAA-MM.", "VALIDATION_ERROR", {"field": "month"})
    return value


def days_in_month(month: str) -> int:
    return calendar.monthrange(int(month[:4]), int(month[5:]))[1]


def previous_month(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:])
    return f"{year - 1:04d}-12" if mon == 1 else f"{year:04d}-{mon - 1:02d}"


def is_editable(month: str) -> bool:
    return month >= month_key(today())


def ensure_editable(month: str) -> None:
    if not is_editable(month):
        raise ApiError(409, "Ese mes ya cerró: no se puede cambiar.", "MONTH_READ_ONLY")


def goal_out(goal: Goal) -> dict:
    return {
        "id": goal.id,
        "title": goal.title,
        "position": goal.position,
        "checked_days": [c.day.day for c in goal.checks],
    }


def _goals_of(db: Session, user: User, month: str) -> list[Goal]:
    return (
        db.query(Goal)
        .options(selectinload(Goal.checks))
        .filter(Goal.user_id == user.id, Goal.month == month)
        .order_by(Goal.position, Goal.id)
        .all()
    )


def month_out(db: Session, user: User, month: str) -> dict:
    return {
        "month": month,
        "days_in_month": days_in_month(month),
        "today": today().isoformat(),
        "editable": is_editable(month),
        "max_goals": MAX_GOALS,
        "goals": [goal_out(g) for g in _goals_of(db, user, month)],
    }


def get_goal(db: Session, user: User, goal_id: int) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if goal is None:
        raise ApiError(404, "Ese objetivo no existe.", "GOAL_NOT_FOUND")
    return goal


def _count(db: Session, user: User, month: str) -> int:
    return db.query(func.count(Goal.id)).filter(Goal.user_id == user.id, Goal.month == month).scalar() or 0


def create_goal(db: Session, user: User, month: str, title: str) -> Goal:
    ensure_editable(month)
    # Bloquea al usuario: dos altas a la vez no pasan de 10.
    db.query(User).filter(User.id == user.id).with_for_update().first()
    count = _count(db, user, month)
    if count >= MAX_GOALS:
        raise ApiError(409, f"Máximo {MAX_GOALS} objetivos por mes.", "GOAL_LIMIT")
    last = (
        db.query(func.max(Goal.position)).filter(Goal.user_id == user.id, Goal.month == month).scalar()
    )
    goal = Goal(user_id=user.id, month=month, title=title, position=0 if last is None else last + 1)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def rename_goal(db: Session, user: User, goal_id: int, title: str) -> Goal:
    goal = get_goal(db, user, goal_id)
    ensure_editable(goal.month)
    goal.title = title
    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(db: Session, user: User, goal_id: int) -> None:
    goal = get_goal(db, user, goal_id)
    ensure_editable(goal.month)
    db.delete(goal)
    db.commit()


def set_check(db: Session, user: User, goal_id: int, day: int, done: bool) -> Goal:
    goal = get_goal(db, user, goal_id)
    now = today()
    if goal.month != month_key(now) or day != now.day:
        raise ApiError(409, "Solo puedes marcar el día de hoy.", "DAY_NOT_EDITABLE")
    existing = next((c for c in goal.checks if c.day == now), None)
    if done and existing is None:
        goal.checks.append(GoalCheck(day=now))
    elif not done and existing is not None:
        goal.checks.remove(existing)
    db.commit()
    db.refresh(goal)
    return goal


def copy_previous(db: Session, user: User, month: str) -> None:
    ensure_editable(month)
    db.query(User).filter(User.id == user.id).with_for_update().first()
    if _count(db, user, month) > 0:
        raise ApiError(409, "Este mes ya tiene objetivos.", "MONTH_NOT_EMPTY")
    source = _goals_of(db, user, previous_month(month))
    if not source:
        raise ApiError(404, "El mes anterior no tiene objetivos.", "NOTHING_TO_COPY")
    for position, goal in enumerate(source[:MAX_GOALS]):
        db.add(Goal(user_id=user.id, month=month, title=goal.title, position=position))
    db.commit()
