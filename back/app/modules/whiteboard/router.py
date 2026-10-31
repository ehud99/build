"""Pizarra (docs/contrato-pizarra.md): pizarras de Excalidraw con la escena validada."""
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import User
from app.modules.whiteboard import models  # noqa: F401  (la tabla entra en Base.metadata)
from app.modules.whiteboard import service
from app.security import current_user

router = APIRouter(prefix="/api/whiteboards", tags=["whiteboard"])


class WhiteboardSummary(BaseModel):
    id: int
    name: str
    element_count: int
    size_bytes: int
    thumbnail_url: Optional[str]
    created_at: datetime
    updated_at: datetime


class WhiteboardOut(WhiteboardSummary):
    elements: list[Any]
    app_state: dict[str, Any]
    files: dict[str, Any]


# Los tipos quedan abiertos (`Any`) a propósito: la forma la revisa `scene.py`, que responde con
# `detail.field` y mensajes en español.
class WhiteboardCreate(BaseModel):
    name: Optional[str] = None
    elements: Optional[Any] = None
    app_state: Optional[Any] = None
    files: Optional[Any] = None


class WhiteboardUpdate(BaseModel):
    name: Optional[Any] = None
    elements: Optional[Any] = None
    app_state: Optional[Any] = None
    files: Optional[Any] = None
    thumbnail: Optional[Any] = None


@router.get("", response_model=list[WhiteboardSummary])
def list_whiteboards(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [service.summary_out(b) for b in service.list_boards(db, user)]


@router.post("", response_model=WhiteboardOut, status_code=201)
def create(body: WhiteboardCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    board = service.create_board(db, user, body.name, body.elements, body.app_state, body.files)
    return service.board_out(board)


@router.get("/{board_id}", response_model=WhiteboardOut)
def read(board_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.board_out(service.get_board(db, user, board_id))


@router.get("/{board_id}/thumbnail")
def thumbnail(board_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """La miniatura (PNG o WebP ya comprobados). La URL lleva `?v=` con la fecha de la edición."""
    board = service.get_board(db, user, board_id)
    if not board.thumbnail:
        raise ApiError(404, "La pizarra no tiene miniatura.", "THUMBNAIL_NOT_FOUND")
    return Response(
        content=board.thumbnail,
        media_type=board.thumbnail_type,
        headers={
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
        },
    )


@router.patch("/{board_id}", response_model=WhiteboardOut)
def update(board_id: int, body: WhiteboardUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if "name" in body.model_fields_set and not isinstance(body.name, str):
        raise ApiError(422, "La pizarra necesita un nombre.", "VALIDATION_ERROR", {"field": "name"})
    changes = {key: getattr(body, key) for key in body.model_fields_set}
    return service.board_out(service.update_board(db, user, board_id, changes))


@router.post("/{board_id}/duplicate", response_model=WhiteboardOut, status_code=201)
def duplicate(board_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.board_out(service.duplicate_board(db, user, board_id))


@router.delete("/{board_id}", status_code=204)
def delete(board_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    service.delete_board(db, user, board_id)
    return Response(status_code=204)
