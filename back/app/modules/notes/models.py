"""
Tabla del módulo de notas (docs/contrato-notas.md).

- `notes`: una nota de un usuario. `content` es el documento de Tiptap ya validado (lista blanca de
  nodos y marcas, `content.py`); `title`, `plain` y `preview` se derivan de él en el servidor al
  guardar: el título es la primera línea con texto, `plain` el texto plano (para buscar) y
  `preview` las líneas que muestra la card.
"""
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    plain: Mapped[str] = mapped_column(Text, default="", server_default="")
    title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    preview: Mapped[dict[str, Any]] = mapped_column(JSONB)
    color: Mapped[str] = mapped_column(String(10), default="default", server_default="default")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
