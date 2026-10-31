"""Pizarra (docs/contrato-pizarra.md): CRUD, miniatura, lista blanca, archivos, topes, duplicar y aislamiento."""
import base64
import struct
import zlib

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.whiteboard import scene, service
from tests.conftest import register


def png_bytes(width=1, height=1) -> bytes:
    """Un PNG real y mínimo (gris)."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + b"\x80" * width for _ in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def data_url(mime: str, data: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


PNG_URL = data_url("image/png", png_bytes())
JPEG_URL = data_url("image/jpeg", b"\xff\xd8\xff\xe0" + b"\x00" * 20)
GIF_URL = data_url("image/gif", b"GIF89a" + b"\x00" * 20)
WEBP_URL = data_url("image/webp", b"RIFF\x10\x00\x00\x00WEBPVP8 " + b"\x00" * 8)


def el(kind="rectangle", eid="a", **extra):
    base = {
        "id": eid,
        "type": kind,
        "x": 10,
        "y": 20.5,
        "width": 100,
        "height": 50,
        "angle": 0,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 2,
        "roughness": 1,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "index": "a0",
        "roundness": {"type": 3},
        "seed": 123,
        "version": 3,
        "versionNonce": 456,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1761900000000,
        "link": None,
        "locked": False,
    }
    base.update(extra)
    return base


def text_el(eid="t", text="Hola"):
    return el(
        "text",
        eid,
        text=text,
        originalText=text,
        fontSize=20,
        fontFamily=5,
        textAlign="left",
        verticalAlign="top",
        containerId=None,
        autoResize=True,
        lineHeight=1.25,
    )


def image_el(eid="img", file_id="f1"):
    return el("image", eid, fileId=file_id, status="saved", scale=[1, 1], crop=None)


def file_entry(file_id="f1", url=PNG_URL, mime="image/png"):
    return {"id": file_id, "mimeType": mime, "dataURL": url, "created": 1761900000000, "lastRetrieved": 1761900000000}


def create(client, **body):
    return client.post("/api/whiteboards", json=body)


def assert_422(r, field):
    assert r.status_code == 422, r.text
    assert r.json()["error_code"] == "VALIDATION_ERROR"
    assert r.json()["detail"]["field"] == field


def test_needs_session(client):
    assert client.get("/api/whiteboards").status_code == 401
    assert client.post("/api/whiteboards", json={}).status_code == 401
    assert client.get("/api/whiteboards/1").status_code == 401


def test_create_empty_with_default_name(user_client):
    r = create(user_client)
    assert r.status_code == 201, r.text
    board = r.json()
    assert board["name"] == "Sin título"
    assert board["elements"] == [] and board["files"] == {} and board["app_state"] == {}
    assert board["element_count"] == 0
    assert board["thumbnail_url"] is None
    assert board["created_at"] == board["updated_at"]


def test_create_get_patch_and_delete(user_client):
    board = create(
        user_client,
        name="  Ideas   del  mes ",
        elements=[el(), text_el(), el("arrow", "ar", points=[[0, 0], [10, 10]], endArrowhead="arrow")],
        app_state={"viewBackgroundColor": "#ffffff", "gridSize": 20, "gridModeEnabled": True, "zoom": {"value": 1.5}, "scrollX": -20, "scrollY": 4.5},
    ).json()
    assert board["name"] == "Ideas del mes"
    assert board["element_count"] == 3
    assert board["app_state"]["zoom"] == {"value": 1.5}

    r = user_client.get(f"/api/whiteboards/{board['id']}")
    assert r.status_code == 200
    assert [e["id"] for e in r.json()["elements"]] == ["a", "t", "ar"]
    assert r.json()["elements"][1]["text"] == "Hola"

    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"elements": [el(), el("ellipse", "e")]})
    assert r.status_code == 200
    assert r.json()["element_count"] == 2
    assert r.json()["name"] == "Ideas del mes"
    assert r.json()["app_state"]["gridSize"] == 20  # lo que no se manda se conserva
    assert r.json()["updated_at"] > board["updated_at"]

    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"name": "Otra"})
    assert r.json()["name"] == "Otra" and r.json()["element_count"] == 2

    assert user_client.delete(f"/api/whiteboards/{board['id']}").status_code == 204
    r = user_client.get(f"/api/whiteboards/{board['id']}")
    assert r.status_code == 404 and r.json()["error_code"] == "WHITEBOARD_NOT_FOUND"
    assert user_client.delete(f"/api/whiteboards/{board['id']}").status_code == 404


def test_deleted_elements_are_dropped(user_client):
    board = create(user_client, elements=[el(), el(eid="b", isDeleted=True)]).json()
    assert [e["id"] for e in board["elements"]] == ["a"]
    assert board["element_count"] == 1


def test_list_is_light_and_ordered_by_last_edit(user_client):
    a = create(user_client, name="A", elements=[el()]).json()
    create(user_client, name="B")
    create(user_client, name="C")
    user_client.patch(f"/api/whiteboards/{a['id']}", json={"elements": [el(), el(eid="z")]})
    boards = user_client.get("/api/whiteboards").json()
    assert [b["name"] for b in boards] == ["A", "C", "B"]
    assert "elements" not in boards[0] and "files" not in boards[0]
    assert boards[0]["element_count"] == 2


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_name_rules(user_client, name):
    assert_422(create(user_client, name=name), "name")
    board = create(user_client).json()
    assert_422(user_client.patch(f"/api/whiteboards/{board['id']}", json={"name": name}), "name")


def test_name_must_be_text(user_client):
    board = create(user_client).json()
    assert_422(user_client.patch(f"/api/whiteboards/{board['id']}", json={"name": None}), "name")
    assert_422(user_client.patch(f"/api/whiteboards/{board['id']}", json={"name": 5}), "name")
    assert create(user_client, name="x" * 80).status_code == 201


@pytest.mark.parametrize("kind", sorted(scene.ELEMENT_TYPES))
def test_whitelisted_types_are_accepted(user_client, kind):
    assert create(user_client, elements=[el(kind)]).status_code == 201


@pytest.mark.parametrize("kind", ["embeddable", "iframe", "selection", "html", None, 3])
def test_other_types_are_rejected(user_client, kind):
    r = create(user_client, elements=[el(kind, link="https://www.youtube.com/embed/x")])
    assert_422(r, "elements")


def test_embeddable_is_rejected_on_patch_too(user_client):
    board = create(user_client, elements=[el()]).json()
    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"elements": [el(), el("embeddable", "emb")]})
    assert_422(r, "elements")
    assert user_client.get(f"/api/whiteboards/{board['id']}").json()["element_count"] == 1


@pytest.mark.parametrize("link", ["https://example.com/x?y=1", "http://a.b", "mailto:a@b.co", None, ""])
def test_links_allowed(user_client, link):
    assert create(user_client, elements=[el(link=link)]).status_code == 201


@pytest.mark.parametrize("link", ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "vbscript:x", 5, "https://x/" + "a" * 2000])
def test_links_rejected(user_client, link):
    assert_422(create(user_client, elements=[el(link=link)]), "elements")


@pytest.mark.parametrize(
    "bad",
    [
        "no es una lista",
        [5],
        [el(id="")],
        [el(id=7)],
        [el(), el()],  # id repetido
        [el(x="10")],
        [el(**{"on-click": "x"})],
        [el(**{"__proto__x": 1, "1bad": 2})],
        [el(customData={"a": {"b": {"c": {"d": {"e": {"f": 1}}}}}})],
        [el(text="x" * 100_001)],
        [image_el(file_id="../../etc")],
    ],
)
def test_bad_elements(user_client, bad):
    assert_422(create(user_client, elements=bad), "elements")


def test_non_finite_numbers_are_rejected(user_client):
    r = user_client.post(
        "/api/whiteboards",
        content='{"elements": [{"id": "a", "type": "rectangle", "x": NaN, "y": 0}]}',
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 422


@pytest.mark.parametrize(
    "state",
    [
        {"theme": "dark"},
        {"viewBackgroundColor": "red; background:url(x)"},
        {"viewBackgroundColor": 3},
        {"gridSize": 0},
        {"gridSize": 1.5},
        {"gridModeEnabled": "yes"},
        {"zoom": 2},
        {"zoom": {"value": 500}},
        {"zoom": {"value": 1, "x": 1}},
        {"scrollX": "1"},
        {"scrollY": 1e12},
        "nada",
    ],
)
def test_app_state_whitelist(user_client, state):
    assert_422(create(user_client, app_state=state), "app_state")


def test_app_state_accepts_transparent_and_short_hex(user_client):
    for color in ("transparent", "#fff", "#ffffff80"):
        assert create(user_client, app_state={"viewBackgroundColor": color, "gridStep": 5}).status_code == 201


def test_files_allowed_types_and_pruning(user_client):
    files = {
        "f1": file_entry("f1", PNG_URL, "image/png"),
        "f2": file_entry("f2", JPEG_URL, "image/jpeg"),
        "f3": file_entry("f3", GIF_URL, "image/gif"),
        "f4": file_entry("f4", WEBP_URL, "image/webp"),
        "unused": file_entry("unused", PNG_URL, "image/png"),
    }
    elements = [image_el("i1", "f1"), image_el("i2", "f2"), image_el("i3", "f3"), image_el("i4", "f4")]
    board = create(user_client, elements=elements, files=files).json()
    assert sorted(board["files"]) == ["f1", "f2", "f3", "f4"]  # la que no se usa no se guarda
    assert board["files"]["f1"]["dataURL"] == PNG_URL

    # Quitar la imagen de la escena (sin mandar `files`) también quita su archivo.
    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"elements": elements[:1]})
    assert sorted(r.json()["files"]) == ["f1"]

    # Mandar solo `files` los valida contra la escena guardada.
    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"files": {"f1": file_entry(), "x": file_entry("x")}})
    assert sorted(r.json()["files"]) == ["f1"]


SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


@pytest.mark.parametrize(
    "entry",
    [
        file_entry(mime="image/svg+xml", url=data_url("image/svg+xml", SVG)),
        file_entry(mime="image/png", url=data_url("image/svg+xml", SVG)),
        file_entry(mime="image/png", url=data_url("image/png", SVG)),  # firma que no es PNG
        file_entry(mime="image/png", url=JPEG_URL),  # el tipo no coincide
        file_entry(mime="image/png", url="https://example.com/a.png"),
        file_entry(mime="image/png", url="data:image/png;base64,@@@"),
        file_entry(mime="text/html", url=data_url("text/html", b"<b>x</b>")),
        {**file_entry(), "id": "otro"},
        {**file_entry(), "onload": "x"},
        {**file_entry(), "created": "ayer"},
    ],
)
def test_bad_files(user_client, entry):
    assert_422(create(user_client, elements=[image_el()], files={"f1": entry}), "files")


def test_size_limit(user_client, monkeypatch):
    monkeypatch.setattr(scene, "MAX_BYTES", 4000)
    board = create(user_client, elements=[el()]).json()
    big = [el(eid=str(i), text="x" * 300) for i in range(20)]
    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"elements": big})
    assert r.status_code == 409
    assert r.json()["error_code"] == "WHITEBOARD_TOO_LARGE"
    assert user_client.get(f"/api/whiteboards/{board['id']}").json()["element_count"] == 1


def test_real_size_limit_counts_images(user_client):
    # ~5,3 MB de imagen en base64 sobrepasa los 5 MB aunque cada parte sea válida.
    payload = png_bytes() + b"\x00" * (4 * 1024 * 1024)
    files = {"f1": file_entry(url=data_url("image/png", payload))}
    r = create(user_client, elements=[image_el()], files=files)
    assert r.status_code == 409 and r.json()["error_code"] == "WHITEBOARD_TOO_LARGE"


def test_element_limit(user_client, monkeypatch):
    monkeypatch.setattr(scene, "MAX_ELEMENTS", 3)
    assert create(user_client, elements=[el(eid=str(i)) for i in range(3)]).status_code == 201
    r = create(user_client, elements=[el(eid=str(i)) for i in range(4)])
    assert r.status_code == 409
    assert r.json()["error_code"] == "WHITEBOARD_TOO_MANY_ELEMENTS"


def test_board_limit(user_client, monkeypatch):
    monkeypatch.setattr(service, "MAX_WHITEBOARDS", 2)
    first = create(user_client).json()
    assert create(user_client).status_code == 201
    r = create(user_client)
    assert r.status_code == 409 and r.json()["error_code"] == "WHITEBOARD_LIMIT"
    r = user_client.post(f"/api/whiteboards/{first['id']}/duplicate")
    assert r.status_code == 409 and r.json()["error_code"] == "WHITEBOARD_LIMIT"


def test_thumbnail_roundtrip(user_client):
    board = create(user_client, elements=[el()]).json()
    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"thumbnail": PNG_URL})
    assert r.status_code == 200
    url = r.json()["thumbnail_url"]
    assert url.startswith(f"/api/whiteboards/{board['id']}/thumbnail?v=")
    img = user_client.get(url)
    assert img.status_code == 200
    assert img.headers["content-type"] == "image/png"
    assert img.headers["x-content-type-options"] == "nosniff"
    assert img.content == png_bytes()
    assert user_client.get("/api/whiteboards").json()[0]["thumbnail_url"] == url

    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"thumbnail": WEBP_URL})
    assert user_client.get(r.json()["thumbnail_url"]).headers["content-type"] == "image/webp"

    r = user_client.patch(f"/api/whiteboards/{board['id']}", json={"thumbnail": None})
    assert r.json()["thumbnail_url"] is None
    r = user_client.get(f"/api/whiteboards/{board['id']}/thumbnail")
    assert r.status_code == 404 and r.json()["error_code"] == "THUMBNAIL_NOT_FOUND"


@pytest.mark.parametrize(
    "thumb",
    [
        data_url("image/svg+xml", SVG),
        JPEG_URL,  # solo PNG o WebP
        data_url("image/png", b"<html>"),
        data_url("image/png", png_bytes() + b"\x00" * (97 * 1024)),
        "https://example.com/x.png",
        5,
    ],
)
def test_bad_thumbnails(user_client, thumb):
    board = create(user_client).json()
    assert_422(user_client.patch(f"/api/whiteboards/{board['id']}", json={"thumbnail": thumb}), "thumbnail")


def test_duplicate_copies_everything(user_client):
    board = create(
        user_client,
        name="Plano",
        elements=[el(), image_el()],
        files={"f1": file_entry()},
        app_state={"viewBackgroundColor": "#fff"},
    ).json()
    user_client.patch(f"/api/whiteboards/{board['id']}", json={"thumbnail": PNG_URL})
    r = user_client.post(f"/api/whiteboards/{board['id']}/duplicate")
    assert r.status_code == 201
    copy = r.json()
    assert copy["id"] != board["id"]
    assert copy["name"] == "Copia de Plano"
    assert copy["elements"] == user_client.get(f"/api/whiteboards/{board['id']}").json()["elements"]
    assert sorted(copy["files"]) == ["f1"]
    assert copy["app_state"] == {"viewBackgroundColor": "#fff"}
    assert user_client.get(copy["thumbnail_url"]).content == png_bytes()
    assert [b["name"] for b in user_client.get("/api/whiteboards").json()][0] == "Copia de Plano"

    # Cambiar la copia no toca la original.
    user_client.patch(f"/api/whiteboards/{copy['id']}", json={"elements": []})
    assert user_client.get(f"/api/whiteboards/{board['id']}").json()["element_count"] == 2

    long = create(user_client, name="y" * 80).json()
    assert len(user_client.post(f"/api/whiteboards/{long['id']}/duplicate").json()["name"]) == 80


def test_isolation_between_users(user_client):
    board = create(user_client, name="Secreta", elements=[el()]).json()
    user_client.patch(f"/api/whiteboards/{board['id']}", json={"thumbnail": PNG_URL})
    with TestClient(app) as other:
        assert register(other, username="sol", name="Sol").status_code == 201
        assert other.get("/api/whiteboards").json() == []
        for method, path, kwargs in (
            ("get", "", {}),
            ("get", "/thumbnail", {}),
            ("patch", "", {"json": {"name": "Mía"}}),
            ("post", "/duplicate", {}),
            ("delete", "", {}),
        ):
            r = getattr(other, method)(f"/api/whiteboards/{board['id']}{path}", **kwargs)
            assert r.status_code == 404, (method, path)
            assert r.json()["error_code"] == "WHITEBOARD_NOT_FOUND"
        assert other.get("/api/whiteboards").json() == []
    assert user_client.get(f"/api/whiteboards/{board['id']}").json()["name"] == "Secreta"
    assert len(user_client.get("/api/whiteboards").json()) == 1
