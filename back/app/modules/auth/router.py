"""Cuentas: registro con clave de invitación, entrada con el código de acceso, sesión y salida."""
import hmac

from fastapi import APIRouter, Depends, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import ApiError
from app.models import User
from app.modules.auth import code_login
from app.modules.auth.schemas import (
    USERNAME_RE,
    AvailabilityOut,
    LoginIn,
    RegisterIn,
    UserResponse,
    normalize_username,
)
from app.security import clear_session_cookie, current_user, hash_code, set_session_cookie

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    if not settings.INVITE_CODE:
        raise ApiError(403, "El registro está cerrado.", "REGISTRATION_CLOSED")
    if not hmac.compare_digest(body.invite_code.strip().encode(), settings.INVITE_CODE.encode()):
        raise ApiError(403, "La clave de invitación no es correcta.", "INVALID_INVITE")
    if db.query(User.id).filter(User.username == body.username).first():
        raise ApiError(409, "Ese usuario ya existe. Elige otro.", "USERNAME_TAKEN")

    user = User(username=body.username, name=body.name, access_code_hash=hash_code(body.access_code))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "Ese usuario ya existe. Elige otro.", "USERNAME_TAKEN")
    db.refresh(user)
    set_session_cookie(response, user)
    return {"user": user}


@router.get("/username-available", response_model=AvailabilityOut)
def username_available(username: str = "", db: Session = Depends(get_db)):
    value = normalize_username(username)
    if not USERNAME_RE.fullmatch(value):
        return {"available": False}
    return {"available": db.query(User.id).filter(User.username == value).first() is None}


@router.post("/login", response_model=UserResponse)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = code_login.authenticate(db, body.username, body.access_code)
    set_session_cookie(response, user)
    return {"user": user}


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return {"user": user}


@router.post("/logout", status_code=204)
def logout(response: Response):
    clear_session_cookie(response)
    response.status_code = 204
    return response
