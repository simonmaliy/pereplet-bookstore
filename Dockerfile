FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/app/data/bookstore.db \
    PORT=8000

WORKDIR /app

# Сначала зависимости: этот слой кешируется и не пересобирается при правке кода
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY static ./static

# Приложение работает от непривилегированного пользователя
RUN useradd --create-home appuser && mkdir -p /app/data && chown -R appuser /app/data
USER appuser

EXPOSE 8000

# Таблицы и каталог создаются при старте приложения (lifespan в app/main.py)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
