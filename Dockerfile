# Production image: one container serves the API and the built Vue app, so the
# browser, the API and its token share one origin (no proxy, no CORS).
# Local development keeps using docker-compose with backend/ and frontend/
# Dockerfiles (Vite dev server + uvicorn --reload).

FROM node:20-slim AS frontend
WORKDIR /src
COPY frontend/package*.json ./
# --legacy-peer-deps: pre-existing Tiptap peer-dependency conflict (see frontend/Dockerfile)
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
# Type-checking runs in CI; the image only needs the bundle.
RUN npx vite build

FROM python:3.14-slim
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION \
    STATIC_DIR=/app/static \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /src/dist ./static
# Attachments live in Postgres, so nothing writes to the image: run unprivileged.
RUN useradd --system --uid 10001 app
USER app
EXPOSE 8000
# Migrate + seed + serve (see backend/start.sh).
CMD ["sh", "start.sh"]
