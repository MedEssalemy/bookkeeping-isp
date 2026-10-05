"""
Application configuration.
Reads settings from environment variables (see .env.example).
"""
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str = "app_user"
    postgres_password: str = "app_password"
    postgres_db: str = "erd_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    # e.g. "require" for Azure Database for PostgreSQL; unset for local Docker.
    postgres_sslmode: str | None = None

    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # JWT auth. CHANGE jwt_secret_key in production — never use the default.
    jwt_secret_key: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 8  # 8 hours

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{quote_plus(self.postgres_user)}:{quote_plus(self.postgres_password)}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            + (f"?sslmode={self.postgres_sslmode}" if self.postgres_sslmode else "")
        )

    class Config:
        env_file = ".env"


settings = Settings()
