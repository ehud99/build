"""
Desbloquea un usuario que llegó a 8 fallos en el login (y le quita la espera).

    cd back && .venv/bin/python -m scripts.unlock_user <usuario>
"""
import sys

from app.db import SessionLocal
from app.models import User
from app.modules.auth.code_login import unlock


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python -m scripts.unlock_user <usuario>")
        return 2
    username = sys.argv[1].strip().lstrip("@").lower()
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            print(f"No existe el usuario «{username}».")
            return 1
        unlock(user)
        db.commit()
    print(f"«{username}» desbloqueado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
