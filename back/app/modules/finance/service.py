"""
Finanzas: gastos e ingresos por categorías (docs/contrato-finanzas.md).

- Los montos viajan como texto (`"24855.50"`) y se guardan en `Numeric(12, 2)`: nunca `float`.
- Totales, balance y porcentajes los calcula el servidor (`SUM` en SQL y `Decimal`).
- Al primer acceso del usuario se siembran su moneda y las categorías de fábrica (idempotente:
  la fila de `finance_settings` se inserta con `ON CONFLICT DO NOTHING` y solo quien la crea siembra).
- «Hoy» en `APP_TIMEZONE` (`today()`, que las pruebas reemplazan).
"""
import re
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import ApiError
from app.models import User
from app.modules.finance.models import FinanceCategory, FinanceSettings, FinanceTransaction

KINDS = ("expense", "income")
CURRENCIES = ("PEN", "USD", "EUR", "MXN", "COP", "ARS", "CLP")
DEFAULT_CURRENCY = "PEN"

# Lista blanca de íconos (el frontend mapea cada clave a un ícono de lucide, `catalog.js`).
ICONS = (
    "cart", "bag", "home", "rent", "car", "taxi", "bus", "train", "bike", "fuel",
    "plane", "travel", "food", "pizza", "coffee", "health", "pill", "gift", "party", "game",
    "movie", "music", "education", "book", "pet", "clothes", "beauty", "baby", "gym", "sport",
    "wifi", "phone", "laptop", "tv", "electricity", "water", "gas", "tools", "insurance", "tax",
    "card", "bank", "salary", "cash", "coins", "savings", "investment", "other",
)
# Paleta fija (los colores son tokens `--fin-<clave>` en `finance.css`, claro y oscuro).
COLORS = (
    "red", "orange", "amber", "yellow", "lime", "green", "teal", "cyan",
    "blue", "indigo", "violet", "pink", "brown", "gray",
)

# Categorías de fábrica: (nombre, ícono, color).
DEFAULT_CATEGORIES = {
    "expense": (
        ("Alimentación", "food", "orange"),
        ("Transporte", "bus", "blue"),
        ("Compras", "cart", "pink"),
        ("Casa", "home", "brown"),
        ("Salud", "health", "red"),
        ("Ocio", "game", "violet"),
        ("Educación", "education", "indigo"),
        ("Servicios", "electricity", "amber"),
        ("Regalos", "gift", "teal"),
        ("Otros", "other", "gray"),
    ),
    "income": (
        ("Sueldo", "salary", "green"),
        ("Extras", "coins", "lime"),
        ("Regalos", "gift", "teal"),
        ("Inversiones", "investment", "cyan"),
        ("Otros", "other", "gray"),
    ),
}

MAX_CATEGORIES_PER_KIND = 50
MAX_TRANSACTIONS = 1000
MIN_DAY = date(2000, 1, 1)
MAX_DAY = date(2100, 12, 31)

# Hasta 9 cifras enteras y 2 decimales, con punto. Nada de signo, exponente ni espacios.
AMOUNT_RE = re.compile(r"^(0|[1-9]\d{0,8})(\.\d{1,2})?$")
MAX_AMOUNT = Decimal("999999999.99")
CENT = Decimal("0.01")


def today() -> date:
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def _invalid(message: str, field: str) -> ApiError:
    return ApiError(422, message, "VALIDATION_ERROR", {"field": field})


# --- Montos -------------------------------------------------------------------------------------


def parse_amount(value: str) -> Decimal:
    """`"24855.5"` → `Decimal("24855.50")`. Mayor que 0, hasta 2 decimales y 999 999 999,99."""
    if not isinstance(value, str) or not AMOUNT_RE.fullmatch(value):
        raise ValueError("El monto va como texto, con punto y hasta 2 decimales (\"24855.50\").")
    amount = Decimal(value).quantize(CENT)
    if amount <= 0:
        raise ValueError("El monto debe ser mayor que 0.")
    if amount > MAX_AMOUNT:
        raise ValueError("El monto es demasiado grande.")
    return amount


def money(value: Optional[Decimal]) -> str:
    """`Decimal` → texto con 2 decimales (`"24855.50"`, `"-12.00"`)."""
    return format((value or Decimal("0")).quantize(CENT, rounding=ROUND_HALF_UP), "f")


# --- Ajustes y siembra --------------------------------------------------------------------------


def ensure_user_setup(db: Session, user: User) -> FinanceSettings:
    """La fila de ajustes del usuario; la primera vez, también sus categorías de fábrica."""
    created = db.execute(
        insert(FinanceSettings)
        .values(user_id=user.id, currency=DEFAULT_CURRENCY)
        .on_conflict_do_nothing(index_elements=["user_id"])
        .returning(FinanceSettings.user_id)
    ).first()
    if created is not None:
        for kind, rows in DEFAULT_CATEGORIES.items():
            for position, (name, icon, color) in enumerate(rows):
                db.add(
                    FinanceCategory(
                        user_id=user.id, kind=kind, name=name, icon=icon, color=color, position=position
                    )
                )
        db.commit()
    return db.get(FinanceSettings, user.id)


def settings_out(row: FinanceSettings) -> dict:
    return {"currency": row.currency, "currencies": list(CURRENCIES), "today": today().isoformat()}


def update_currency(db: Session, user: User, currency: str) -> FinanceSettings:
    row = ensure_user_setup(db, user)
    row.currency = currency
    db.commit()
    return row


# --- Categorías ---------------------------------------------------------------------------------


def category_out(c: FinanceCategory) -> dict:
    return {
        "id": c.id,
        "kind": c.kind,
        "name": c.name,
        "icon": c.icon,
        "color": c.color,
        "position": c.position,
        "archived": c.archived,
    }


def list_categories(db: Session, user: User, kind: Optional[str]) -> list[FinanceCategory]:
    ensure_user_setup(db, user)
    query = db.query(FinanceCategory).filter(FinanceCategory.user_id == user.id)
    if kind:
        query = query.filter(FinanceCategory.kind == kind)
    return query.order_by(FinanceCategory.kind, FinanceCategory.position, FinanceCategory.id).all()


def get_category(db: Session, user: User, category_id: int) -> FinanceCategory:
    row = (
        db.query(FinanceCategory)
        .filter(FinanceCategory.id == category_id, FinanceCategory.user_id == user.id)
        .first()
    )
    if row is None:
        raise ApiError(404, "Esa categoría no existe.", "CATEGORY_NOT_FOUND")
    return row


def _ensure_name_free(db: Session, user: User, kind: str, name: str, exclude_id: Optional[int] = None) -> None:
    query = db.query(FinanceCategory.id).filter(
        FinanceCategory.user_id == user.id,
        FinanceCategory.kind == kind,
        FinanceCategory.archived.is_(False),
        func.lower(FinanceCategory.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.filter(FinanceCategory.id != exclude_id)
    if query.first() is not None:
        raise ApiError(409, "Ya tienes una categoría con ese nombre.", "CATEGORY_NAME_TAKEN", {"field": "name"})


def _usage(db: Session, category: FinanceCategory) -> int:
    return (
        db.query(func.count(FinanceTransaction.id))
        .filter(FinanceTransaction.category_id == category.id)
        .scalar()
        or 0
    )


def create_category(db: Session, user: User, kind: str, name: str, icon: str, color: str) -> FinanceCategory:
    ensure_user_setup(db, user)
    db.query(User).filter(User.id == user.id).with_for_update().first()
    _ensure_name_free(db, user, kind, name)
    count = (
        db.query(func.count(FinanceCategory.id))
        .filter(FinanceCategory.user_id == user.id, FinanceCategory.kind == kind)
        .scalar()
        or 0
    )
    if count >= MAX_CATEGORIES_PER_KIND:
        raise ApiError(409, f"Máximo {MAX_CATEGORIES_PER_KIND} categorías de cada tipo.", "CATEGORY_LIMIT")
    last = (
        db.query(func.max(FinanceCategory.position))
        .filter(FinanceCategory.user_id == user.id, FinanceCategory.kind == kind)
        .scalar()
    )
    row = FinanceCategory(
        user_id=user.id, kind=kind, name=name, icon=icon, color=color, position=0 if last is None else last + 1
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_category(db: Session, user: User, category_id: int, changes: dict) -> FinanceCategory:
    row = get_category(db, user, category_id)
    kind = changes.get("kind", row.kind)
    if kind != row.kind and _usage(db, row) > 0:
        raise ApiError(
            409, "Esta categoría ya tiene movimientos: no puede cambiar de tipo.", "CATEGORY_IN_USE"
        )
    name = changes.get("name", row.name)
    archived = changes.get("archived", row.archived)
    if not archived and (name != row.name or kind != row.kind or row.archived):
        _ensure_name_free(db, user, kind, name, exclude_id=row.id)
    for field, value in changes.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_category(db: Session, user: User, category_id: int) -> None:
    row = get_category(db, user, category_id)
    used = _usage(db, row)
    if used > 0:
        raise ApiError(
            409,
            "Esta categoría tiene movimientos: archívala para ocultarla.",
            "CATEGORY_IN_USE",
            {"count": used},
        )
    db.delete(row)
    db.commit()


# --- Movimientos --------------------------------------------------------------------------------


def transaction_out(t: FinanceTransaction) -> dict:
    return {
        "id": t.id,
        "kind": t.kind,
        "category_id": t.category_id,
        "amount": money(t.amount),
        "occurred_on": t.occurred_on.isoformat(),
        "note": t.note,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def get_transaction(db: Session, user: User, transaction_id: int) -> FinanceTransaction:
    row = (
        db.query(FinanceTransaction)
        .filter(FinanceTransaction.id == transaction_id, FinanceTransaction.user_id == user.id)
        .first()
    )
    if row is None:
        raise ApiError(404, "Ese movimiento no existe.", "TRANSACTION_NOT_FOUND")
    return row


def _usable_category(db: Session, user: User, category_id: int, kind: str) -> FinanceCategory:
    category = get_category(db, user, category_id)
    if category.kind != kind:
        raise ApiError(
            422,
            "La categoría es de otro tipo (gastos o ingresos).",
            "CATEGORY_KIND_MISMATCH",
            {"field": "category_id"},
        )
    if category.archived:
        raise ApiError(409, "Esa categoría está archivada.", "CATEGORY_ARCHIVED", {"field": "category_id"})
    return category


def check_day(value: date, field: str = "occurred_on") -> date:
    if not MIN_DAY <= value <= MAX_DAY:
        raise _invalid("La fecha va del 2000 al 2100.", field)
    return value


def create_transaction(
    db: Session, user: User, kind: str, category_id: int, amount: Decimal, occurred_on: Optional[date], note: str
) -> FinanceTransaction:
    ensure_user_setup(db, user)
    _usable_category(db, user, category_id, kind)
    row = FinanceTransaction(
        user_id=user.id,
        kind=kind,
        category_id=category_id,
        amount=amount,
        occurred_on=check_day(occurred_on or today()),
        note=note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_transaction(db: Session, user: User, transaction_id: int, changes: dict) -> FinanceTransaction:
    row = get_transaction(db, user, transaction_id)
    if "category_id" in changes and changes["category_id"] != row.category_id:
        _usable_category(db, user, changes["category_id"], row.kind)
    if "occurred_on" in changes:
        check_day(changes["occurred_on"])
    for field, value in changes.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_transaction(db: Session, user: User, transaction_id: int) -> None:
    row = get_transaction(db, user, transaction_id)
    db.delete(row)
    db.commit()


def resolve_range(start: Optional[date], end: Optional[date]) -> tuple[date, date]:
    """El rango pedido; sin fechas, el mes de hoy. `from` no puede pasar a `to`."""
    if start is None and end is None:
        now = today()
        start = now.replace(day=1)
        end = (start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1))
        end = date.fromordinal(end.toordinal() - 1)
    elif start is None or end is None:
        raise _invalid("El periodo necesita las dos fechas.", "from" if start is None else "to")
    check_day(start, "from")
    check_day(end, "to")
    if start > end:
        raise _invalid("La fecha de inicio va antes de la final.", "from")
    return start, end


def list_transactions(
    db: Session,
    user: User,
    start: Optional[date],
    end: Optional[date],
    kind: Optional[str],
    category_id: Optional[int],
) -> dict:
    query = db.query(FinanceTransaction).filter(FinanceTransaction.user_id == user.id)
    if start is not None or end is not None:
        start, end = resolve_range(start, end)
        query = query.filter(FinanceTransaction.occurred_on >= start, FinanceTransaction.occurred_on <= end)
    if kind:
        query = query.filter(FinanceTransaction.kind == kind)
    if category_id is not None:
        get_category(db, user, category_id)
        query = query.filter(FinanceTransaction.category_id == category_id)
    total = query.with_entities(func.sum(FinanceTransaction.amount)).scalar()
    rows = (
        query.order_by(FinanceTransaction.occurred_on.desc(), FinanceTransaction.id.desc())
        .limit(MAX_TRANSACTIONS)
        .all()
    )
    return {"items": [transaction_out(t) for t in rows], "total": money(total), "count": len(rows)}


# --- Libreta del mes ------------------------------------------------------------------------

MONTH_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def parse_month(value: Optional[str]) -> tuple[date, date]:
    """`"2026-10"` → (1 de octubre, 31 de octubre); sin valor, el mes de hoy. Del 2000 al 2100."""
    if value is None:
        first = today().replace(day=1)
    else:
        match = MONTH_RE.fullmatch(value)
        if match is None:
            raise _invalid("El mes va como AAAA-MM.", "month")
        first = date(int(match.group(1)), int(match.group(2)), 1)
        if not MIN_DAY <= first <= MAX_DAY:
            raise _invalid("El mes va del 2000 al 2100.", "month")
    after = first.replace(year=first.year + 1, month=1) if first.month == 12 else first.replace(month=first.month + 1)
    return first, date.fromordinal(after.toordinal() - 1)


def _totals(sums: dict) -> dict:
    income = sums.get("income") or Decimal("0")
    expense = sums.get("expense") or Decimal("0")
    return {"income": money(income), "expense": money(expense), "net": money(income - expense)}


def ledger(db: Session, user: User, month: Optional[str], kind: Optional[str], category_id: Optional[int]) -> dict:
    """
    Los movimientos del mes agrupados por día, del más nuevo al más viejo, con sus totales. Los
    totales del mes y de cada día salen de `SUM` en SQL (siguen a los filtros) y van como texto.
    """
    prefs = ensure_user_setup(db, user)
    start, end = parse_month(month)
    filters = [
        FinanceTransaction.user_id == user.id,
        FinanceTransaction.occurred_on >= start,
        FinanceTransaction.occurred_on <= end,
    ]
    if kind:
        filters.append(FinanceTransaction.kind == kind)
    if category_id is not None:
        get_category(db, user, category_id)
        filters.append(FinanceTransaction.category_id == category_id)

    per_day: dict[date, dict] = {}
    month_sums: dict[str, Decimal] = {}
    for day, row_kind, value in (
        db.query(FinanceTransaction.occurred_on, FinanceTransaction.kind, func.sum(FinanceTransaction.amount))
        .filter(*filters)
        .group_by(FinanceTransaction.occurred_on, FinanceTransaction.kind)
    ):
        per_day.setdefault(day, {})[row_kind] = value
        month_sums[row_kind] = month_sums.get(row_kind, Decimal("0")) + value

    rows = (
        db.query(FinanceTransaction, FinanceCategory)
        .join(FinanceCategory, FinanceCategory.id == FinanceTransaction.category_id)
        .filter(*filters)
        .order_by(FinanceTransaction.occurred_on.desc(), FinanceTransaction.id.desc())
        .all()
    )
    days: dict[date, list] = {}
    for t, c in rows:
        days.setdefault(t.occurred_on, []).append(
            {
                **transaction_out(t),
                "category": {"id": c.id, "name": c.name, "icon": c.icon, "color": c.color, "archived": c.archived},
            }
        )
    return {
        "month": start.strftime("%Y-%m"),
        "today": today().isoformat(),
        "currency": prefs.currency,
        "totals": _totals(month_sums),
        "days": [
            {"date": day.isoformat(), **_totals(per_day[day]), "transactions": items}
            for day, items in days.items()
        ],
    }


# --- Resumen ------------------------------------------------------------------------------------


def balance(db: Session, user: User) -> Decimal:
    """Ingresos − gastos de todo el tiempo."""
    rows = (
        db.query(FinanceTransaction.kind, func.sum(FinanceTransaction.amount))
        .filter(FinanceTransaction.user_id == user.id)
        .group_by(FinanceTransaction.kind)
        .all()
    )
    sums = {kind: value or Decimal("0") for kind, value in rows}
    return sums.get("income", Decimal("0")) - sums.get("expense", Decimal("0"))


SHARE_STEP = Decimal("0.000001")
PERCENT_STEP = Decimal("0.1")


def summary(db: Session, user: User, kind: str, start: Optional[date], end: Optional[date]) -> dict:
    """
    Totales del periodo por categoría, de mayor a menor. `share` es la fracción del total (6
    decimales, para la dona) y `percent` el porcentaje con 1 decimal; los dos como texto.
    """
    prefs = ensure_user_setup(db, user)
    start, end = resolve_range(start, end)
    rows = (
        db.query(
            FinanceTransaction.category_id,
            func.sum(FinanceTransaction.amount),
            func.count(FinanceTransaction.id),
        )
        .filter(
            FinanceTransaction.user_id == user.id,
            FinanceTransaction.kind == kind,
            FinanceTransaction.occurred_on >= start,
            FinanceTransaction.occurred_on <= end,
        )
        .group_by(FinanceTransaction.category_id)
        .all()
    )
    total = sum((value for _, value, _ in rows), Decimal("0"))
    categories = {
        c.id: c
        for c in db.query(FinanceCategory).filter(
            FinanceCategory.user_id == user.id, FinanceCategory.id.in_([r[0] for r in rows] or [0])
        )
    }
    items = []
    for category_id, value, count in rows:
        fraction = value / total if total else Decimal("0")
        items.append(
            {
                "category": category_out(categories[category_id]),
                "total": money(value),
                "share": format(fraction.quantize(SHARE_STEP, rounding=ROUND_HALF_UP), "f"),
                "percent": format((fraction * 100).quantize(PERCENT_STEP, rounding=ROUND_HALF_UP), "f"),
                "count": count,
            }
        )
    items.sort(key=lambda i: (-Decimal(i["total"]), i["category"]["position"], i["category"]["id"]))
    return {
        "kind": kind,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "today": today().isoformat(),
        "balance": money(balance(db, user)),
        "total": money(total),
        "currency": prefs.currency,
        "categories": items,
    }
