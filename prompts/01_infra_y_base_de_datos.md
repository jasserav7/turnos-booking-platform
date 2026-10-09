# Fase 01 — Infraestructura y base de datos

**Modelo:** el incluido en tu Copilot · **Costo Opus:** $0 · **Requisito:** `AGENTS.md` en la raíz.

## Objetivo

Backend arrancando con Postgres y Mailpit en Docker, modelos migrados (con el constraint anti-solape) e infraestructura de tests lista.

## Tareas

1. **Raíz del repo**
   - `docker-compose.yml` con `db` (postgres:16-alpine, healthcheck, volumen, puerto 5432, monta `docker/initdb/`), `mailpit` (axllent/mailpit, puertos 1025 y 8025) y `api` (build `./backend`, uvicorn con `--reload`, depende de `db` healthy, puerto 8000, volumen del código).
   - `docker/initdb/01-create-test-db.sql` que cree la base `turnos_test`.
   - `.env.example` con todas las variables de `AGENTS.md` y valores de desarrollo.
   - `.gitignore` para Python, Node y `.env`.
2. **`backend/pyproject.toml`** con las dependencias de `AGENTS.md` (extra `dev`), configuración de ruff y pytest. **`backend/Dockerfile`** (python:3.12-slim, `pip install -e .`).
3. **Núcleo:** `app/core/config.py` (pydantic-settings), `app/db/base.py` (Base declarativa), `app/db/session.py` (engine, `SessionLocal`, dependencia `get_db`).
4. **Modelos** en `app/models/`, uno por entidad, todas las de `AGENTS.md`. SQLAlchemy 2.0 con `Mapped[]`, UUID con `default=uuid.uuid4`, `DateTime(timezone=True)`, enums con `native_enum=False`, relaciones necesarias e índices en las FK y en `bookings(provider_id, starts_at)`.
5. **Alembic:** `alembic.ini`, `alembic/env.py` leyendo `DATABASE_URL`, primera migración con autogenerate. Edítala para añadir `CREATE EXTENSION IF NOT EXISTS btree_gist` y el constraint `no_overlapping_bookings` de `AGENTS.md` con `op.execute` (con su downgrade). El constraint vive solo en la migración, no en el modelo.
6. **`app/main.py`:** app FastAPI, CORS desde `CORS_ORIGINS`, `GET /api/v1/health`.
7. **`app/scripts/seed.py`:** crea el admin desde `ADMIN_EMAIL` / `ADMIN_PASSWORD` si no existe (idempotente). Usa `pwdlib` con argon2 directamente; en la fase 02 se moverá a `core/security.py`.
8. **Tests:** `tests/conftest.py` usa `TEST_DATABASE_URL`, ejecuta `alembic upgrade head` una vez por sesión y envuelve cada test en una transacción con rollback; fixture `client` con override de `get_db`.
   - `test_health.py`.
   - `test_booking_overlap.py`: dos reservas solapadas del mismo profesional → la segunda lanza `IntegrityError` (usa `session.begin_nested()` con `pytest.raises`); una reserva cancelada no bloquea; otro profesional no bloquea.

## Verificación

```bash
cp .env.example .env
docker compose up -d db mailpit
cd backend && pip install -e ".[dev]"
alembic upgrade head
pytest
ruff check .
```

Y `docker compose up api` debe servir http://localhost:8000/docs.

## Criterios de aceptación

- `alembic upgrade head` y `alembic downgrade base` funcionan sin errores.
- Los tests de solape pasan, incluido el de reserva cancelada.
- Ruff limpio.

## Commit

`feat: project infrastructure, data model and booking overlap constraint`
