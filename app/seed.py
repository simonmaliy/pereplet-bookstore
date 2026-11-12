"""Создание таблиц и начальное наполнение базы. Запуск: python -m app.seed"""
from . import config, db
from .security import hash_password
from .seed_data import BOOKS, GENRES


def seed() -> None:
    db.init_schema()
    with db.connect() as conn:
        if conn.execute("SELECT COUNT(*) FROM books").fetchone()[0] == 0:
            conn.executemany("INSERT INTO genres (slug, name) VALUES (?, ?)", GENRES)
            genre_ids = {row["slug"]: row["id"] for row in conn.execute("SELECT id, slug FROM genres")}
            conn.executemany(
                "INSERT INTO books (genre_id, title, author, year, pages, price, binding, stock, "
                "featured, cover, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (genre_ids[g], title, author, year, pages, price, binding, stock, int(featured),
                     f"img/covers/{number}.svg", description)
                    for number, (g, title, author, year, pages, price, binding, stock, featured,
                                 description) in enumerate(BOOKS, start=1)
                ],
            )
            print(f"Добавлено жанров: {len(GENRES)}, книг: {len(BOOKS)}")

    if config.DEMO_USER_EMAIL and config.DEMO_USER_PASSWORD:
        if not db.get_user_by_email(config.DEMO_USER_EMAIL):
            db.create_user(config.DEMO_USER_EMAIL, "Тестовый читатель",
                           hash_password(config.DEMO_USER_PASSWORD))
            print(f"Создана тестовая учётная запись {config.DEMO_USER_EMAIL}")


if __name__ == "__main__":
    seed()
