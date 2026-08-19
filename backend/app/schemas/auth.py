"""
Mirrors frontend/src/types/auth.ts exactly — field names and shapes must
match, since that file is what the frontend deserializes our response into.
Note: AuthUser.id is a string on the frontend even though it's an int in
Postgres, so we cast on the way out.
"""
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class LoginCredentials(BaseModel):
    email: EmailStr
    password: str


class AuthUser(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole


class LoginResponse(BaseModel):
    access_token: str
    user: AuthUser
