# Turnos — plataforma de reservas

[![CI](https://github.com/jasserav7/turnos-booking-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/jasserav7/turnos-booking-platform/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Aplicación web multi-rol donde los clientes reservan citas con profesionales. Incluye disponibilidad semanal, bloqueos, reprogramación, exportación a calendario (`.ics`), flujo de estados de la reserva, correos transaccionales, recordatorios y un panel de administración con métricas y reportes descargables (CSV, Excel y PDF). Tema claro/oscuro y diseño responsive.

![Reservar una cita](docs/img/booking-flow.png)

**En resumen**
- Tres roles (cliente, profesional, admin) con autorización en el router y en el servicio.
- La base de datos garantiza que no haya dobles reservas, incluso con peticiones simultáneas.
- Sesiones con refresh tokens rotados y detección de reutilización.
- Auditoría de seguridad con verificación independiente de cada hallazgo; los problemas confirmados están corregidos y cubiertos por tests ([ver sección](#seguridad)).
- 126 tests de backend, CI con GitHub Actions y arranque completo con un solo `docker compose up`.

## Funcionalidades por rol

| Rol | Funcionalidades |
|---|---|
| **Cliente** | Registro y verificación de correo, recuperación de contraseña, ver servicios y profesionales, elegir un horario libre, reservar (con el correo verificado), ver sus reservas, **reprogramarlas**, **añadirlas a su calendario (`.ics`)** y cancelarlas hasta `CANCEL_MIN_HOURS` antes. |
| **Profesional** | Gestionar su disponibilidad semanal y bloqueos (`time_off`), ver su agenda por día o semana, confirmar, cancelar y completar las reservas que le corresponden. |
| **Admin** | CRUD de servicios (desactivar en lugar de borrar), asignar servicios a profesionales, gestionar usuarios (rol, activo), ver todas las reservas y métricas, y **descargar reportes de reservas** en CSV, Excel o PDF para el rango de fechas que elija. |

El registro público solo crea clientes. El primer admin sale del script `seed`; los profesionales los crea o promueve un admin.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 (síncrono), Alembic, Pydantic v2, PostgreSQL 16, PyJWT, argon2 (`pwdlib`), slowapi, Jinja2 y `smtplib` para el correo.
- **Frontend:** Vite, React, TypeScript estricto, Tailwind CSS, React Router, TanStack Query, react-hook-form + zod, date-fns. Sin librerías de componentes. Los tipos de la API se generan con `openapi-typescript` (`frontend/src/api/schema.d.ts`, versionado).
- **Infra:** Docker Compose (`db`, `mailpit`, `api`, `web`) y GitHub Actions. En producción: Vercel (web), Render (API), Neon (PostgreSQL) y Brevo (SMTP); ver [Despliegue en producción](#despliegue-en-producción).

## Decisiones técnicas destacadas

- **Anti doble reserva en la base de datos.** Un constraint de exclusión de PostgreSQL (`btree_gist` + `tstzrange`) impide solapar reservas `pending`/`confirmed` del mismo profesional, incluso bajo concurrencia. La violación se traduce a `409 slot_unavailable`.
- **Refresh tokens con rotación y detección de reutilización.** El token de refresh vive en una cookie `httpOnly`, se guarda como sha256 y se rota en cada uso; si se reutiliza uno revocado, se revoca toda su familia (`family_id`). El access token (15 min) solo existe en memoria del frontend.
- **Generación de slots como función pura.** `services/slots.py` calcula los horarios a partir de reglas, bloqueos y reservas, sin tocar la base de datos, lo que la hace trivial de testear.
- **Correos fuera de la transacción.** Las notificaciones se envían después del `commit`; un fallo de SMTP nunca revierte una reserva.
- **Horas en UTC, reglas en zona local.** La base guarda `timestamptz` en UTC; la disponibilidad se interpreta en `APP_TIMEZONE` (por defecto `America/Bogota`).
- **Autorización en dos capas:** `require_roles(...)` en los routers y comprobación de propiedad en los servicios.
- **Reprogramar sin romper la regla anti doble reserva.** El horario actual se libera dentro de la misma transacción para permitir corrimientos que se solapan con el propio; si el nuevo horario no es válido, se restaura el estado y nada se guarda. Si un cliente mueve una reserva ya confirmada, vuelve a `pending` para que el profesional la reconfirme.
- **Calendario `.ics` sin dependencias.** Se genera según RFC 5545, con un identificador estable por reserva y un número de secuencia: al reprogramar, el evento del calendario del usuario se actualiza en vez de duplicarse. También viaja adjunto en los correos de confirmación y reprogramación.
- **Reportes seguros.** Los CSV y XLSX neutralizan fórmulas (`=`, `+`, `-`, `@`) y descartan los caracteres que XLSX no admite, de modo que ningún dato de usuario se ejecuta ni rompe la exportación.
- **Límites contra el abuso.** Máximo de reservas activas por cliente, reglas de disponibilidad y bloqueos acotados por profesional, y reservar exige correo verificado.

Las decisiones ambiguas están registradas en [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Arquitectura

```mermaid
flowchart LR
    U[Navegador] -->|HTTP| W["web<br/>Vite + React"]
    W -->|"REST /api/v1<br/>JWT + cookie refresh"| A["api<br/>FastAPI"]
    A -->|SQLAlchemy| D[("PostgreSQL 16")]
    A -->|SMTP| M[Mailpit]
    J["jobs/send_reminders"] -->|SQLAlchemy| D
    J -->|SMTP| M
```

## Modelo de datos

```mermaid
erDiagram
    users ||--o{ refresh_tokens : tiene
    users ||--o{ availability_rules : define
    users ||--o{ time_off : bloquea
    users ||--o{ provider_services : ofrece
    services ||--o{ provider_services : "es ofrecido"
    users ||--o{ bookings : "reserva (customer)"
    users ||--o{ bookings : "atiende (provider)"
    services ||--o{ bookings : incluye

    users {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role "admin|provider|customer"
        bool is_active
        timestamptz email_verified_at
        timestamptz created_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        uuid family_id
        timestamptz expires_at
        timestamptz revoked_at
    }
    services {
        uuid id PK
        string name
        text description
        int duration_minutes
        int price_cents
        bool is_active
    }
    provider_services {
        uuid provider_id PK, FK
        uuid service_id PK, FK
    }
    availability_rules {
        uuid id PK
        uuid provider_id FK
        int weekday "0=lunes"
        time start_time
        time end_time
    }
    time_off {
        uuid id PK
        uuid provider_id FK
        timestamptz starts_at
        timestamptz ends_at
        string reason
    }
    bookings {
        uuid id PK
        uuid customer_id FK
        uuid provider_id FK
        uuid service_id FK
        timestamptz starts_at
        timestamptz ends_at
        string status "pending|confirmed|cancelled|completed"
        text notes
        uuid cancelled_by FK
        string cancel_reason
        timestamptz reminder_sent_at
    }
```

Estados de una reserva:

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> confirmed
    pending --> cancelled
    confirmed --> cancelled
    confirmed --> completed: solo si ya empezó
```

## Puesta en marcha con Docker

Requisitos: Docker y Docker Compose.

```bash
git clone https://github.com/jasserav7/turnos-booking-platform.git
cd turnos-booking-platform
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # pega el resultado en SECRET_KEY de .env
docker compose up --build
```

La API se niega a arrancar si `SECRET_KEY` tiene menos de 32 caracteres o sigue siendo el placeholder de `.env.example`.

Al arrancar, la API aplica las migraciones y ejecuta `seed` en cada inicio: crea el admin de `ADMIN_EMAIL` / `ADMIN_PASSWORD` solo si no existe y nunca sobrescribe la contraseña de uno existente.

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:5173 |
| API (docs interactivas) | http://localhost:8000/docs |
| Mailpit (correos de prueba) | http://localhost:8025 |
| PostgreSQL | `localhost:5433` (usuario, clave y base: `turnos`) |

Para cargar los datos de demostración (opcional, idempotente; se niega a ejecutarse si `COOKIE_SECURE=true`):

```bash
docker compose exec api python -m app.scripts.seed_demo
```

Para enviar los recordatorios de reservas próximas (pensado para un cron):

```bash
docker compose exec api python -m app.jobs.send_reminders
```

## Seguridad

El proyecto pasó por una auditoría de seguridad estructurada de código fuente y pruebas locales acotadas en un entorno aislado (sin red y con datos ficticios). Cada hallazgo lo verificó de forma independiente un segundo revisor, y todo lo confirmado está corregido y cubierto por tests de regresión. Quedan documentadas, sin corregir en el código, tres observaciones que dependen de cómo se despliegue: el rate limit detrás de un proxy (ver la sección siguiente), el envío de correos en segundo plano con un servidor SMTP lento y la exposición de los puertos de `docker-compose.yml` en la red local.

| Hallazgo | Corrección |
|---|---|
| Un cliente podía acaparar todos los horarios de un profesional con reservas pendientes ilimitadas | Tope de reservas activas por cliente (`MAX_ACTIVE_BOOKINGS_PER_CUSTOMER`) con bloqueo de fila |
| Cuentas sin verificar podían disparar correos de reserva a cualquier dirección | Reservar exige correo verificado |
| Un nombre con caracteres de control rompía el reporte Excel del admin | Validación del nombre y limpieza en el reporte |
| Coste del endpoint público de horarios controlable por un profesional | Topes de reglas y bloqueos por profesional |
| `SECRET_KEY` débil o de ejemplo aceptada al arrancar | La API no arranca con una clave de menos de 32 caracteres o con el placeholder |

Controles que resistieron la auditoría: JWT con algoritmo fijado y tipo de token verificado, rol leído de la base de datos en cada petición, aislamiento de reservas por dueño, rotación de refresh tokens con detección de reutilización, tokens de reset ligados a la contraseña, escapado de HTML y de iCalendar, y access token solo en memoria en el frontend.

## Despliegue detrás de un proxy

El rate limit (login, registro y recuperación de contraseña) se aplica por IP de cliente. Detrás de un proxy inverso o balanceador, todas las peticiones llegan con la IP del proxy: configura uvicorn con `--proxy-headers --forwarded-allow-ips=<IP del proxy>` (o equivalente) para que se use la IP real y no se limite a todos los usuarios a la vez.

## Despliegue en producción

Todo se despliega desde `main`: cada merge redespliega la web y la API.

```mermaid
flowchart LR
    U[Navegador] -->|HTTPS| V["Vercel<br/>frontend estático"]
    V -->|"rewrite /api/v1/*"| R["Render<br/>API en Docker"]
    R -->|SQLAlchemy| N[("Neon<br/>PostgreSQL")]
    R -->|"SMTP 2525"| B[Brevo]
```

| Pieza | Servicio | Configuración |
|---|---|---|
| Web | Vercel | Proyecto con *Root Directory* `frontend`. [`frontend/vercel.json`](frontend/vercel.json) reenvía `/api/v1/*` a la API y sirve `index.html` para el resto de rutas. |
| API | Render (Docker) | Blueprint en [`render.yaml`](render.yaml); el servicio despliega la rama `main`. Arranca con [`backend/start.sh`](backend/start.sh): migra, ejecuta `seed` y lanza uvicorn con `--proxy-headers`. |
| Base de datos | Neon | `DATABASE_URL` con el formato `postgresql+psycopg://usuario:clave@host/db?sslmode=require`. |
| Correo | Brevo (SMTP) | `smtp-relay.brevo.com` en el puerto **2525** con STARTTLS, porque el plan gratuito de Render restringe los puertos SMTP habituales (25, 465 y 587). |

**Por qué la web llama a `/api/v1` en vez de a la URL de la API.** El proxy de Vercel hace que el navegador hable siempre con el mismo origen, así la cookie de refresh (`SameSite=Lax`, `httpOnly`) se envía sin problemas de terceros. Por eso en Vercel `VITE_API_URL=/api/v1`.

**Variables por servicio**
- **Vercel:** `VITE_API_URL=/api/v1` y `VITE_APP_TIMEZONE`.
- **Render:** `DATABASE_URL`, `SECRET_KEY` (la genera Render), `COOKIE_SECURE=true`, `APP_TIMEZONE`, `CORS_ORIGINS` y `FRONTEND_URL` (la URL de Vercel, sin barra final y sin espacios), `ADMIN_EMAIL`, `ADMIN_PASSWORD` y las `SMTP_*`.

**Cosas a tener en cuenta**
- `ADMIN_PASSWORD` solo se usa cuando el admin **no existe**; cambiarla después en Render no modifica la contraseña de un admin ya creado.
- No hay un endpoint para reenviar el correo de verificación: si un usuario se registró antes de configurar el SMTP, hay que verificarlo a mano (`UPDATE users SET email_verified_at = now() WHERE ...`).
- Un remitente `@gmail.com` en Brevo puede acabar en spam; lo recomendable en producción es un dominio propio con DKIM y DMARC.
- En el plan gratuito de Render la API se suspende tras un rato sin tráfico y la primera petición tarda entre 30 y 60 segundos.
- Una pestaña abierta durante un despliegue pide archivos con hash que ya no existen; la web se recarga sola una vez y, si persiste, muestra una pantalla de error con un botón para recargar.

## Puesta en marcha sin Docker

Requisitos: Python 3.12, Node LTS y un PostgreSQL 16 accesible. Crea las bases `turnos` y `turnos_test` y ajusta `DATABASE_URL` / `TEST_DATABASE_URL` en `.env`. Para tener solo la base y el servidor de correo puedes usar `docker compose up db mailpit`.

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/activate        # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload

# Frontend (otra terminal)
cd frontend
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm ci
npm run dev
```

Si cambias la API, regenera los tipos con la API en marcha: `npm run gen:api` (en `frontend/`).

## Variables de entorno

Se definen en `.env` (plantilla en [`.env.example`](.env.example)). Nada de secretos en el código.

| Variable | Descripción |
|---|---|
| `DATABASE_URL` / `TEST_DATABASE_URL` | Conexión a la base principal y a la de tests. |
| `SECRET_KEY` | Clave para firmar los JWT: aleatoria y de al menos 32 caracteres (la API no arranca con el placeholder). **Una distinta en cada entorno.** |
| `APP_TIMEZONE` | Zona horaria de las reglas de disponibilidad (`America/Bogota`). |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas. |
| `COOKIE_SECURE` | `true` en producción (HTTPS) para la cookie de refresh. |
| `FRONTEND_URL` | URL base del frontend, usada en los enlaces de los correos. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS` | Configuración del correo (Mailpit en desarrollo). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del primer admin creado por `seed`. **Cambia la contraseña en producción.** |
| `MIN_NOTICE_MINUTES` | Antelación mínima para reservar (60). |
| `BOOKING_HORIZON_DAYS` | Horizonte máximo de reserva (60). |
| `CANCEL_MIN_HOURS` | Horas mínimas antes de la cita para que el cliente cancele o reprograme (2). |
| `MAX_ACTIVE_BOOKINGS_PER_CUSTOMER` | Máximo de reservas pendientes o confirmadas futuras por cliente (5). |
| `VITE_API_URL`, `VITE_APP_TIMEZONE` | Frontend: URL de la API y zona horaria. |

## Tests y calidad

```bash
# Backend (necesita PostgreSQL y TEST_DATABASE_URL)
cd backend
ruff check .
pytest

# Frontend
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

El workflow [`ci.yml`](.github/workflows/ci.yml) ejecuta todo esto en cada push a `main` y en cada pull request.

## Credenciales de demo

> [!WARNING]
> Las cuentas `@demo.turnos.local` y la contraseña `Demo12345!` son **solo para demostración local** y son públicas. En cualquier despliegue real: cambia `ADMIN_PASSWORD` y `SECRET_KEY`, usa `COOKIE_SECURE=true` y **no ejecutes `seed_demo`** (el script se niega a correr con `COOKIE_SECURE=true`).

Tras ejecutar `seed_demo`, todos los usuarios tienen la contraseña **`Demo12345!`**:

| Rol | Correo |
|---|---|
| Admin | `admin@demo.turnos.local` |
| Profesional | `laura@demo.turnos.local` |
| Profesional | `andres@demo.turnos.local` |
| Cliente | `cliente@demo.turnos.local` |

Además existe el admin del `seed`, con las credenciales de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (en `.env.example` son valores de ejemplo: `admin@turnos.local` / `change-me-admin-password`; cámbialos en tu `.env`).

Los datos demo incluyen 5 servicios, disponibilidad semanal para los dos profesionales y reservas de ejemplo en estado pendiente, confirmada, cancelada y completada.

## Capturas

| | |
|---|---|
| ![Inicio de sesión](docs/img/login.png) | ![Reservar una cita](docs/img/booking-flow.png) |
| ![Mis reservas](docs/img/my-bookings.png) | ![Agenda del profesional](docs/img/provider-agenda.png) |
| ![Reprogramar una reserva](docs/img/reschedule.png) | ![Panel de administración](docs/img/admin-dashboard.png) |
| ![Descarga de reportes](docs/img/reports.png) | ![Tema oscuro](docs/img/dark-mode.png) |

## Roadmap

- Pasarela de pagos y depósitos al reservar.
- Recordatorios por SMS / WhatsApp.
- Sincronización bidireccional con Google Calendar (hoy se exporta un `.ics` por reserva).
- Lista de espera: avisar al cliente cuando se libera un horario.
- Reseñas y valoraciones de los profesionales.
- Disponibilidad por fechas concretas y reservas recurrentes.
- Internacionalización (i18n) y zona horaria por usuario.

## Licencia

[MIT](LICENSE)
