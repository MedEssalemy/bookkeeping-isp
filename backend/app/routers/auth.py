from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginCredentials, LoginResponse, AuthUser
from app.security import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginCredentials, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(User.email == credentials.email)
    ).scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(credentials.password, user.hashed_password):
        # Same error for "no such user" and "wrong password" — don't leak which one.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user_id=user.id, role=user.role)
    return LoginResponse(
        access_token=token,
        user=AuthUser(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role),
    )
