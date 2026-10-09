from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import User, UserRole


def main() -> None:
    settings = get_settings()
    if not settings.admin_email or not settings.admin_password:
        raise SystemExit("ADMIN_EMAIL and ADMIN_PASSWORD must be set")

    email = settings.admin_email.lower()
    hasher = PasswordHash((Argon2Hasher(),))
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            print(f"Admin {email} already exists")
            return
        db.add(
            User(
                email=email,
                password_hash=hasher.hash(settings.admin_password),
                full_name="Administrador",
                role=UserRole.admin,
                is_active=True,
            )
        )
        db.commit()
        print(f"Admin {email} created")


if __name__ == "__main__":
    main()
