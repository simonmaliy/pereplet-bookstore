# «Переплёт» — книжный магазин

Учебный проект по дисциплине «Введение в интернет-технологии».
**Вариант 9 — «Магазин книг»** (группа А «Каталог и подбор»): подборки по жанру, список «Прочитать позже».

- Адрес приложения: `https://<ваш-адрес>.onrender.com` *(заполнить после развёртывания)*
- Тестовая учётная запись: `reader@pereplet.example` / пароль из переменной `DEMO_USER_PASSWORD` на хостинге *(указать при сдаче)*

## Что сделано

| Работа | Состояние | Содержание |
|---|---|---|
| ПР 1 | готово | 5 основных страниц (главная, каталог, книга, корзина, контакты) + вход, кабинет, 404; семантическая разметка, общий `style.css`, Grid/Flexbox, адаптивность до 360 px, свой логотип |
| ПР 2 | готово | формы обратной связи, фильтра каталога, входа и регистрации с проверкой полей; фильтр, сортировка, вкладки жанров, корзина без перезагрузки; курсы валют ЦБ РФ через `fetch` |
| ПР 3 | готово | FastAPI + SQLite, 8 таблиц, 18 книг, регистрация и вход, пароль хранится как bcrypt-хеш, параметризованные SQL-запросы |
| ПР 4 | готово к развёртыванию | Dockerfile, настройки в переменных окружения, инструкция для Render |

## Структура проекта

```
bookstore/
├── app/
│   ├── main.py        # обработчики API (FastAPI) и раздача страниц
│   ├── db.py          # схема базы и все SQL-запросы
│   ├── security.py    # хеширование паролей (bcrypt), токены сессий
│   ├── seed.py        # создание таблиц и наполнение каталога
│   ├── seed_data.py   # жанры и книги
│   └── config.py      # настройки из переменных окружения
├── static/            # страницы сайта (HTML, CSS, JS, изображения)
├── docs/TZ.md         # техническое задание
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Запуск локально

Нужен Python 3.11 или новее.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # в Windows: copy .env.example .env
uvicorn app.main:app --reload --env-file .env
```

Откройте http://127.0.0.1:8000 — сайт, http://127.0.0.1:8000/docs — документация API.
База `data/bookstore.db` создаётся и наполняется автоматически при первом запуске.

## Запуск через Docker

```bash
docker build -t pereplet .
docker run --rm -p 8000:8000 --env-file .env pereplet
```

Чтобы база сохранялась между перезапусками контейнера, подключите том:
`docker run --rm -p 8000:8000 --env-file .env -v pereplet-data:/app/data pereplet`

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `DATABASE_PATH` | путь к файлу базы SQLite | `data/bookstore.db` |
| `SESSION_TTL_HOURS` | срок действия входа, часов | `72` |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | тестовая учётная запись, создаётся при старте | не создаётся |
| `PORT` | порт внутри контейнера | `8000` |

## Структура базы данных

```
genres 1 ──< books 1 ──< reading_list >── 1 users 1 ──< sessions
                 1                              1
                 └──< order_items >── 1 orders ─┘
feedback (обращения из формы обратной связи, без связей)
```

| Таблица | Поля | Связи |
|---|---|---|
| `genres` | `id` INTEGER PK, `slug` TEXT UNIQUE, `name` TEXT | — |
| `books` | `id` INTEGER PK, `genre_id` INTEGER, `title`, `author` TEXT, `year`, `pages`, `price`, `stock` INTEGER, `binding`, `cover`, `description` TEXT, `featured` INTEGER (0/1) | `genre_id` → `genres.id` |
| `users` | `id` INTEGER PK, `email` TEXT UNIQUE, `name` TEXT, `password_hash` TEXT, `created_at` TEXT | — |
| `sessions` | `token` TEXT PK, `user_id` INTEGER, `expires_at` TEXT | `user_id` → `users.id` |
| `reading_list` | `user_id`, `book_id` INTEGER (составной PK), `added_at` TEXT | → `users.id`, → `books.id` |
| `orders` | `id` INTEGER PK, `user_id` INTEGER, `created_at`, `status` TEXT, `total` INTEGER | `user_id` → `users.id` |
| `order_items` | `order_id`, `book_id` INTEGER (составной PK), `quantity`, `price` INTEGER | → `orders.id`, → `books.id` |
| `feedback` | `id` INTEGER PK, `name`, `email`, `topic`, `message`, `created_at` TEXT | — |

## API

| Метод | Адрес | Доступ | Назначение |
|---|---|---|---|
| GET | `/api/genres` | все | жанры с числом книг |
| GET | `/api/books` | все | книги; параметры `genre`, `q`, `min_price`, `max_price`, `sort`, `featured`, `ids` |
| GET | `/api/books/{id}` | все | одна книга, 404 если нет |
| POST | `/api/auth/register` | все | регистрация, возвращает токен |
| POST | `/api/auth/login` | все | вход, возвращает токен |
| POST | `/api/auth/logout` | после входа | выход |
| GET | `/api/me` | после входа | профиль |
| GET / POST | `/api/reading-list` | после входа | список «Прочитать позже» / добавить книгу |
| DELETE | `/api/reading-list/{book_id}` | после входа | убрать книгу из списка |
| GET / POST | `/api/orders` | после входа | мои заказы / оформить заказ |
| POST | `/api/feedback` | все | сообщение из формы обратной связи |

## Развёртывание на Render

1. Загрузите проект в репозиторий GitHub.
2. На render.com: **New → Web Service**, выберите репозиторий; Render сам найдёт `Dockerfile`.
3. Тариф **Free**. В разделе **Environment** добавьте `DEMO_USER_EMAIL` и `DEMO_USER_PASSWORD`.
4. После сборки приложение доступно по адресу `https://<имя>.onrender.com`; HTTPS-сертификат Render выдаёт автоматически.

Особенности бесплатного тарифа: сервис засыпает после простоя (первый запрос после паузы идёт около минуты), а файловая система не сохраняется между перезапусками — каталог и тестовая учётная запись создаются заново при каждом старте, зарегистрированные пользователи и заказы сбрасываются.
