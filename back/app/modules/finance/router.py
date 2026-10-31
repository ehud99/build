"""Finanzas: gastos e ingresos por categorías (docs/contrato-finanzas.md)."""
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.modules.finance import service
from app.modules.finance.models import FinanceCategory, FinanceSettings, FinanceTransaction  # noqa: F401
from app.security import current_user

router = APIRouter(prefix="/api/finance", tags=["finance"])

Kind = Literal["expense", "income"]


def _name(value: str) -> str:
    value = " ".join(str(value or "").split())
    if not 1 <= len(value) <= 40:
        raise ValueError("El nombre tiene de 1 a 40 caracteres.")
    return value


def _icon(value: str) -> str:
    if value not in service.ICONS:
        raise ValueError("Ese símbolo no está en la lista.")
    return value


def _color(value: str) -> str:
    if value not in service.COLORS:
        raise ValueError("Ese color no está en la paleta.")
    return value


def _note(value: Optional[str]) -> str:
    value = " ".join(str(value or "").split())
    if len(value) > 200:
        raise ValueError("La nota tiene hasta 200 caracteres.")
    return value


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SettingsIn(_Strict):
    currency: Literal["PEN", "USD", "EUR", "MXN", "COP", "ARS", "CLP"]


class CategoryCreate(_Strict):
    kind: Kind
    name: str
    icon: str
    color: str

    @field_validator("name")
    @classmethod
    def check_name(cls, v):
        return _name(v)

    @field_validator("icon")
    @classmethod
    def check_icon(cls, v):
        return _icon(v)

    @field_validator("color")
    @classmethod
    def check_color(cls, v):
        return _color(v)


class CategoryUpdate(_Strict):
    kind: Optional[Kind] = None
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    archived: Optional[bool] = None
    position: Optional[int] = Field(default=None, ge=0, le=10_000)

    @field_validator("name")
    @classmethod
    def check_name(cls, v):
        return v if v is None else _name(v)

    @field_validator("icon")
    @classmethod
    def check_icon(cls, v):
        return v if v is None else _icon(v)

    @field_validator("color")
    @classmethod
    def check_color(cls, v):
        return v if v is None else _color(v)


class TransactionCreate(_Strict):
    kind: Kind
    category_id: int
    # Texto, nunca número: `"24855.50"` (un número JSON da 422).
    amount: StrictStr
    occurred_on: Optional[date] = None
    note: Optional[str] = ""

    @field_validator("amount")
    @classmethod
    def check_amount(cls, v):
        return service.parse_amount(v)

    @field_validator("note")
    @classmethod
    def check_note(cls, v):
        return _note(v)


class TransactionUpdate(_Strict):
    category_id: Optional[int] = None
    amount: Optional[StrictStr] = None
    occurred_on: Optional[date] = None
    note: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def check_amount(cls, v):
        return v if v is None else service.parse_amount(v)

    @field_validator("note")
    @classmethod
    def check_note(cls, v):
        return v if v is None else _note(v)


def _changes(body: BaseModel) -> dict:
    """Solo los campos que vinieron y no son nulos."""
    return {k: getattr(body, k) for k in body.model_fields_set if getattr(body, k) is not None}


@router.get("/settings")
def read_settings(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.settings_out(service.ensure_user_setup(db, user))


@router.put("/settings")
def write_settings(body: SettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.settings_out(service.update_currency(db, user, body.currency))


@router.get("/categories")
def read_categories(
    kind: Optional[Kind] = None, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    return [service.category_out(c) for c in service.list_categories(db, user, kind)]


@router.post("/categories", status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = service.create_category(db, user, body.kind, body.name, body.icon, body.color)
    return service.category_out(row)


@router.patch("/categories/{category_id}")
def update_category(
    category_id: int, body: CategoryUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    return service.category_out(service.update_category(db, user, category_id, _changes(body)))


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    service.delete_category(db, user, category_id)
    return Response(status_code=204)


@router.get("/summary")
def read_summary(
    kind: Kind = "expense",
    start: Optional[date] = Query(default=None, alias="from"),
    end: Optional[date] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return service.summary(db, user, kind, start, end)


@router.get("/ledger")
def read_ledger(
    month: Optional[str] = None,
    kind: Optional[Kind] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """La libreta del mes (`month=AAAA-MM`, sin él el de hoy): movimientos por día y totales."""
    return service.ledger(db, user, month, kind, category_id)


@router.get("/transactions")
def read_transactions(
    start: Optional[date] = Query(default=None, alias="from"),
    end: Optional[date] = Query(default=None, alias="to"),
    kind: Optional[Kind] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return service.list_transactions(db, user, start, end, kind, category_id)


@router.post("/transactions", status_code=201)
def create_transaction(
    body: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    row = service.create_transaction(
        db, user, body.kind, body.category_id, body.amount, body.occurred_on, body.note or ""
    )
    return service.transaction_out(row)


@router.patch("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int, body: TransactionUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    changes = _changes(body)
    if "note" in body.model_fields_set and body.note is None:
        changes["note"] = ""
    return service.transaction_out(service.update_transaction(db, user, transaction_id, changes))


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    service.delete_transaction(db, user, transaction_id)
    return Response(status_code=204)
