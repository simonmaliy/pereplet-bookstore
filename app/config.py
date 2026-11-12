"""Настройки приложения читаются из переменных окружения."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "data" / "bookstore.db"))
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "72"))
STATIC_DIR = BASE_DIR / "static"

# Тестовая учётная запись создаётся при наполнении базы, только если заданы обе переменные
DEMO_USER_EMAIL = os.getenv("DEMO_USER_EMAIL", "")
DEMO_USER_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "")
