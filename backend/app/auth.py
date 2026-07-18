import bcrypt
from fastapi import Header, HTTPException

from . import database


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


class CurrentUser:
    def __init__(self, id: int, email: str) -> None:
        self.id = id
        self.email = email


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    with database.get_connection() as conn:
        row = database.get_user_by_session_token(conn, token)

    if row is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    return CurrentUser(id=row["id"], email=row["email"])
