"""
Tabla del módulo de pizarra (docs/contrato-pizarra.md).

- `whiteboards`: una pizarra de Excalidraw de un usuario. `elements`, `app_state` y `files` son la
  escena ya validada (`scene.py`: lista blanca de tipos, enlaces solo http(s)/mailto, imágenes
  solo PNG, JPEG, WebP o GIF). `thumbnail` es la miniatura en PNG o WebP que arma el navegador
  (bytes comprobados por su firma, nunca SVG ni HTML); `thumbnail_type` es su tipo MIME.
  `size_bytes` y `element_count` se calculan al guardar (topes y vista de la lista).
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Whiteboard(Base):
    __tablename__ = "whiteboards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80), default="Sin título", server_default="Sin título")
    elements: Mapped[list[Any]] = mapped_column(JSONB)
    app_state: Mapped[dict[str, Any]] = mapped_column(JSONB)
    files: Mapped[dict[str, Any]] = mapped_column(JSONB)
    element_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    thumbnail: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    thumbnail_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
