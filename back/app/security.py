"""El código de acceso (bcrypt) y la cookie de sesión (JWT firmado)."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import ApiError
from app.models import User

ALGORITHM = "HS256"

# Para gastar lo mismo cuando el usuario no existe (no se distingue por el tiempo).
_DUMMY_HASH = bcrypt.hashpw(b"dummy!", bcrypt.gensalt()).decode()


def hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()


def verify_code(code: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(code.encode(), hashed.encode())
    except ValueError:
        return False


def dummy_verify(code: str) -> None:
    verify_code(code, _DUMMY_HASH)


def set_session_cookie(response: Response, user: User) -> None:
    expires = datetime.now(timezone.utc) + timedelta(days=settings.SESSION_DAYS)
    token = jwt.encode({"sub": str(user.id), "exp": expires}, settings.SECRET_KEY, algorithm=ALGORITHM)
    response.set_cookie(
        settings.COOKIE_NAME,
        token,
        max_age=settings.SESSION_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.COOKIE_NAME, path="/", secure=settings.COOKIE_SECURE, samesite="lax")


def _user_id_from_cookie(request: Request) -> Optional[int]:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """El usuario de la cookie. 401 `NOT_AUTHENTICATED` sin sesión válida (o si quedó bloqueado)."""
    user_id = _user_id_from_cookie(request)
    user = db.get(User, user_id) if user_id is not None else None
    if user is None or user.login_blocked_at is not None:
        raise ApiError(401, "Inicia sesión para continuar.", "NOT_AUTHENTICATED")
    return user
