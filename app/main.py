"""Серверное приложение книжного магазина «Переплёт»."""
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, db
from .security import hash_password, new_session_token, verify_password
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed()  # создаёт таблицы и наполняет каталог при первом запуске
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Переплёт — API книжного магазина",
    description="Каталог книг, учётные записи, список «Прочитать позже» и заказы.",
    version="1.0.0",
)

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$"


# ---------- Модели запросов ----------

class RegisterRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=120)
    name: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: str = Field(max_length=120)
    password: str = Field(max_length=72)


class ReadingListRequest(BaseModel):
    book_id: int = Field(gt=0)


class OrderItem(BaseModel):
    book_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=20)


class OrderRequest(BaseModel):
    items: list[OrderItem] = Field(min_length=1, max_length=50)


class FeedbackRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=120)
    topic: str = Field(min_length=1, max_length=40)
    message: str = Field(min_length=10, max_length=1000)


# ---------- Общие обработчики ----------

@app.exception_handler(RequestValidationError)
def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [str(err["loc"][-1]) for err in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": f"Некорректные данные в полях: {', '.join(fields)}", "fields": fields},
    )


bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict:
    """Проверка входа выполняется на сервере: без действующего токена — ответ 401."""
    user = db.get_user_by_token(credentials.credentials) if credentials else None
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется вход в учётную запись")
    return user


CurrentUser = Annotated[dict, Depends(current_user)]


# ---------- Каталог ----------

@app.get("/api/genres", tags=["Каталог"], summary="Список жанров")
def get_genres() -> list[dict]:
    return db.list_genres()


@app.get("/api/books", tags=["Каталог"], summary="Список книг с фильтрами")
def get_books(
    genre: str | None = None,
    q: Annotated[str | None, Query(max_length=60)] = None,
    min_price: Annotated[int | None, Query(ge=0)] = None,
    max_price: Annotated[int | None, Query(ge=0)] = None,
    sort: Annotated[str, Query(pattern="^(title|price_asc|price_desc|year_desc)$")] = "title",
    featured: bool | None = None,
    ids: Annotated[str | None, Query(pattern=r"^\d+(,\d+)*$")] = None,
) -> list[dict]:
    id_list = [int(x) for x in ids.split(",")] if ids else None
    return db.list_books(genre, q, min_price, max_price, sort, featured, id_list)


@app.get("/api/books/{book_id}", tags=["Каталог"], summary="Одна книга по идентификатору")
def get_book(book_id: int) -> dict:
    book = db.get_book(book_id)
    if not book:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Книга не найдена")
    return book


# ---------- Учётные записи ----------

@app.post("/api/auth/register", tags=["Учётные записи"], status_code=status.HTTP_201_CREATED,
          summary="Регистрация")
def register(data: RegisterRequest) -> dict:
    email = data.email.lower()
    if db.get_user_by_email(email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким e-mail уже есть")
    user_id = db.create_user(email, data.name.strip(), hash_password(data.password))
    token = db.create_session(user_id, new_session_token())
    return {"token": token, "user": {"id": user_id, "email": email, "name": data.name.strip()}}


@app.post("/api/auth/login", tags=["Учётные записи"], summary="Вход")
def login(data: LoginRequest) -> dict:
    user = db.get_user_by_email(data.email.lower())
    # Одинаковый ответ для неизвестного e-mail и неверного пароля
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный e-mail или пароль")
    token = db.create_session(user["id"], new_session_token())
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.post("/api/auth/logout", tags=["Учётные записи"], summary="Выход")
def logout(
    user: CurrentUser,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> dict:
    db.delete_session(credentials.credentials)
    return {"ok": True}


@app.get("/api/me", tags=["Учётные записи"], summary="Профиль текущего пользователя")
def me(user: CurrentUser) -> dict:
    return user


# ---------- «Прочитать позже» ----------

@app.get("/api/reading-list", tags=["Прочитать позже"], summary="Мой список")
def get_reading_list(user: CurrentUser) -> list[dict]:
    return db.get_reading_list(user["id"])


@app.post("/api/reading-list", tags=["Прочитать позже"], status_code=status.HTTP_201_CREATED,
          summary="Добавить книгу в список")
def add_reading_list(data: ReadingListRequest, user: CurrentUser) -> dict:
    if not db.get_book(data.book_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Книга не найдена")
    db.add_to_reading_list(user["id"], data.book_id)
    return {"ok": True}


@app.delete("/api/reading-list/{book_id}", tags=["Прочитать позже"], summary="Убрать книгу из списка")
def delete_reading_list(book_id: int, user: CurrentUser) -> dict:
    if not db.remove_from_reading_list(user["id"], book_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Этой книги нет в списке")
    return {"ok": True}


# ---------- Заказы ----------

@app.post("/api/orders", tags=["Заказы"], status_code=status.HTTP_201_CREATED,
          summary="Оформить заказ из корзины")
def create_order(data: OrderRequest, user: CurrentUser) -> dict:
    items: dict[int, int] = {}
    for item in data.items:
        items[item.book_id] = items.get(item.book_id, 0) + item.quantity
    try:
        return db.create_order(user["id"], items)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@app.get("/api/orders", tags=["Заказы"], summary="Мои заказы")
def get_orders(user: CurrentUser) -> list[dict]:
    return db.list_orders(user["id"])


# ---------- Обратная связь ----------

@app.post("/api/feedback", tags=["Обратная связь"], status_code=status.HTTP_201_CREATED,
          summary="Отправить сообщение")
def send_feedback(data: FeedbackRequest) -> dict:
    feedback_id = db.save_feedback(data.name.strip(), data.email.lower(), data.topic, data.message.strip())
    return {"id": feedback_id}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
def unknown_api(path: str) -> None:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Такого адреса в API нет")


# Статические страницы сайта; для несуществующих адресов отдаётся 404.html
app.mount("/", StaticFiles(directory=config.STATIC_DIR, html=True), name="static")
