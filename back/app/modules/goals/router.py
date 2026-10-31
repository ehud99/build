from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Path, Response
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.modules.goals import service
from app.security import current_user

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _title(value: str) -> str:
    value = " ".join(str(value or "").split())
    if not 1 <= len(value) <= 80:
        raise ValueError("El objetivo tiene de 1 a 80 caracteres.")
    return value


class GoalOut(BaseModel):
    id: int
    title: str
    position: int
    checked_days: list[int]


class MonthOut(BaseModel):
    month: str
    days_in_month: int
    today: str
    editable: bool
    max_goals: int
    goals: list[GoalOut]
    work_hours: dict[str, str]
    total_hours: str


class GoalUpdate(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def _check_title(cls, value: str) -> str:
        return _title(value)


class GoalCreate(GoalUpdate):
    month: str


class CheckIn(BaseModel):
    done: bool


class MonthIn(BaseModel):
    month: str


class HoursIn(BaseModel):
    hours: Decimal


class HoursOut(BaseModel):
    month: str
    day: int
    hours: str
    total_hours: str


@router.get("", response_model=MonthOut)
def read_month(month: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.month_out(db, user, service.parse_month(month))


@router.post("", response_model=GoalOut, status_code=201)
def create(body: GoalCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    goal = service.create_goal(db, user, service.parse_month(body.month), body.title)
    return service.goal_out(goal)


@router.patch("/{goal_id}", response_model=GoalOut)
def rename(goal_id: int, body: GoalUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.goal_out(service.rename_goal(db, user, goal_id, body.title))


@router.delete("/{goal_id}", status_code=204)
def delete(goal_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    service.delete_goal(db, user, goal_id)
    return Response(status_code=204)


@router.put("/{goal_id}/checks/{day}", response_model=GoalOut)
def set_check(
    goal_id: int,
    body: CheckIn,
    day: int = Path(ge=1, le=31),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return service.goal_out(service.set_check(db, user, goal_id, day, body.done))


@router.post("/copy-previous", response_model=MonthOut, status_code=201)
def copy_previous(body: MonthIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    month = service.parse_month(body.month)
    service.copy_previous(db, user, month)
    return service.month_out(db, user, month)


@router.put("/work-hours/{day}", response_model=HoursOut)
def set_work_hours(
    body: HoursIn,
    day: int = Path(ge=1, le=31),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return service.set_work_hours(db, user, day, body.hours)
