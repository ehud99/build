"""
Notas de un usuario (docs/contrato-notas.md).

- Cada usuario ve solo las suyas: la nota de otro responde 404 `NOTE_NOT_FOUND`.
- Hasta `MAX_NOTES` notas por usuario (409 `NOTE_LIMIT`).
- `title`, `plain` y `preview` se derivan del contenido al guardar (`content.derive`).
- Solo un cambio de `content` mueve `updated_at` (fijar o cambiar el color no la «edita»,
  como en Keep): la lista se ordena por fijadas y luego por la última edición.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import User
from app.modules.notes import content as note_content
from app.modules.notes.models import Note

MAX_NOTES = 2000
COLORS = ("default", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown", "gray")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def summary_out(note: Note) -> dict:
    """Lo que necesita la card (sin el documento completo)."""
    return {
        "id": note.id,
        "title": note.title,
        "preview": note.preview,
        "color": note.color,
        "pinned": note.pinned,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


def note_out(note: Note) -> dict:
    return {**summary_out(note), "content": note.content}


def _apply_content(note: Note, doc: dict) -> None:
    doc = note_content.validate(doc)
    derived = note_content.derive(doc)
    note.content = doc
    note.title = derived["title"]
    note.plain = derived["plain"]
    note.preview = derived["preview"]


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_notes(db: Session, user: User, q: Optional[str]) -> list[Note]:
    query = db.query(Note).filter(Note.user_id == user.id)
    q = " ".join((q or "").split())
    if q:
        query = query.filter(Note.plain.ilike(f"%{_escape_like(q[:200])}%", escape="\\"))
    return query.order_by(Note.pinned.desc(), Note.updated_at.desc(), Note.id.desc()).all()


def get_note(db: Session, user: User, note_id: int) -> Note:
    note = db.get(Note, note_id)
    if note is None or note.user_id != user.id:
        raise ApiError(404, "La nota no existe.", "NOTE_NOT_FOUND")
    return note


def create_note(db: Session, user: User, doc: dict, color: str, pinned: bool) -> Note:
    if db.query(Note).filter(Note.user_id == user.id).count() >= MAX_NOTES:
        raise ApiError(409, f"Llegaste al máximo de {MAX_NOTES} notas.", "NOTE_LIMIT", {"max": MAX_NOTES})
    note = Note(user_id=user.id, color=color, pinned=pinned)
    _apply_content(note, doc)
    if not note.plain:
        raise ApiError(422, "La nota está vacía.", "VALIDATION_ERROR", {"field": "content"})
    now = _now()
    note.created_at = now
    note.updated_at = now
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def update_note(
    db: Session,
    user: User,
    note_id: int,
    doc: Optional[dict],
    color: Optional[str],
    pinned: Optional[bool],
) -> Note:
    note = get_note(db, user, note_id)
    if doc is not None:
        _apply_content(note, doc)
        note.updated_at = _now()
    if color is not None:
        note.color = color
    if pinned is not None:
        note.pinned = pinned
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, user: User, note_id: int) -> None:
    db.delete(get_note(db, user, note_id))
    db.commit()
