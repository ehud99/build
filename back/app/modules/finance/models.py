"""
Tablas de Finanzas (docs/contrato-finanzas.md). Cada fila es de un usuario (`user_id`).

- `finance_settings`: la moneda del usuario; su fila marca además que ya se sembraron las
  categorías de fábrica.
- `finance_categories`: categorías de gastos o ingresos, con su ícono y su color (claves de las
  listas blancas de `service.py`).
- `finance_transactions`: un gasto o un ingreso. El monto es `Numeric(12, 2)`, nunca `float`.
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FinanceSettings(Base):
    __tablename__ = "finance_settings"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    currency: Mapped[str] = mapped_column(String(3), default="PEN", server_default="PEN")


class FinanceCategory(Base):
    __tablename__ = "finance_categories"
    __table_args__ = (
        CheckConstraint("kind IN ('expense', 'income')", name="ck_finance_categories_kind"),
        Index("ix_finance_categories_user_kind", "user_id", "kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(7))
    name: Mapped[str] = mapped_column(String(40))
    icon: Mapped[str] = mapped_column(String(20))
    color: Mapped[str] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FinanceTransaction(Base):
    __tablename__ = "finance_transactions"
    __table_args__ = (
        CheckConstraint("kind IN ('expense', 'income')", name="ck_finance_transactions_kind"),
        CheckConstraint("amount > 0", name="ck_finance_transactions_amount"),
        Index("ix_finance_transactions_user_day", "user_id", "occurred_on"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(7))
    # RESTRICT: una categoría con movimientos no se borra (se archiva).
    category_id: Mapped[int] = mapped_column(
        ForeignKey("finance_categories.id", ondelete="RESTRICT"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    occurred_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str] = mapped_column(String(200), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
