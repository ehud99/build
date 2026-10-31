"""
El contenido de una nota: un documento de Tiptap (JSON) que se valida con una lista blanca y del
que se derivan el título, el texto plano y la vista previa de la card (docs/contrato-notas.md).

El contenido es solo datos validados, nunca HTML: cualquier nodo, marca, atributo o clave fuera
de la lista blanca se rechaza con 422 `VALIDATION_ERROR` (`detail.field` = `content`).
"""
import json
from typing import Any, Optional
from urllib.parse import urlparse

from app.errors import ApiError

MAX_BYTES = 200 * 1024
MAX_DEPTH = 24
TITLE_MAX = 200
PREVIEW_LINES = 10
PREVIEW_TEXT = 240

# Hijos permitidos de cada nodo (`None`: nodo de texto u hoja sin hijos).
BLOCKS = {"paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "horizontalRule"}
INLINE = {"text", "hardBreak"}
CHILDREN: dict[str, Optional[set[str]]] = {
    "doc": BLOCKS,
    "paragraph": INLINE,
    "heading": INLINE,
    "blockquote": BLOCKS,
    "bulletList": {"listItem"},
    "orderedList": {"listItem"},
    "taskList": {"taskItem"},
    "listItem": BLOCKS,
    "taskItem": BLOCKS,
    "text": None,
    "hardBreak": None,
    "horizontalRule": None,
}
MARKS = {"bold", "italic", "underline", "strike", "link"}
LINK_SCHEMES = {"http", "https", "mailto"}
LINK_ATTRS = {"href", "target", "rel", "class", "title"}


def _fail(message: str) -> None:
    raise ApiError(422, message, "VALIDATION_ERROR", {"field": "content"})


def _check_attrs(node_type: str, attrs: Any) -> None:
    if attrs is None:
        return
    if not isinstance(attrs, dict):
        _fail("Los atributos de la nota no son válidos.")
    allowed: set[str] = set()
    if node_type == "heading":
        level = attrs.get("level")
        if type(level) is not int or level not in (1, 2, 3):
            _fail("El encabezado va de nivel 1 a 3.")
        allowed = {"level"}
    elif node_type == "orderedList":
        start = attrs.get("start", 1)
        if type(start) is not int or not 0 <= start <= 100000:
            _fail("La lista numerada no es válida.")
        kind = attrs.get("type")
        if kind is not None and kind not in ("1", "a", "A", "i", "I"):
            _fail("La lista numerada no es válida.")
        allowed = {"start", "type"}
    elif node_type == "taskItem":
        if type(attrs.get("checked")) is not bool:
            _fail("La casilla de la lista va marcada o no.")
        allowed = {"checked"}
    extra = set(attrs) - allowed
    if extra:
        _fail(f"Atributo no permitido: {sorted(extra)[0]}.")


def _check_link(attrs: Any) -> None:
    if not isinstance(attrs, dict) or set(attrs) - LINK_ATTRS:
        _fail("El enlace no es válido.")
    href = attrs.get("href")
    if not isinstance(href, str) or len(href) > 2000:
        _fail("El enlace no es válido.")
    scheme = urlparse(href.strip()).scheme.lower()
    if scheme not in LINK_SCHEMES:
        _fail("Los enlaces solo pueden ser http, https o mailto.")
    for key in ("target", "rel", "class", "title"):
        value = attrs.get(key)
        if value is not None and (not isinstance(value, str) or len(value) > 200):
            _fail("El enlace no es válido.")


def _check_marks(marks: Any) -> None:
    if not isinstance(marks, list):
        _fail("Las marcas del texto no son válidas.")
    for mark in marks:
        if not isinstance(mark, dict) or set(mark) - {"type", "attrs"}:
            _fail("Las marcas del texto no son válidas.")
        kind = mark.get("type")
        if kind not in MARKS:
            _fail(f"Formato no permitido: {kind}.")
        if kind == "link":
            _check_link(mark.get("attrs"))
        elif mark.get("attrs") not in (None, {}):
            _fail("Las marcas del texto no son válidas.")


def _check_node(node: Any, allowed: set[str], depth: int) -> None:
    if depth > MAX_DEPTH:
        _fail("La nota tiene demasiados niveles.")
    if not isinstance(node, dict):
        _fail("La nota no es válida.")
    kind = node.get("type")
    if kind not in allowed:
        _fail(f"Bloque no permitido: {kind}.")
    keys = set(node) - {"type"}
    if kind == "text":
        if keys - {"text", "marks"}:
            _fail("El texto de la nota no es válido.")
        text = node.get("text")
        if not isinstance(text, str) or not text:
            _fail("El texto de la nota no es válido.")
        if "marks" in node:
            _check_marks(node["marks"])
        return
    if keys - {"attrs", "content"}:
        _fail("La nota no es válida.")
    _check_attrs(kind, node.get("attrs"))
    if kind in ("taskItem", "heading") and node.get("attrs") is None:
        _fail("La casilla o el encabezado no son válidos.")
    children = node.get("content")
    if children is None:
        return
    child_types = CHILDREN[kind]
    if child_types is None or not isinstance(children, list):
        _fail("La nota no es válida.")
    for child in children:
        _check_node(child, child_types, depth + 1)


def validate(doc: Any) -> dict:
    """El documento tal cual si cumple la lista blanca y el tope de tamaño; si no, 422."""
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        _fail("La nota no es válida.")
    size = len(json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode())
    if size > MAX_BYTES:
        _fail("La nota es demasiado larga (máximo 200 KB).")
    _check_node(doc, {"doc"}, 0)
    return doc


# --- Derivados -----------------------------------------------------------------------------


def _inline_text(node: dict, sep: str) -> str:
    parts = []
    for child in node.get("content") or []:
        if child["type"] == "text":
            parts.append(child["text"])
        elif child["type"] == "hardBreak":
            parts.append(sep)
    return "".join(parts)


def _lines(node: dict, kind: Optional[str], depth: int, out: list[dict], extra: Optional[dict] = None) -> None:
    """Aplana el documento en líneas `{kind, text, depth, …}` en el orden en que se leen."""
    t = node["type"]
    if t in ("paragraph", "heading"):
        line = {"kind": kind or ("heading" if t == "heading" else "text"), "depth": depth}
        line["text"] = _inline_text(node, "\n")
        if t == "heading" and not kind:
            line["level"] = node["attrs"]["level"]
        if extra:
            line.update(extra)
        out.append(line)
    elif t == "horizontalRule":
        out.append({"kind": "rule", "text": "", "depth": depth})
    elif t == "blockquote":
        for child in node.get("content") or []:
            _lines(child, "quote", depth, out)
    elif t in ("bulletList", "orderedList", "taskList"):
        start = (node.get("attrs") or {}).get("start", 1) if t == "orderedList" else 1
        for i, item in enumerate(node.get("content") or []):
            if t == "taskList":
                head = {"kind": "task", "extra": {"checked": item["attrs"]["checked"]}}
            elif t == "orderedList":
                head = {"kind": "ordered", "extra": {"n": start + i}}
            else:
                head = {"kind": "bullet", "extra": None}
            for j, child in enumerate(item.get("content") or []):
                if j == 0 and child["type"] in ("paragraph", "heading"):
                    _lines(child, head["kind"], depth, out, head["extra"])
                else:
                    _lines(child, None if child["type"] in ("paragraph", "heading") else kind, depth + 1, out)


def derive(doc: dict) -> dict:
    """`title`, `plain` y `preview` (`{lines, more}`) de un documento ya validado.

    - `title`: la primera línea con texto (hasta 200 caracteres, sin saltos).
    - `plain`: todas las líneas, una por renglón (para buscar).
    - `preview`: las líneas que siguen al título (sin líneas vacías repetidas ni al principio),
      hasta 10 y cada una hasta 240 caracteres; `more` cuenta las líneas con texto que no entran.
    """
    lines: list[dict] = []
    for block in doc.get("content") or []:
        _lines(block, None, 0, lines)
    plain = "\n".join(line["text"] for line in lines).strip()
    title_index = next((i for i, line in enumerate(lines) if line["text"].strip()), None)
    title = ""
    rest: list[dict] = []
    if title_index is not None:
        title = " ".join(lines[title_index]["text"].split())[:TITLE_MAX]
        rest = lines[title_index + 1 :]
    body: list[dict] = []
    for line in rest:
        empty = not line["text"].strip() and line["kind"] in ("text", "quote")
        if empty and (not body or body[-1].get("empty")):
            continue
        item = dict(line)
        item["text"] = " ".join(line["text"].split())[:PREVIEW_TEXT]
        if empty:
            item["empty"] = True
        body.append(item)
    while body and body[-1].get("empty"):
        body.pop()
    shown = body[:PREVIEW_LINES]
    more = sum(1 for line in body[PREVIEW_LINES:] if line["text"] or line["kind"] == "task")
    for line in shown:
        line.pop("empty", None)
    return {"title": title, "plain": plain, "preview": {"lines": shown, "more": more}}
