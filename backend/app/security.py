"""
Auth building blocks:
- password hashing (bcrypt)
- JWT issuing/decoding
- FastAPI dependencies: get_current_user (any valid token) and
  require_write_access (admin/editor only — mirrors the frontend's
  `canEdit`/`canDelete` store getters, enforced server-side for real).
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


# ---------- password hashing ----------
def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ---------- JWT ----------
def create_access_token(*, user_id: int, role: UserRole) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "role": role.value, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ---------- dependencies ----------
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Require a valid Bearer token. Raises 401 if missing/invalid/expired
    or if the user was deactivated — this is what the frontend's 401
    interceptor (logout + redirect to /login) reacts to."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_write_access(current_user: User = Depends(get_current_user)) -> User:
    """Admin or editor only — matches the frontend's canEdit/canDelete logic,
    enforced here so UI hiding is never the only line of defense."""
    if current_user.role not in (UserRole.admin, UserRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role does not have write access",
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user
