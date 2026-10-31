"""Notas (docs/contrato-notas.md): CRUD, orden, búsqueda, lista blanca, tamaño y aislamiento."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.notes import service
from tests.conftest import register


def p(text=None, marks=None):
    node = {"type": "paragraph"}
    if text:
        t = {"type": "text", "text": text}
        if marks:
            t["marks"] = marks
        node["content"] = [t]
    return node


def doc(*blocks):
    return {"type": "doc", "content": list(blocks)}


def task(text, checked=False):
    return {"type": "taskItem", "attrs": {"checked": checked}, "content": [p(text)]}


def add(client, *blocks, **extra):
    return client.post("/api/notes", json={"content": doc(*blocks), **extra})


def test_needs_session(client):
    assert client.get("/api/notes").status_code == 401
    assert client.post("/api/notes", json={"content": doc(p("x"))}).status_code == 401


def test_create_derives_title_plain_and_preview(user_client):
    r = add(
        user_client,
        p(),
        p("  Compras   de la semana "),
        p("Para el sábado", [{"type": "bold"}]),
        p(),
        p(),
        {"type": "taskList", "content": [task("Leche", True), task("Pan")]},
        {"type": "bulletList", "content": [{"type": "listItem", "content": [p("Uno")]}]},
        {"type": "orderedList", "attrs": {"start": 3, "type": None}, "content": [{"type": "listItem", "content": [p("Tres")]}]},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sección"}]},
        {"type": "blockquote", "content": [p("Cita")]},
        {"type": "horizontalRule"},
        color="yellow",
    )
    assert r.status_code == 201, r.text
    note = r.json()
    assert note["title"] == "Compras de la semana"
    assert note["color"] == "yellow"
    assert note["pinned"] is False
    assert note["content"]["content"][1]["content"][0]["text"] == "  Compras   de la semana "
    lines = note["preview"]["lines"]
    assert [line["kind"] for line in lines] == [
        "text", "text", "task", "task", "bullet", "ordered", "heading", "quote", "rule",
    ]
    assert lines[1]["text"] == ""  # las líneas vacías seguidas quedan en una
    assert (lines[2]["text"], lines[2]["checked"], lines[3]["checked"]) == ("Leche", True, False)
    assert lines[5]["n"] == 3
    assert lines[6]["level"] == 2
    assert note["preview"]["more"] == 0
    assert note["created_at"] == note["updated_at"]


def test_preview_is_capped_and_counts_the_rest(user_client):
    blocks = [p("Título")] + [p(f"Línea {i}") for i in range(15)] + [p("x" * 500)]
    note = add(user_client, *blocks).json()
    assert len(note["preview"]["lines"]) == 10
    assert note["preview"]["more"] == 6
    long = add(user_client, p("y" * 300), p("z" * 500)).json()
    assert len(long["title"]) == 200
    assert len(long["preview"]["lines"][0]["text"]) == 240


def test_empty_note_is_rejected_on_create(user_client):
    r = add(user_client, p(), p("   "))
    assert r.status_code == 422
    assert r.json()["error_code"] == "VALIDATION_ERROR"
    assert r.json()["detail"]["field"] == "content"


def test_get_patch_and_delete(user_client):
    note = add(user_client, p("Hola")).json()
    r = user_client.get(f"/api/notes/{note['id']}")
    assert r.status_code == 200 and r.json()["content"] == doc(p("Hola"))

    r = user_client.patch(f"/api/notes/{note['id']}", json={"pinned": True, "color": "blue"})
    assert r.status_code == 200
    assert (r.json()["pinned"], r.json()["color"]) == (True, "blue")
    assert r.json()["updated_at"] == note["updated_at"]  # fijar o pintar no es editar

    r = user_client.patch(f"/api/notes/{note['id']}", json={"content": doc(p("Chau"), p("Otra"))})
    assert r.json()["title"] == "Chau"
    assert r.json()["updated_at"] > note["updated_at"]
    assert r.json()["pinned"] is True

    # Una existente se puede vaciar (el editor la borra al cerrar).
    r = user_client.patch(f"/api/notes/{note['id']}", json={"content": doc(p())})
    assert r.status_code == 200 and r.json()["title"] == ""

    assert user_client.delete(f"/api/notes/{note['id']}").status_code == 204
    assert user_client.get(f"/api/notes/{note['id']}").status_code == 404
    assert user_client.delete(f"/api/notes/{note['id']}").json()["error_code"] == "NOTE_NOT_FOUND"


def test_list_order_pinned_first_then_last_edited(user_client):
    a = add(user_client, p("A")).json()
    b = add(user_client, p("B")).json()
    c = add(user_client, p("C")).json()
    user_client.patch(f"/api/notes/{a['id']}", json={"content": doc(p("A2"))})
    user_client.patch(f"/api/notes/{c['id']}", json={"pinned": True})
    notes = user_client.get("/api/notes").json()
    assert [n["title"] for n in notes] == ["C", "A2", "B"]
    assert "content" not in notes[0]
    assert b["id"] in [n["id"] for n in notes]


def test_search_is_case_insensitive_and_literal(user_client):
    add(user_client, p("Receta"), p("Arroz con POLLO"))
    add(user_client, p("Viaje"), {"type": "taskList", "content": [task("Pasaporte")]})
    add(user_client, p("100% real_"))
    titles = lambda q: [n["title"] for n in user_client.get("/api/notes", params={"q": q}).json()]  # noqa: E731
    assert titles("pollo") == ["Receta"]
    assert titles("PASAPORTE") == ["Viaje"]
    assert titles("%") == ["100% real_"]
    assert titles("_") == ["100% real_"]
    assert titles("nada") == []
    assert len(titles("  ")) == 3


def test_color_must_be_from_the_palette(user_client):
    assert add(user_client, p("x"), color="magenta").status_code == 422
    note = add(user_client, p("x")).json()
    assert user_client.patch(f"/api/notes/{note['id']}", json={"color": "#ff0000"}).status_code == 422
    for color in service.COLORS:
        assert user_client.patch(f"/api/notes/{note['id']}", json={"color": color}).status_code == 200


@pytest.mark.parametrize(
    "bad",
    [
        {"type": "paragraph"},
        doc({"type": "codeBlock", "content": [{"type": "text", "text": "x"}]}),
        doc({"type": "image", "attrs": {"src": "https://x/y.png"}}),
        doc({"type": "paragraph", "content": [{"type": "text", "text": "<b>x</b>", "marks": [{"type": "code"}]}]}),
        doc({"type": "paragraph", "content": [{"type": "text", "text": "x", "marks": [{"type": "textStyle", "attrs": {"color": "red"}}]}]}),
        doc({"type": "paragraph", "attrs": {"style": "color:red"}, "content": [{"type": "text", "text": "x"}]}),
        doc({"type": "paragraph", "content": [{"type": "text", "text": "x", "html": "<script>"}]}),
        doc({"type": "paragraph", "content": [{"type": "text", "text": ""}]}),
        doc({"type": "heading", "attrs": {"level": 4}, "content": [{"type": "text", "text": "x"}]}),
        doc({"type": "heading", "content": [{"type": "text", "text": "x"}]}),
        doc({"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": "yes"}, "content": [p("x")]}]}),
        doc({"type": "taskList", "content": [{"type": "taskItem", "content": [p("x")]}]}),
        doc({"type": "bulletList", "content": [p("x")]}),
        doc({"type": "text", "text": "suelto"}),
        doc({"type": "paragraph", "content": [p("x")]}),
        doc(p("x", [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}])),
        doc(p("x", [{"type": "link", "attrs": {"href": "data:text/html,hi"}}])),
        doc(p("x", [{"type": "link", "attrs": {"href": "https://ok.com", "onclick": "x"}}])),
        doc(p("x", [{"type": "bold", "attrs": {"x": 1}}])),
    ],
)
def test_whitelist_rejects_the_rest(user_client, bad):
    r = user_client.post("/api/notes", json={"content": bad})
    assert r.status_code == 422, bad
    assert r.json()["error_code"] == "VALIDATION_ERROR"
    assert r.json()["detail"]["field"] == "content"


def test_whitelist_accepts_the_editor_output(user_client):
    link = {
        "type": "link",
        "attrs": {"href": "https://example.com", "target": "_blank", "rel": "noopener noreferrer nofollow", "class": None, "title": None},
    }
    content = doc(
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Título"}]},
        {"type": "paragraph", "content": [
            {"type": "text", "text": "a", "marks": [{"type": "bold"}, {"type": "italic"}, {"type": "underline"}, {"type": "strike"}]},
            {"type": "hardBreak"},
            {"type": "text", "text": "web", "marks": [link]},
            {"type": "text", "text": "correo", "marks": [{"type": "link", "attrs": {"href": "mailto:a@b.co"}}]},
        ]},
        {"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": False}, "content": [
            p("padre"),
            {"type": "taskList", "content": [task("hijo", True)]},
        ]}]},
    )
    r = user_client.post("/api/notes", json={"content": content})
    assert r.status_code == 201, r.text
    assert r.json()["title"] == "Título"


def test_size_limit(user_client):
    big = doc(p("Grande"), *[p("x" * 1000) for _ in range(210)])
    r = user_client.post("/api/notes", json={"content": big})
    assert r.status_code == 422
    assert "200 KB" in r.json()["message"]


def test_depth_limit(user_client):
    node = p("hondo")
    for _ in range(30):
        node = {"type": "blockquote", "content": [node]}
    assert user_client.post("/api/notes", json={"content": doc(node)}).status_code == 422


def test_note_limit(user_client, monkeypatch):
    monkeypatch.setattr(service, "MAX_NOTES", 2)
    assert add(user_client, p("1")).status_code == 201
    assert add(user_client, p("2")).status_code == 201
    r = add(user_client, p("3"))
    assert r.status_code == 409
    assert r.json()["error_code"] == "NOTE_LIMIT"


def test_isolation_between_users(user_client):
    note = add(user_client, p("Secreto")).json()
    with TestClient(app) as other:
        assert register(other, username="sol", name="Sol").status_code == 201
        assert other.get("/api/notes").json() == []
        assert other.get("/api/notes", params={"q": "secreto"}).json() == []
        for method, kwargs in (
            ("get", {}),
            ("patch", {"json": {"pinned": True}}),
            ("delete", {}),
        ):
            r = getattr(other, method)(f"/api/notes/{note['id']}", **kwargs)
            assert r.status_code == 404
            assert r.json()["error_code"] == "NOTE_NOT_FOUND"
        add(other, p("Mía"))
    assert [n["title"] for n in user_client.get("/api/notes").json()] == ["Secreto"]
    assert user_client.get(f"/api/notes/{note['id']}").json()["pinned"] is False
