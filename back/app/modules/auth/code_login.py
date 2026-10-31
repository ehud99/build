"""
Entrada con el código de acceso (como forge, AJ3).

Conteo de fallos por usuario: al `LOGIN_FREE_FAILURES`.º fallo seguido, una espera de
`LOGIN_WAIT_SECONDS`, y cada fallo después de eso vuelve a esperar; al `LOGIN_BLOCK_FAILURES`.º, el
usuario queda bloqueado (`login_blocked_at`) hasta `scripts/unlock_user.py`. Durante la espera o con
el bloqueo no se mira el código. Un acierto vuelve el conteo a 0.

Un usuario que no existe recibe **las mismas respuestas en el mismo orden**: su conteo vive en
memoria del proceso (se pierde al reiniciar). Así no se distingue uno real de uno inventado.
"""
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Protocol

from sqlalchemy.orm import Session

from app.config import settings
from app.errors import ApiError
from app.models import User
from app.security import dummy_verify, verify_code

INVALID_MESSAGE = "Verifica que tu usuario y tu código sean correctos."
WAIT_MESSAGE = "Espera 1 minuto antes de volver a intentarlo."
BLOCKED_MESSAGE = "Tu usuario quedó bloqueado. Pide que lo desbloqueen."

MAX_GHOSTS = 10_000


def _now() -> datetime:
    return datetime.now(timezone.utc)


class _Ledger(Protocol):
    login_failures: int
    login_locked_until: Optional[datetime]
    login_blocked_at: Optional[datetime]


@dataclass
class _Ghost:
    """El conteo de un usuario que no existe (los mismos campos que `User`)."""

    login_failures: int = 0
    login_locked_until: Optional[datetime] = None
    login_blocked_at: Optional[datetime] = None


class _Ghosts:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, _Ghost] = {}

    def get(self, key: str) -> _Ghost:
        with self._lock:
            ghost = self._state.get(key)
            if ghost is None:
                if len(self._state) >= MAX_GHOSTS:
                    # Se olvidan los que no están bloqueados (los bloqueados se recuerdan).
                    for k in [k for k, g in self._state.items() if g.login_blocked_at is None]:
                        self._state.pop(k, None)
                ghost = self._state[key] = _Ghost()
            return ghost

    def clear(self) -> None:
        with self._lock:
            self._state.clear()


ghosts = _Ghosts()


def _as_aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _ensure_open(ledger: _Ledger, now: datetime) -> None:
    """403 si está bloqueado, 429 si está en la espera. Sin mirar el código."""
    if ledger.login_blocked_at is not None:
        raise ApiError(403, BLOCKED_MESSAGE, "LOGIN_BLOCKED")
    locked = _as_aware(ledger.login_locked_until)
    if locked is not None and locked > now:
        seconds = max(1, int((locked - now).total_seconds() + 0.999))
        raise ApiError(429, WAIT_MESSAGE, "LOGIN_WAIT", {"retry_after": seconds})


def _fail(ledger: _Ledger, now: datetime) -> ApiError:
    """Suma un fallo y devuelve el error que toca (no lo lanza: el que llama guarda antes)."""
    ledger.login_failures = (ledger.login_failures or 0) + 1
    failures = ledger.login_failures
    if failures >= settings.LOGIN_BLOCK_FAILURES:
        ledger.login_blocked_at = now
        ledger.login_locked_until = None
        return ApiError(403, BLOCKED_MESSAGE, "LOGIN_BLOCKED")
    if failures >= settings.LOGIN_FREE_FAILURES:
        ledger.login_locked_until = now + timedelta(seconds=settings.LOGIN_WAIT_SECONDS)
        return ApiError(429, WAIT_MESSAGE, "LOGIN_WAIT", {"retry_after": settings.LOGIN_WAIT_SECONDS})
    return ApiError(
        401,
        INVALID_MESSAGE,
        "INVALID_CREDENTIALS",
        {"attempts_left": settings.LOGIN_FREE_FAILURES - failures},
    )


def authenticate(db: Session, username: str, code: str) -> User:
    """
    El usuario si el código es correcto y no está en espera ni bloqueado. Si no, 401
    `INVALID_CREDENTIALS`, 429 `LOGIN_WAIT` o 403 `LOGIN_BLOCKED` (iguales para uno que no
    existe). Hace commit de los fallos antes de lanzar el error.
    """
    now = _now()
    key = username.strip().lstrip("@").lower()
    user = db.query(User).filter(User.username == key).first()

    if user is None:
        ghost = ghosts.get(key)
        _ensure_open(ghost, now)
        dummy_verify(code)
        raise _fail(ghost, now)

    _ensure_open(user, now)
    if not verify_code(code, user.access_code_hash):
        error = _fail(user, now)
        db.commit()
        raise error

    user.login_failures = 0
    user.login_locked_until = None
    db.commit()
    return user


def unlock(user: User) -> None:
    user.login_failures = 0
    user.login_locked_until = None
    user.login_blocked_at = None
