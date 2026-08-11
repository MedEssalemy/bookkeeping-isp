"""
Application configuration.
Reads settings from environment variables (see .env.example).
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_user: str = "app_user"
    postgres_password: str = "app_password"
    postgres_db: str = "erd_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    class Config:
        env_file = ".env"


settings = Settings()
