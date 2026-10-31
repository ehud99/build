"""
Tablas. Sin empresas ni membresías: cada usuario ve solo lo suyo (`user_id`).

- `users`: la cuenta, con su código de acceso (6 caracteres, bcrypt) y el conteo de fallos del login.
- `goals`: un objetivo de un mes (`month` = 'YYYY-MM'), en el orden de `position`.
- `goal_checks`: un día cumplido de un objetivo.
"""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(60))
    access_code_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    login_failures: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    login_locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    login_blocked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    month: Mapped[str] = mapped_column(String(7))
    title: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    checks: Mapped[list["GoalCheck"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan", passive_deletes=True, order_by="GoalCheck.day"
    )


class GoalCheck(Base):
    __tablename__ = "goal_checks"
    __table_args__ = (UniqueConstraint("goal_id", "day", name="ux_goal_checks_goal_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date)

    goal: Mapped[Goal] = relationship(back_populates="checks")
