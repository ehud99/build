"""Notas (docs/contrato-notas.md): cards tipo Keep y el documento de Tiptap validado."""
from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.modules.notes import models  # noqa: F401  (la tabla entra en Base.metadata)
from app.modules.notes import service
from app.security import current_user

router = APIRouter(prefix="/api/notes", tags=["notes"])

Color = Literal["default", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown", "gray"]


class NoteSummary(BaseModel):
    id: int
    title: str
    preview: dict[str, Any]
    color: str
    pinned: bool
    created_at: datetime
    updated_at: datetime


class NoteOut(NoteSummary):
    content: dict[str, Any]


class NoteCreate(BaseModel):
    content: dict[str, Any]
    color: Color = "default"
    pinned: bool = False


class NoteUpdate(BaseModel):
    content: Optional[dict[str, Any]] = None
    color: Optional[Color] = None
    pinned: Optional[bool] = None


@router.get("", response_model=list[NoteSummary])
def list_notes(
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return [service.summary_out(n) for n in service.list_notes(db, user, q)]


@router.post("", response_model=NoteOut, status_code=201)
def create(body: NoteCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.note_out(service.create_note(db, user, body.content, body.color, body.pinned))


@router.get("/{note_id}", response_model=NoteOut)
def read(note_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return service.note_out(service.get_note(db, user, note_id))


@router.patch("/{note_id}", response_model=NoteOut)
def update(note_id: int, body: NoteUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    note = service.update_note(db, user, note_id, body.content, body.color, body.pinned)
    return service.note_out(note)


@router.delete("/{note_id}", status_code=204)
def delete(note_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    service.delete_note(db, user, note_id)
    return Response(status_code=204)
