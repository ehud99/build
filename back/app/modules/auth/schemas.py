import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9._]{3,24}$")
# 6 caracteres ASCII visibles, sin espacios (como forge, AJ1).
ACCESS_CODE_RE = re.compile(r"^[\x21-\x7e]{6}$")


def normalize_username(value: str) -> str:
    return str(value or "").strip().lstrip("@").lower()


def check_username(value: str) -> str:
    value = normalize_username(value)
    if not USERNAME_RE.fullmatch(value):
        raise ValueError("El usuario tiene de 3 a 24 caracteres: letras, números, punto y guion bajo.")
    return value


def check_access_code(value: str) -> str:
    if not ACCESS_CODE_RE.fullmatch(value or ""):
        raise ValueError("El código tiene 6 caracteres, sin espacios.")
    return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    created_at: datetime


class UserResponse(BaseModel):
    user: UserOut


class RegisterIn(BaseModel):
    invite_code: str
    name: str
    username: str
    access_code: str

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = " ".join(str(value or "").split())
        if not 1 <= len(value) <= 60:
            raise ValueError("El nombre tiene de 1 a 60 caracteres.")
        return value

    @field_validator("username")
    @classmethod
    def _username(cls, value: str) -> str:
        return check_username(value)

    @field_validator("access_code")
    @classmethod
    def _code(cls, value: str) -> str:
        return check_access_code(value)


class LoginIn(BaseModel):
    username: str
    access_code: str


class AvailabilityOut(BaseModel):
    available: bool
