"""Хеширование паролей (библиотека bcrypt) и выдача токенов сессии."""
import secrets

import bcrypt


def hash_password(password: str) -> str:
    # bcrypt сам генерирует соль и хранит её внутри результата
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))


def new_session_token() -> str:
    return secrets.token_urlsafe(32)
