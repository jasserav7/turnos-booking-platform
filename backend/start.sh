#!/bin/sh
# Render entrypoint: migrate, ensure the admin exists, then serve behind Render's proxy.
set -e
alembic upgrade head
python -m app.scripts.seed
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
