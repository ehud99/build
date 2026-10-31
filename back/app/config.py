"""Configuración por variables de entorno (o `back/.env`)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/build_dev"

    # Firma de la cookie de sesión. En producción, una clave larga y secreta.
    SECRET_KEY: str = "dev-secret-change-me"
    SESSION_DAYS: int = 30
    COOKIE_NAME: str = "build_rt"
    # `true` detrás de HTTPS.
    COOKIE_SECURE: bool = False

    # Clave de invitación que pide el registro. Vacía = registro cerrado.
    INVITE_CODE: str = ""

    # «Hoy» de los objetivos (solo se marca el día de hoy).
    APP_TIMEZONE: str = "America/Lima"

    # Bloqueo del login, como en forge (AJ3): tras 3 fallos seguidos, 1 minuto de espera
    # antes de cada intento; al llegar a 8, bloqueado hasta `scripts/unlock_user.py`.
    LOGIN_FREE_FAILURES: int = 3
    LOGIN_BLOCK_FAILURES: int = 8
    LOGIN_WAIT_SECONDS: int = 60


settings = Settings()
