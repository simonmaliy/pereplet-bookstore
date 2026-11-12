"""Работа с базой SQLite. Все запросы параметризованные: значения передаются через «?»."""
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS genres (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug  TEXT NOT NULL UNIQUE,
    name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    genre_id    INTEGER NOT NULL REFERENCES genres(id),
    title       TEXT NOT NULL,
    author      TEXT NOT NULL,
    year        INTEGER NOT NULL,
    pages       INTEGER NOT NULL CHECK (pages > 0),
    price       INTEGER NOT NULL CHECK (price >= 0),
    binding     TEXT NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    featured    INTEGER NOT NULL DEFAULT 0,
    cover       TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_list (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id  INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'новый',
    total      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    book_id  INTEGER NOT NULL REFERENCES books(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price    INTEGER NOT NULL,
    PRIMARY KEY (order_id, book_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    topic      TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

BOOK_COLUMNS = """
    b.id, b.title, b.author, b.year, b.pages, b.price, b.binding, b.stock,
    b.featured, b.cover, b.description, g.slug AS genre_slug, g.name AS genre_name
"""

SORT_ORDERS = {
    "title": "b.title COLLATE NOCASE",
    "price_asc": "b.price ASC",
    "price_desc": "b.price DESC",
    "year_desc": "b.year DESC",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    config.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # Встроенный LOWER в SQLite не понимает кириллицу, поэтому регистрируем str.lower из Python
    conn.create_function("py_lower", 1, lambda value: value.lower() if value else value)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_schema() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)


def book_to_dict(row: sqlite3.Row) -> dict:
    book = dict(row)
    book["featured"] = bool(book["featured"])
    return book


# ---------- Каталог ----------

def list_genres() -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT g.slug, g.name, COUNT(b.id) AS books_count "
            "FROM genres g LEFT JOIN books b ON b.genre_id = g.id "
            "GROUP BY g.id ORDER BY g.id"
        ).fetchall()
    return [dict(r) for r in rows]


def list_books(genre: str | None = None, query: str | None = None,
               min_price: int | None = None, max_price: int | None = None,
               sort: str = "title", featured: bool | None = None,
               ids: list[int] | None = None) -> list[dict]:
    conditions, params = [], []
    if genre:
        conditions.append("g.slug = ?")
        params.append(genre)
    if query:
        conditions.append("(py_lower(b.title) LIKE ? OR py_lower(b.author) LIKE ?)")
        pattern = f"%{query.lower()}%"
        params += [pattern, pattern]
    if min_price is not None:
        conditions.append("b.price >= ?")
        params.append(min_price)
    if max_price is not None:
        conditions.append("b.price <= ?")
        params.append(max_price)
    if featured is not None:
        conditions.append("b.featured = ?")
        params.append(int(featured))
    if ids:
        conditions.append(f"b.id IN ({', '.join('?' for _ in ids)})")
        params += ids

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    # Порядок сортировки выбирается из словаря, пользовательская строка в SQL не попадает
    order_by = SORT_ORDERS.get(sort, SORT_ORDERS["title"])
    sql = (f"SELECT {BOOK_COLUMNS} FROM books b JOIN genres g ON g.id = b.genre_id "
           f"{where} ORDER BY {order_by}")
    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [book_to_dict(r) for r in rows]


def get_book(book_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            f"SELECT {BOOK_COLUMNS} FROM books b JOIN genres g ON g.id = b.genre_id WHERE b.id = ?",
            (book_id,),
        ).fetchone()
    return book_to_dict(row) if row else None


# ---------- Пользователи и сессии ----------

def get_user_by_email(email: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def create_user(email: str, name: str, password_hash: str) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (email, name, password_hash, now_iso()),
        )
        return cur.lastrowid


def create_session(user_id: int, token: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=config.SESSION_TTL_HOURS)
    with connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires.isoformat(timespec="seconds")),
        )
    return token


def get_user_by_token(token: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT u.id, u.email, u.name, u.created_at FROM sessions s "
            "JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?",
            (token, now_iso()),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


# ---------- Список «Прочитать позже» ----------

def get_reading_list(user_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            f"SELECT {BOOK_COLUMNS}, r.added_at FROM reading_list r "
            "JOIN books b ON b.id = r.book_id JOIN genres g ON g.id = b.genre_id "
            "WHERE r.user_id = ? ORDER BY r.added_at DESC",
            (user_id,),
        ).fetchall()
    return [book_to_dict(r) for r in rows]


def add_to_reading_list(user_id: int, book_id: int) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO reading_list (user_id, book_id, added_at) VALUES (?, ?, ?)",
            (user_id, book_id, now_iso()),
        )


def remove_from_reading_list(user_id: int, book_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM reading_list WHERE user_id = ? AND book_id = ?", (user_id, book_id)
        )
        return cur.rowcount > 0


# ---------- Заказы ----------

def create_order(user_id: int, items: dict[int, int]) -> dict:
    """items: {book_id: количество}. Цена берётся из базы, а не из запроса клиента."""
    with connect() as conn:
        placeholders = ", ".join("?" for _ in items)
        rows = conn.execute(
            f"SELECT id, price, stock, title FROM books WHERE id IN ({placeholders})",
            list(items),
        ).fetchall()
        found = {r["id"]: r for r in rows}
        missing = [book_id for book_id in items if book_id not in found]
        if missing:
            raise LookupError(f"Книги не найдены: {missing}")
        short = [found[b]["title"] for b, qty in items.items() if qty > found[b]["stock"]]
        if short:
            raise ValueError(f"Недостаточно на складе: {', '.join(short)}")

        total = sum(found[b]["price"] * qty for b, qty in items.items())
        cur = conn.execute(
            "INSERT INTO orders (user_id, created_at, total) VALUES (?, ?, ?)",
            (user_id, now_iso(), total),
        )
        order_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?, ?, ?, ?)",
            [(order_id, b, qty, found[b]["price"]) for b, qty in items.items()],
        )
        conn.executemany(
            "UPDATE books SET stock = stock - ? WHERE id = ?",
            [(qty, b) for b, qty in items.items()],
        )
    return {"id": order_id, "total": total}


def list_orders(user_id: int) -> list[dict]:
    with connect() as conn:
        orders = [dict(r) for r in conn.execute(
            "SELECT id, created_at, status, total FROM orders WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()]
        for order in orders:
            order["items"] = [dict(r) for r in conn.execute(
                "SELECT oi.book_id, b.title, oi.quantity, oi.price FROM order_items oi "
                "JOIN books b ON b.id = oi.book_id WHERE oi.order_id = ?",
                (order["id"],),
            ).fetchall()]
    return orders


# ---------- Обратная связь ----------

def save_feedback(name: str, email: str, topic: str, message: str) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO feedback (name, email, topic, message, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, email, topic, message, now_iso()),
        )
        return cur.lastrowid
