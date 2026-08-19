import enum
from sqlalchemy import Column, Integer, String, Enum as SAEnum, Boolean
from app.database import Base


class UserRole(str, enum.Enum):
    """Must match the frontend's `UserRole` union in src/types/auth.ts exactly."""
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.viewer)
    is_active = Column(Boolean, nullable=False, default=True)
