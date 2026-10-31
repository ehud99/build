"""Finanzas (docs/contrato-finanzas.md): siembra, montos como texto, totales exactos y aislamiento."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.finance import service
from tests.conftest import register


@pytest.fixture
def fin_today(monkeypatch):
    """Fija «hoy» de finanzas: `fin_today.set(date(...))`."""

    class _Today:
        value = date(2026, 10, 31)

        def set(self, value: date) -> None:
            self.value = value

    holder = _Today()
    monkeypatch.setattr(service, "today", lambda: holder.value)
    return holder


def cats(client, kind):
    return {c["name"]: c for c in client.get("/api/finance/categories", params={"kind": kind}).json()}


def spend(client, category_id, amount, day="2026-10-31", kind="expense", note=""):
    return client.post(
        "/api/finance/transactions",
        json={"kind": kind, "category_id": category_id, "amount": amount, "occurred_on": day, "note": note},
    )


def summary(client, kind="expense", start="2026-10-01", end="2026-10-31"):
    return client.get("/api/finance/summary", params={"kind": kind, "from": start, "to": end})


def test_needs_session(client):
    for path in ("settings", "categories", "summary", "transactions"):
        assert client.get(f"/api/finance/{path}").status_code == 401


def test_default_categories_are_seeded_once(user_client, fin_today):
    first = user_client.get("/api/finance/categories").json()
    again = user_client.get("/api/finance/categories").json()
    assert first == again
    expense = [c["name"] for c in first if c["kind"] == "expense"]
    income = [c["name"] for c in first if c["kind"] == "income"]
    assert expense == [
        "Alimentación", "Transporte", "Compras", "Casa", "Salud",
        "Ocio", "Educación", "Servicios", "Regalos", "Otros",
    ]
    assert income == ["Sueldo", "Extras", "Regalos", "Inversiones", "Otros"]
    assert all(c["icon"] in service.ICONS and c["color"] in service.COLORS for c in first)
    assert [c["position"] for c in first if c["kind"] == "income"] == [0, 1, 2, 3, 4]
    # Otra ruta antes de las categorías tampoco siembra dos veces.
    user_client.get("/api/finance/summary")
    assert len(user_client.get("/api/finance/categories").json()) == 15


def test_settings_currency(user_client, fin_today):
    r = user_client.get("/api/finance/settings").json()
    assert r["currency"] == "PEN"
    assert r["today"] == "2026-10-31"
    assert "USD" in r["currencies"]
    assert user_client.put("/api/finance/settings", json={"currency": "USD"}).json()["currency"] == "USD"
    assert user_client.put("/api/finance/settings", json={"currency": "BTC"}).status_code == 422
    assert summary(user_client).json()["currency"] == "USD"


@pytest.mark.parametrize(
    "amount",
    ["0", "0.00", "-5", "1.234", "1,50", "1e3", " 12", "abc", "", "1000000000", "01.5", ".5"],
)
def test_invalid_amounts(user_client, fin_today, amount):
    food = cats(user_client, "expense")["Alimentación"]
    r = spend(user_client, food["id"], amount)
    assert r.status_code == 422, amount
    assert r.json()["detail"]["field"] == "amount"


def test_amount_must_be_text(user_client, fin_today):
    food = cats(user_client, "expense")["Alimentación"]
    r = spend(user_client, food["id"], 12.5)
    assert r.status_code == 422
    assert r.json()["error_code"] == "VALIDATION_ERROR"


def test_amount_is_normalized_to_cents(user_client, fin_today):
    food = cats(user_client, "expense")["Alimentación"]
    r = spend(user_client, food["id"], "24855.5", note="  Mercado   grande ")
    assert r.status_code == 201
    body = r.json()
    assert body["amount"] == "24855.50"
    assert body["note"] == "Mercado grande"
    assert spend(user_client, food["id"], "999999999.99").json()["amount"] == "999999999.99"


def test_date_defaults_to_today(user_client, fin_today):
    food = cats(user_client, "expense")["Alimentación"]
    r = user_client.post(
        "/api/finance/transactions", json={"kind": "expense", "category_id": food["id"], "amount": "3"}
    )
    assert r.json()["occurred_on"] == "2026-10-31"
    assert spend(user_client, food["id"], "3", day="1999-12-31").status_code == 422


def test_totals_and_percents_are_exact(user_client, fin_today):
    expense = cats(user_client, "expense")
    a, b, c = expense["Alimentación"]["id"], expense["Transporte"]["id"], expense["Ocio"]["id"]
    # 0.10 + 0.20 en float daría 0.30000000000000004.
    spend(user_client, a, "0.10")
    spend(user_client, a, "0.20", day="2026-10-02")
    spend(user_client, b, "0.30")
    spend(user_client, c, "0.40")
    r = summary(user_client).json()
    assert r["total"] == "1.00"
    rows = [(i["category"]["name"], i["total"], i["percent"], i["share"], i["count"]) for i in r["categories"]]
    assert rows == [
        ("Ocio", "0.40", "40.0", "0.400000", 1),
        ("Alimentación", "0.30", "30.0", "0.300000", 2),
        ("Transporte", "0.30", "30.0", "0.300000", 1),
    ]


def test_percent_rounding_one_decimal(user_client, fin_today):
    expense = cats(user_client, "expense")
    for name in ("Alimentación", "Transporte", "Compras"):
        spend(user_client, expense[name]["id"], "10")
    r = summary(user_client).json()
    assert r["total"] == "30.00"
    assert [i["percent"] for i in r["categories"]] == ["33.3", "33.3", "33.3"]
    assert sum(Decimal(i["share"]) for i in r["categories"]) == Decimal("0.999999")


def test_ranges_and_default_month(user_client, fin_today):
    food = cats(user_client, "expense")["Alimentación"]["id"]
    spend(user_client, food, "5", day="2026-09-30")
    spend(user_client, food, "7", day="2026-10-01")
    spend(user_client, food, "11", day="2026-10-31")
    spend(user_client, food, "13", day="2026-11-01")
    assert summary(user_client).json()["total"] == "18.00"
    # Sin fechas: el mes de hoy.
    r = user_client.get("/api/finance/summary").json()
    assert (r["from"], r["to"], r["total"]) == ("2026-10-01", "2026-10-31", "18.00")
    assert summary(user_client, start="2026-10-31", end="2026-10-31").json()["total"] == "11.00"
    # Semana del lunes 26 de octubre al domingo 1 de noviembre.
    assert summary(user_client, start="2026-10-26", end="2026-11-01").json()["total"] == "24.00"
    assert summary(user_client, start="2026-01-01", end="2026-12-31").json()["total"] == "36.00"
    fin_today.set(date(2026, 12, 15))
    assert user_client.get("/api/finance/summary").json()["from"] == "2026-12-01"
    bad = summary(user_client, start="2026-11-02", end="2026-11-01")
    assert bad.status_code == 422 and bad.json()["detail"]["field"] == "from"
    assert user_client.get("/api/finance/summary", params={"from": "2026-10-01"}).status_code == 422
    assert summary(user_client, start="2026-02-30").status_code == 422


def test_balance_is_income_minus_expense_all_time(user_client, fin_today):
    expense, income = cats(user_client, "expense"), cats(user_client, "income")
    spend(user_client, income["Sueldo"]["id"], "3000", kind="income", day="2025-01-15")
    spend(user_client, income["Extras"]["id"], "150.25", kind="income")
    spend(user_client, expense["Casa"]["id"], "1200.10", day="2024-06-01")
    spend(user_client, expense["Salud"]["id"], "45.05")
    r = summary(user_client).json()
    assert r["balance"] == "1905.10"
    assert r["total"] == "45.05"
    inc = summary(user_client, kind="income").json()
    assert inc["total"] == "150.25"
    assert [i["category"]["name"] for i in inc["categories"]] == ["Extras"]
    # Más gastos que ingresos: balance negativo.
    spend(user_client, expense["Casa"]["id"], "5000")
    assert summary(user_client).json()["balance"] == "-3094.90"


def test_category_of_other_kind_is_rejected(user_client, fin_today):
    salary = cats(user_client, "income")["Sueldo"]["id"]
    r = spend(user_client, salary, "10", kind="expense")
    assert r.status_code == 422
    assert r.json()["error_code"] == "CATEGORY_KIND_MISMATCH"
    food = cats(user_client, "expense")["Alimentación"]["id"]
    t = spend(user_client, food, "10").json()
    r = user_client.patch(f"/api/finance/transactions/{t['id']}", json={"category_id": salary})
    assert r.json()["error_code"] == "CATEGORY_KIND_MISMATCH"


def test_edit_and_delete_transaction(user_client, fin_today):
    expense = cats(user_client, "expense")
    t = spend(user_client, expense["Alimentación"]["id"], "10", note="Pan").json()
    r = user_client.patch(
        f"/api/finance/transactions/{t['id']}",
        json={"amount": "12.30", "category_id": expense["Ocio"]["id"], "occurred_on": "2026-10-05", "note": None},
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["amount"], body["category_id"], body["occurred_on"], body["note"]) == (
        "12.30", expense["Ocio"]["id"], "2026-10-05", "",
    )
    assert user_client.patch(f"/api/finance/transactions/{t['id']}", json={"amount": "0"}).status_code == 422
    assert user_client.patch(f"/api/finance/transactions/{t['id']}", json={"kind": "income"}).status_code == 422
    assert user_client.delete(f"/api/finance/transactions/{t['id']}").status_code == 204
    assert user_client.delete(f"/api/finance/transactions/{t['id']}").status_code == 404


def test_list_transactions_filters(user_client, fin_today):
    expense, income = cats(user_client, "expense"), cats(user_client, "income")
    a = spend(user_client, expense["Alimentación"]["id"], "1.10", day="2026-10-02").json()
    b = spend(user_client, expense["Alimentación"]["id"], "2.20", day="2026-10-20").json()
    spend(user_client, expense["Transporte"]["id"], "3.30", day="2026-10-20")
    spend(user_client, income["Sueldo"]["id"], "100", kind="income", day="2026-10-20")
    spend(user_client, expense["Alimentación"]["id"], "4.40", day="2026-11-02")
    r = user_client.get(
        "/api/finance/transactions",
        params={"from": "2026-10-01", "to": "2026-10-31", "category_id": expense["Alimentación"]["id"]},
    ).json()
    assert [t["id"] for t in r["items"]] == [b["id"], a["id"]]
    assert (r["total"], r["count"]) == ("3.30", 2)
    r = user_client.get("/api/finance/transactions", params={"kind": "income"}).json()
    assert r["total"] == "100.00"
    assert len(user_client.get("/api/finance/transactions").json()["items"]) == 5


def test_create_edit_category(user_client, fin_today):
    r = user_client.post(
        "/api/finance/categories", json={"kind": "expense", "name": "  Viajes  ", "icon": "plane", "color": "cyan"}
    )
    assert r.status_code == 201
    cat = r.json()
    assert (cat["name"], cat["position"], cat["archived"]) == ("Viajes", 10, False)
    assert spend(user_client, cat["id"], "80").status_code == 201
    r = user_client.patch(f"/api/finance/categories/{cat['id']}", json={"name": "Viajes largos", "color": "blue"})
    assert (r.json()["name"], r.json()["color"]) == ("Viajes largos", "blue")
    # Con movimientos no cambia de tipo.
    r = user_client.patch(f"/api/finance/categories/{cat['id']}", json={"kind": "income"})
    assert r.status_code == 409 and r.json()["error_code"] == "CATEGORY_IN_USE"


def test_category_validation(user_client, fin_today):
    def post(**over):
        body = {"kind": "expense", "name": "Nueva", "icon": "cart", "color": "red", **over}
        return user_client.post("/api/finance/categories", json=body)

    assert post(icon="rocket").json()["detail"]["field"] == "icon"
    assert post(color="#ff0000").json()["detail"]["field"] == "color"
    assert post(name=" ").json()["detail"]["field"] == "name"
    assert post(name="x" * 41).status_code == 422
    assert post(kind="other").status_code == 422
    r = post(name="alimentación")
    assert r.status_code == 409 and r.json()["error_code"] == "CATEGORY_NAME_TAKEN"
    # El mismo nombre en ingresos sí (ya hay «Regalos» en los dos).
    assert post(kind="income", name="Alimentación").status_code == 201


def test_delete_category_in_use_then_archive(user_client, fin_today):
    expense = cats(user_client, "expense")
    used, free = expense["Ocio"], expense["Educación"]
    spend(user_client, used["id"], "9.99")
    r = user_client.delete(f"/api/finance/categories/{used['id']}")
    assert r.status_code == 409
    assert r.json()["error_code"] == "CATEGORY_IN_USE"
    assert r.json()["detail"] == {"count": 1}
    assert user_client.delete(f"/api/finance/categories/{free['id']}").status_code == 204
    r = user_client.patch(f"/api/finance/categories/{used['id']}", json={"archived": True})
    assert r.json()["archived"] is True
    # Archivada: no recibe movimientos nuevos, pero sigue en el resumen.
    assert spend(user_client, used["id"], "1").json()["error_code"] == "CATEGORY_ARCHIVED"
    assert summary(user_client).json()["categories"][0]["category"]["archived"] is True
    # Su nombre queda libre para una nueva.
    r = user_client.post(
        "/api/finance/categories", json={"kind": "expense", "name": "Ocio", "icon": "party", "color": "pink"}
    )
    assert r.status_code == 201
    # Y no se desarchiva si ya hay otra activa con el mismo nombre.
    r = user_client.patch(f"/api/finance/categories/{used['id']}", json={"archived": False})
    assert r.json()["error_code"] == "CATEGORY_NAME_TAKEN"


def test_users_are_isolated(user_client, fin_today):
    food = cats(user_client, "expense")["Alimentación"]
    t = spend(user_client, food["id"], "50").json()
    with TestClient(app) as other:
        assert register(other, username="sol", name="Sol").status_code == 201
        assert other.get(f"/api/finance/categories").status_code == 200
        assert summary(other).json()["total"] == "0.00"
        assert summary(other).json()["balance"] == "0.00"
        assert other.get("/api/finance/transactions").json()["items"] == []
        assert other.patch(f"/api/finance/transactions/{t['id']}", json={"amount": "1"}).status_code == 404
        assert other.delete(f"/api/finance/transactions/{t['id']}").status_code == 404
        assert other.patch(f"/api/finance/categories/{food['id']}", json={"name": "Mía"}).status_code == 404
        assert other.delete(f"/api/finance/categories/{food['id']}").status_code == 404
        r = spend(other, food["id"], "5")
        assert r.status_code == 404 and r.json()["error_code"] == "CATEGORY_NOT_FOUND"
        assert other.get("/api/finance/transactions", params={"category_id": food["id"]}).status_code == 404
    assert summary(user_client).json()["total"] == "50.00"
