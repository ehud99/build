"""
La escena de una pizarra de Excalidraw: `elements`, `app_state`, `files` y la miniatura, validados
con una lista blanca (docs/contrato-pizarra.md).

El contenido es solo datos validados, nunca HTML: Excalidraw dibuja los elementos en un canvas, pero
un tipo `embeddable` o `iframe` cargaría una página ajena, un `link` con `javascript:` se abriría al
tocarlo y un SVG como imagen puede llevar código. Por eso:

- `type` de cada elemento en `ELEMENT_TYPES` (sin `embeddable` ni `iframe`).
- `link` solo `http(s)` o `mailto`.
- Imágenes (`files`) solo PNG, JPEG, WebP o GIF como `dataURL` en base64, con la firma del archivo
  que corresponde a su tipo.
- La miniatura, PNG o WebP (también por su firma), hasta `THUMBNAIL_MAX_BYTES`.
- Claves con forma de identificador, números finitos y textos y anidación con tope.

Los elementos borrados (`isDeleted`) se descartan y de `files` quedan solo los que usa una imagen.
Un dato mal formado es 422 `VALIDATION_ERROR` con `detail.field`; pasar un tope de tamaño o de
elementos es 409.
"""
import base64
import binascii
import json
import math
import re
from typing import Any, Optional
from urllib.parse import urlparse

from app.errors import ApiError

ELEMENT_TYPES = {
    "rectangle",
    "diamond",
    "ellipse",
    "arrow",
    "line",
    "freedraw",
    "text",
    "image",
    "frame",
    "magicframe",
}
LINK_SCHEMES = {"http", "https", "mailto"}
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
THUMBNAIL_TYPES = {"image/png", "image/webp"}

MAX_BYTES = 5 * 1024 * 1024  # elementos + imágenes, en JSON compacto
MAX_ELEMENTS = 10000
THUMBNAIL_MAX_BYTES = 96 * 1024
MAX_DEPTH = 6
MAX_STRING = 100_000
LINK_MAX = 2000
ID_MAX = 100

KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
FILE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{3,8}|transparent)$")
DATA_URL_RE = re.compile(r"^data:(image/[a-z+.-]+);base64,([A-Za-z0-9+/]*={0,2})$")


def _fail(field: str, message: str) -> None:
    raise ApiError(422, message, "VALIDATION_ERROR", {"field": field})


def _is_number(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _check_json(value: Any, field: str, depth: int) -> None:
    """JSON plano y acotado: claves con forma de identificador, números finitos, textos con tope."""
    if depth > MAX_DEPTH:
        _fail(field, "La pizarra tiene datos demasiado anidados.")
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str) or not KEY_RE.match(key):
                _fail(field, "La pizarra tiene una clave no válida.")
            _check_json(child, field, depth + 1)
    elif isinstance(value, list):
        for child in value:
            _check_json(child, field, depth + 1)
    elif isinstance(value, str):
        if len(value) > MAX_STRING:
            _fail(field, "La pizarra tiene un texto demasiado largo.")
    elif isinstance(value, bool) or value is None:
        return
    elif isinstance(value, (int, float)):
        if not math.isfinite(value):
            _fail(field, "La pizarra tiene un número no válido.")
    else:
        _fail(field, "La pizarra no es válida.")


def check_link(value: Any, field: str = "elements") -> None:
    """`None` o un enlace `http(s)`/`mailto` de hasta 2000 caracteres."""
    if value is None:
        return
    if not isinstance(value, str) or len(value) > LINK_MAX:
        _fail(field, "El enlace no es válido.")
    if not value.strip():
        return
    scheme = urlparse(value.strip()).scheme.lower()
    if scheme not in LINK_SCHEMES:
        _fail(field, "Los enlaces solo pueden ser http, https o mailto.")


def _sniff(data: bytes) -> Optional[str]:
    """El tipo de imagen según los primeros bytes (la firma), o `None`."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def decode_data_url(value: Any, allowed: set[str], field: str) -> tuple[str, bytes]:
    """`(mime, bytes)` de un `data:<mime>;base64,…` cuyo tipo está en `allowed` y coincide con su firma."""
    if not isinstance(value, str):
        _fail(field, "La imagen no es válida.")
    match = DATA_URL_RE.match(value)
    if not match:
        _fail(field, "La imagen debe ir como data URL en base64.")
    mime = match.group(1)
    if mime not in allowed:
        _fail(field, "Solo se aceptan imágenes " + ", ".join(sorted(t.split("/")[1].upper() for t in allowed)) + ".")
    try:
        data = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError):
        _fail(field, "La imagen no es válida.")
    if _sniff(data) != mime:
        _fail(field, "El contenido de la imagen no coincide con su tipo.")
    return mime, data


def validate_elements(elements: Any) -> list[dict]:
    """Los elementos vivos (sin los borrados) si cumplen la lista blanca; si no, 422."""
    if not isinstance(elements, list):
        _fail("elements", "Los elementos de la pizarra no son válidos.")
    alive: list[dict] = []
    seen: set[str] = set()
    for element in elements:
        if not isinstance(element, dict):
            _fail("elements", "Un elemento de la pizarra no es válido.")
        if element.get("isDeleted") is True:
            continue
        kind = element.get("type")
        if kind not in ELEMENT_TYPES:
            _fail("elements", f"Tipo de elemento no permitido: {kind}.")
        element_id = element.get("id")
        if not isinstance(element_id, str) or not 0 < len(element_id) <= ID_MAX:
            _fail("elements", "Un elemento de la pizarra no tiene un id válido.")
        if element_id in seen:
            _fail("elements", "Hay dos elementos con el mismo id.")
        seen.add(element_id)
        for key in ("x", "y", "width", "height"):
            if key in element and not _is_number(element[key]):
                _fail("elements", "Un elemento de la pizarra tiene una posición no válida.")
        check_link(element.get("link"))
        if kind == "image":
            file_id = element.get("fileId")
            if file_id is not None and (not isinstance(file_id, str) or not FILE_ID_RE.match(file_id)):
                _fail("elements", "Una imagen de la pizarra no es válida.")
        _check_json(element, "elements", 0)
        alive.append(element)
    if len(alive) > MAX_ELEMENTS:
        raise ApiError(
            409,
            f"La pizarra tiene demasiados elementos (máximo {MAX_ELEMENTS}).",
            "WHITEBOARD_TOO_MANY_ELEMENTS",
            {"max": MAX_ELEMENTS},
        )
    return alive


def _int_in(value: Any, low: int, high: int) -> bool:
    return type(value) is int and low <= value <= high


def validate_app_state(state: Any) -> dict:
    """Solo lo que vale la pena guardar de la vista: fondo, cuadrícula, zoom y desplazamiento."""
    if not isinstance(state, dict):
        _fail("app_state", "El estado de la pizarra no es válido.")
    out: dict[str, Any] = {}
    for key, value in state.items():
        if key == "viewBackgroundColor":
            if not isinstance(value, str) or not COLOR_RE.match(value):
                _fail("app_state", "El color de fondo no es válido.")
        elif key == "gridSize":
            if not _int_in(value, 1, 100):
                _fail("app_state", "El tamaño de la cuadrícula no es válido.")
        elif key == "gridStep":
            if not _int_in(value, 1, 100):
                _fail("app_state", "El paso de la cuadrícula no es válido.")
        elif key == "gridModeEnabled":
            if type(value) is not bool:
                _fail("app_state", "La cuadrícula va encendida o apagada.")
        elif key == "zoom":
            if not isinstance(value, dict) or set(value) != {"value"} or not _is_number(value["value"]):
                _fail("app_state", "El zoom no es válido.")
            if not 0.05 <= value["value"] <= 40:
                _fail("app_state", "El zoom no es válido.")
        elif key in ("scrollX", "scrollY"):
            if not _is_number(value) or abs(value) > 1e9:
                _fail("app_state", "El desplazamiento no es válido.")
        else:
            _fail("app_state", f"Dato de la vista no permitido: {key}.")
        out[key] = value
    return out


def validate_files(files: Any) -> dict:
    """Las imágenes de la pizarra: `{id: {id, mimeType, dataURL, created, lastRetrieved?, version?}}`."""
    if not isinstance(files, dict):
        _fail("files", "Las imágenes de la pizarra no son válidas.")
    out: dict[str, dict] = {}
    for file_id, entry in files.items():
        if not isinstance(file_id, str) or not FILE_ID_RE.match(file_id):
            _fail("files", "Una imagen de la pizarra no tiene un id válido.")
        if not isinstance(entry, dict) or entry.get("id") != file_id:
            _fail("files", "Una imagen de la pizarra no es válida.")
        extra = set(entry) - {"id", "mimeType", "dataURL", "created", "lastRetrieved", "version"}
        if extra:
            _fail("files", f"Dato de la imagen no permitido: {sorted(extra)[0]}.")
        mime = entry.get("mimeType")
        if mime not in IMAGE_TYPES:
            _fail("files", "Solo se aceptan imágenes PNG, JPEG, WebP o GIF.")
        data_mime, _ = decode_data_url(entry.get("dataURL"), IMAGE_TYPES, "files")
        if data_mime != mime:
            _fail("files", "El tipo de la imagen no coincide con su contenido.")
        for key in ("created", "lastRetrieved"):
            if key in entry and entry[key] is not None and not _is_number(entry[key]):
                _fail("files", "Una imagen de la pizarra no es válida.")
        if "version" in entry and entry["version"] is not None and not _int_in(entry["version"], 0, 10**9):
            _fail("files", "Una imagen de la pizarra no es válida.")
        out[file_id] = entry
    return out


def referenced_files(elements: list[dict], files: dict) -> dict:
    """Solo las imágenes que usa algún elemento `image` de la escena."""
    used = {e.get("fileId") for e in elements if e.get("type") == "image"}
    return {k: v for k, v in files.items() if k in used}


def json_size(value: Any) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def check_size(elements: list[dict], files: dict) -> int:
    """El tamaño de la escena en bytes; 409 `WHITEBOARD_TOO_LARGE` si pasa de 5 MB."""
    size = json_size(elements) + json_size(files)
    if size > MAX_BYTES:
        raise ApiError(
            409,
            "La pizarra es demasiado grande (máximo 5 MB con imágenes).",
            "WHITEBOARD_TOO_LARGE",
            {"max_bytes": MAX_BYTES},
        )
    return size


def validate_thumbnail(value: Any) -> tuple[str, bytes]:
    """`(mime, bytes)` de la miniatura (PNG o WebP de hasta 96 KB)."""
    mime, data = decode_data_url(value, THUMBNAIL_TYPES, "thumbnail")
    if len(data) > THUMBNAIL_MAX_BYTES:
        _fail("thumbnail", "La miniatura es demasiado grande.")
    return mime, data
