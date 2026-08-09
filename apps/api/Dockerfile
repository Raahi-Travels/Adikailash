# Journeys API production image.
#
# Deployed via Coolify onto the existing Hostinger VPS, which already runs the Raahi
# cab platform. Kept deliberately small: that box was at 82% disk when this was
# written, so the build stage is discarded and only the virtualenv is carried over.
#
# Migrations are NOT run on container start. With more than one replica that races,
# and a failed migration would take the API down with it. Run them as Coolify's
# pre-deployment command instead:
#     uv run alembic upgrade head

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependency layer first so application edits do not invalidate the install.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-dev

# README.md is required: uv_build reads it as the package readme at build time.
COPY README.md ./
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev


FROM python:3.13-slim-bookworm AS runtime

# curl is required by Coolify's health check, which shells into the container and
# has no Python available to it. Kept to the single package; the slim base has
# neither curl nor wget.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/src /app/src
COPY --from=builder --chown=app:app /app/alembic /app/alembic
COPY --from=builder --chown=app:app /app/alembic.ini /app/alembic.ini

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production

USER app
EXPOSE 8000

# Coolify polls this. /health also reports whether document storage is configured,
# so a misconfigured deploy is visible rather than silently broken.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Two workers: the box is shared and the workload is IO-bound on Postgres, so more
# workers would mostly consume Supabase connections rather than add throughput.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
