FROM python:3.12-slim

WORKDIR /app

# psycopg needs libpq at build time only when NOT using the [binary] wheel;
# we use psycopg[binary] in requirements.txt so no extra system deps are needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
