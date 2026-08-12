from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./careerlens.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080   # 7 days

    FRONTEND_ORIGIN: str = "http://localhost:5173"
    APP_NAME: str = "CareerLens API"
    DEBUG: bool = True


settings = Settings()
