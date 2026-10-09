# Turnos — plataforma de reservas multi-rol

Aplicación web donde los clientes reservan citas con profesionales. Roles: `admin`, `provider`, `customer`.
Idioma: textos visibles al usuario y correos en español; código, nombres de variables, commits y comentarios en inglés.

## Stack fijo (no agregar dependencias fuera de esta lista sin avisar)

**Backend** (`/backend`): Python 3.12, FastAPI, SQLAlchemy 2.0 síncrono (estilo `Mapped[]`), Alembic, Pydantic v2 + pydantic-settings, PostgreSQL 16, PyJWT, `pwdlib[argon2]`, email-validator, Jinja2, slowapi, `smtplib` de la librería estándar para correo.
Dev: pytest, httpx, ruff.

**Frontend** (`/frontend`): Vite, React, TypeScript estricto, Tailwind CSS, React Router, TanStack Query, react-hook-form + zod (`@hookform/resolvers`), date-fns, `openapi-typescript` (dev). Sin librerías de componentes.

**Infra**: Docker Compose (`db`, `mailpit`, `api`, `web`), GitHub Actions.

## Estructura

```
turnos/
├─ AGENTS.md / CLAUDE.md (solo contiene: @AGENTS.md)
├─ docker-compose.yml, .env.example
├─ docker/initdb/01-create-test-db.sql
├─ prompts/            # prompts por fase
├─ docs/DECISIONS.md   # una línea por decisión ambigua
├─ backend/
│  ├─ pyproject.toml, alembic.ini, alembic/versions/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/    (config.py, security.py, deps.py, email.py, notifications.py)
│  │  ├─ db/      (base.py, session.py)
│  │  ├─ models/, schemas/, routers/, services/
│  │  ├─ templates/email/
│  │  ├─ jobs/    (send_reminders.py)
│  │  └─ scripts/ (seed.py, seed_demo.py)
│  └─ tests/
└─ frontend/src/ (api/, auth/, components/, pages/, lib/)
```

## Roles y permisos

| Rol | Puede |
|---|---|
| `customer` | Registrarse, ver servicios/profesionales/disponibilidad, crear reservas propias, cancelar las propias (hasta `CANCEL_MIN_HOURS` antes), ver sus reservas |
| `provider` | Gestionar su disponibilidad semanal y bloqueos, ver su agenda, confirmar/cancelar/completar las reservas que le corresponden |
| `admin` | CRUD de servicios, asignar servicios a profesionales, gestionar usuarios (rol, activo), ver todas las reservas y métricas |

El registro público solo crea `customer`. El primer `admin` sale del script `seed` con `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Los `provider` los crea o promueve un admin.

## Modelo de datos (UUID como PK, fechas en UTC `timestamptz`)

- `users`: id, email (único, minúsculas), password_hash, full_name, role, is_active, email_verified_at, created_at
- `refresh_tokens`: id, user_id, token_hash (sha256, único), family_id, expires_at, revoked_at, created_at
- `services`: id, name, description, duration_minutes, price_cents, is_active
- `provider_services`: provider_id, service_id (PK compuesta)
- `availability_rules`: id, provider_id, weekday (0=lunes), start_time, end_time (CHECK end > start)
- `time_off`: id, provider_id, starts_at, ends_at, reason
- `bookings`: id, customer_id, provider_id, service_id, starts_at, ends_at, status (`pending|confirmed|cancelled|completed`), notes, cancelled_by, cancel_reason, reminder_sent_at, created_at, updated_at

Enums como `VARCHAR` + CHECK (`native_enum=False`). Anti doble reserva a nivel de base de datos, en la migración:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (provider_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (status IN ('pending','confirmed'));
```

## API (prefijo `/api/v1`)

- Auth: `POST /auth/register`, `/auth/login`, `/auth/refresh` (cookie), `/auth/logout`, `GET /auth/verify-email`, `POST /auth/forgot-password`, `/auth/reset-password`
- Usuario: `GET|PATCH /users/me`; admin: `GET /admin/users`, `PATCH /admin/users/{id}`
- Catálogo: `GET /services`; admin: `POST|PATCH|DELETE /services` (DELETE = desactivar), `PUT /admin/providers/{id}/services`
- Profesionales: `GET /providers?service_id=`, `GET /providers/{id}/slots?service_id=&date_from=&date_to=`
- Disponibilidad (provider): `GET|PUT /providers/me/availability`, `GET|POST|DELETE /providers/me/time-off`
- Reservas: `POST /bookings`, `GET /bookings` (filtrado por rol; `status`, `date_from`, `date_to`, `limit`, `offset`), `GET /bookings/{id}`, `POST /bookings/{id}/confirm|cancel|complete`
- Admin: `GET /admin/stats`, `GET /health`

## Reglas de negocio

- Zona horaria de las reglas de disponibilidad: `APP_TIMEZONE` (por defecto `America/Bogota`). En la base todo es UTC; la API usa ISO 8601 con offset.
- Un slot es válido si: cae dentro de una regla semanal, no se solapa con `time_off` ni con otra reserva activa, empieza después de `MIN_NOTICE_MINUTES` (60) y dentro de `BOOKING_HORIZON_DAYS` (60). Los slots se generan avanzando de `duration_minutes` en `duration_minutes` desde el inicio de cada regla.
- Violación del constraint de exclusión → `409 slot_unavailable`.
- Transiciones: `pending→confirmed`, `pending→cancelled`, `confirmed→cancelled`, `confirmed→completed` (solo si ya empezó). Otras → `409 invalid_transition`.
- El cliente cancela hasta `CANCEL_MIN_HOURS` (2) antes; provider y admin siempre.

## Seguridad (no negociable)

- Hash con argon2. Login con mensaje genérico. `forgot-password` responde siempre 202 (sin enumerar usuarios).
- Access JWT 15 min (claims: `sub`, `role`, `type=access`, `iat`, `exp`). Refresh de 7 días en cookie `httpOnly`, `SameSite=Lax`, `Secure` según `COOKIE_SECURE`, path `/api/v1/auth`; guardado como sha256 en BD, con rotación y detección de reutilización (si se reusa uno revocado, se revocan todos los de su `family_id`).
- Tokens de verificación y reset llevan `type` propio; un token de un tipo nunca vale para otro. Reset: 30 min y queda inválido tras usarse.
- Autorización con `require_roles(...)` en routers **y** chequeo de propiedad en servicios.
- Rate limit con slowapi en login y forgot-password. CORS solo con `CORS_ORIGINS`. Nada de secretos en el código; todo por `.env`.
- El frontend guarda el access token solo en memoria (nunca en localStorage).

## Variables de entorno

`DATABASE_URL`, `TEST_DATABASE_URL`, `SECRET_KEY`, `APP_TIMEZONE`, `CORS_ORIGINS`, `COOKIE_SECURE`, `FRONTEND_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MIN_NOTICE_MINUTES`, `BOOKING_HORIZON_DAYS`, `CANCEL_MIN_HOURS`. Frontend: `VITE_API_URL`, `VITE_APP_TIMEZONE`.

## Convenciones

- Backend: type hints en todo, ruff limpio, routers delgados, lógica en `services/`, schemas `XxxIn` / `XxxOut`, paginación `limit` (máx 100) / `offset`, errores `{ "detail": "<codigo>" }`.
- `core/notifications.py` expone `notify_*` (stubs que solo hacen log hasta la fase 4).
- Frontend: sin `any`, hooks de TanStack Query en `src/api/`, formularios con RHF + zod, rutas protegidas por rol, estados de carga/error/vacío en cada vista, responsive.
- Commits convencionales (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), mínimo uno por fase.

## Reglas para el agente (controlan el costo)

1. No explores el repo completo: lee solo los archivos que la tarea mencione o que necesites tocar.
2. No reescribas archivos que no necesitas modificar.
3. No expliques el código ni resumas. Al terminar: lista corta de archivos creados/modificados y los comandos de verificación.
4. Ejecuta solo los tests de lo que tocaste; la suite completa, una vez al final de la fase.
5. Ante ambigüedad, elige lo más simple coherente con este documento y anótalo en una línea en `docs/DECISIONS.md`; no preguntes.
6. Si un comando falla dos veces con el mismo error, detente y repórtalo.
7. Definición de terminado: `ruff check` limpio, `pytest` en verde (backend) y `tsc --noEmit` + `npm run build` sin errores (frontend).
