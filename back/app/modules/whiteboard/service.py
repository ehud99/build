"""
Pizarras de un usuario (docs/contrato-pizarra.md).

- Cada usuario ve solo las suyas: la de otro responde 404 `WHITEBOARD_NOT_FOUND`.
- Hasta `MAX_WHITEBOARDS` pizarras por usuario (409 `WHITEBOARD_LIMIT`).
- La escena se valida con `scene.py`; de `files` quedan solo las imágenes que usa la escena.
- Todo cambio (escena, nombre o miniatura) mueve `updated_at`: la lista va por la última edición.
"""
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import User
from app.modules.whiteboard import scene
from app.modules.whiteboard.models import Whiteboard

MAX_WHITEBOARDS = 200
NAME_MAX = 80
DEFAULT_NAME = "Sin título"
COPY_PREFIX = "Copia de "


def _now() -> datetime:
    return datetime.now(timezone.utc)


def clean_name(value: Optional[str]) -> str:
    """El nombre sin espacios repetidos ni a los lados; 422 si queda vacío o pasa de 80."""
    name = " ".join((value or "").split())
    if not name:
        raise ApiError(422, "La pizarra necesita un nombre.", "VALIDATION_ERROR", {"field": "name"})
    if len(name) > NAME_MAX:
        raise ApiError(422, f"El nombre va hasta {NAME_MAX} caracteres.", "VALIDATION_ERROR", {"field": "name"})
    return name


def thumbnail_url(board: Whiteboard) -> Optional[str]:
    if not board.thumbnail:
        return None
    return f"/api/whiteboards/{board.id}/thumbnail?v={int(board.updated_at.timestamp() * 1000)}"


def summary_out(board: Whiteboard) -> dict:
    """Lo que necesita la card (sin la escena)."""
    return {
        "id": board.id,
        "name": board.name,
        "element_count": board.element_count,
        "size_bytes": board.size_bytes,
        "thumbnail_url": thumbnail_url(board),
        "created_at": board.created_at,
        "updated_at": board.updated_at,
    }


def board_out(board: Whiteboard) -> dict:
    return {**summary_out(board), "elements": board.elements, "app_state": board.app_state, "files": board.files}


def list_boards(db: Session, user: User) -> list[Whiteboard]:
    return (
        db.query(Whiteboard)
        .filter(Whiteboard.user_id == user.id)
        .order_by(Whiteboard.updated_at.desc(), Whiteboard.id.desc())
        .all()
    )


def get_board(db: Session, user: User, board_id: int) -> Whiteboard:
    board = db.get(Whiteboard, board_id)
    if board is None or board.user_id != user.id:
        raise ApiError(404, "La pizarra no existe.", "WHITEBOARD_NOT_FOUND")
    return board


def _check_limit(db: Session, user: User) -> None:
    if db.query(Whiteboard).filter(Whiteboard.user_id == user.id).count() >= MAX_WHITEBOARDS:
        raise ApiError(
            409,
            f"Llegaste al máximo de {MAX_WHITEBOARDS} pizarras.",
            "WHITEBOARD_LIMIT",
            {"max": MAX_WHITEBOARDS},
        )


def _apply_scene(board: Whiteboard, elements: Optional[Any], files: Optional[Any]) -> None:
    """Valida y guarda la escena; lo que no viene se conserva (y `files` se recorta a lo usado)."""
    alive = scene.validate_elements(elements) if elements is not None else board.elements
    current_files = scene.validate_files(files) if files is not None else (board.files or {})
    kept = scene.referenced_files(alive, current_files)
    board.size_bytes = scene.check_size(alive, kept)
    board.elements = alive
    board.files = kept
    board.element_count = len(alive)


def _apply_thumbnail(board: Whiteboard, value: Optional[str]) -> None:
    if value is None:
        board.thumbnail = None
        board.thumbnail_type = None
        return
    mime, data = scene.validate_thumbnail(value)
    board.thumbnail = data
    board.thumbnail_type = mime


def create_board(
    db: Session,
    user: User,
    name: Optional[str],
    elements: Optional[Any],
    app_state: Optional[Any],
    files: Optional[Any],
) -> Whiteboard:
    _check_limit(db, user)
    board = Whiteboard(user_id=user.id, name=clean_name(name) if name is not None else DEFAULT_NAME)
    board.elements = []
    board.files = {}
    _apply_scene(board, elements if elements is not None else [], files)
    board.app_state = scene.validate_app_state(app_state) if app_state is not None else {}
    now = _now()
    board.created_at = now
    board.updated_at = now
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


def update_board(db: Session, user: User, board_id: int, changes: dict[str, Any]) -> Whiteboard:
    """`changes` trae solo los campos enviados (`name`, `elements`, `app_state`, `files`, `thumbnail`)."""
    board = get_board(db, user, board_id)
    if "name" in changes:
        board.name = clean_name(changes["name"])
    if "elements" in changes or "files" in changes:
        if changes.get("elements", []) is None or changes.get("files", {}) is None:
            raise ApiError(422, "La escena no puede ir vacía.", "VALIDATION_ERROR", {"field": "elements"})
        _apply_scene(board, changes.get("elements"), changes.get("files"))
    if "app_state" in changes:
        board.app_state = scene.validate_app_state(changes["app_state"] if changes["app_state"] is not None else {})
    if "thumbnail" in changes:
        _apply_thumbnail(board, changes["thumbnail"])
    if changes:
        board.updated_at = _now()
    db.commit()
    db.refresh(board)
    return board


def copy_name(name: str) -> str:
    return (COPY_PREFIX + name)[:NAME_MAX].rstrip()


def duplicate_board(db: Session, user: User, board_id: int) -> Whiteboard:
    source = get_board(db, user, board_id)
    _check_limit(db, user)
    now = _now()
    board = Whiteboard(
        user_id=user.id,
        name=copy_name(source.name),
        elements=source.elements,
        app_state=source.app_state,
        files=source.files,
        element_count=source.element_count,
        size_bytes=source.size_bytes,
        thumbnail=source.thumbnail,
        thumbnail_type=source.thumbnail_type,
        created_at=now,
        updated_at=now,
    )
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


def delete_board(db: Session, user: User, board_id: int) -> None:
    db.delete(get_board(db, user, board_id))
    db.commit()
