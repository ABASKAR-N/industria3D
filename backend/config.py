from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://industria:industria123@localhost:5432/industria_db"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    YOLO_WEIGHTS_PATH: str = "../models/best.pt"
    UPLOAD_DIR: str = "../uploads"
    MODELS_DIR: str = "../3d_models"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    FORCE_DEMO_MODE: bool = False
    KIRI_API_KEY: str = "kiri_SpAabRu7giWaZ7TwRhozZ_stRE7gLHzVRQjXOcBKYV0"
    KIRI_BASE_URL: str = "https://api.kiriengine.app/api/v1/open"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
