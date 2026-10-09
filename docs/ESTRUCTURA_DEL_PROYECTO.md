# Estructura del proyecto Turnos + configuración de OpenCode (Opus 5.5 por API key)

Complementa a `AGENTS.md` y a los prompts de fase. Aquí está **dónde va cada archivo**, cómo dejar el repositorio listo para trabajar con OpenCode y cómo avanzar fase por fase sin gastar de más.

## 1. Árbol final del repositorio

Entre paréntesis, la fase que crea cada pieza.

```
turnos/
├─ AGENTS.md                      # contexto permanente (OpenCode lo lee solo)
├─ CLAUDE.md                      # una sola línea: @AGENTS.md
├─ opencode.json                  # configuración de OpenCode (sección 3)
├─ README.md                      # (F07)
├─ LICENSE                        # MIT (F07)
├─ .gitignore                     # (F01)
├─ .env.example                   # (F01) — el .env real NUNCA se sube
├─ docker-compose.yml             # (F01; F05 añade `web`)
├─ docker/
│  └─ initdb/01-create-test-db.sql        # (F01) crea la base turnos_test
├─ .github/
│  └─ workflows/ci.yml                    # (F07)
├─ prompts/                       # los 7 prompts de fase (se copian a mano)
│  ├─ 01_infra_y_base_de_datos.md
│  ├─ 02_auth_y_roles.md
│  ├─ 03_reservas_core.md
│  ├─ 04_correos_y_recordatorios.md
│  ├─ 05_frontend_base_y_auth.md
│  ├─ 06_frontend_reservas_y_admin.md
│  └─ 07_tests_ci_y_readme.md
├─ docs/
│  ├─ DECISIONS.md                        # decisiones ambiguas, una línea c/u
│  └─ img/                                # capturas para el README (las pones tú)
├─ backend/
│  ├─ pyproject.toml, Dockerfile, alembic.ini      # (F01)
│  ├─ alembic/
│  │  ├─ env.py
│  │  └─ versions/                        # migraciones (F01: modelo + constraint)
│  ├─ app/
│  │  ├─ main.py                          # (F01)
│  │  ├─ core/
│  │  │  ├─ config.py                     # (F01)
│  │  │  ├─ security.py, deps.py          # (F02)
│  │  │  ├─ notifications.py              # stubs (F02/F03) → reales (F04)
│  │  │  └─ email.py                      # (F04)
│  │  ├─ db/ (base.py, session.py)        # (F01)
│  │  ├─ models/                          # (F01) user, refresh_token, service,
│  │  │                                   #   provider_service, availability_rule,
│  │  │                                   #   time_off, booking
│  │  ├─ schemas/                         # XxxIn / XxxOut por recurso
│  │  ├─ routers/
│  │  │  ├─ auth.py, users.py, admin_users.py        # (F02)
│  │  │  ├─ services.py, providers.py, availability.py, bookings.py, admin_stats.py   # (F03)
│  │  ├─ services/                        # lógica de negocio
│  │  │  ├─ auth.py                       # (F02)
│  │  │  ├─ catalog.py, slots.py, bookings.py, stats.py   # (F03)  slots.py = función pura
│  │  ├─ templates/email/                 # base.html + una plantilla por correo (F04)
│  │  ├─ jobs/send_reminders.py           # (F04)
│  │  └─ scripts/ (seed.py, seed_demo.py) # (F01 / F07)
│  └─ tests/
│     ├─ conftest.py, test_health.py, test_booking_overlap.py   # (F01)
│     ├─ test_auth.py, test_roles.py                            # (F02)
│     ├─ test_slots.py, test_bookings.py, test_catalog.py       # (F03)
│     └─ test_emails.py                                         # (F04)
└─ frontend/
   ├─ package.json, vite.config.ts, tsconfig.json, Dockerfile, .env.example   # (F05)
   └─ src/
      ├─ main.tsx, App.tsx, routes.tsx
      ├─ api/
      │  ├─ schema.d.ts                   # generado con `npm run gen:api` (SÍ se commitea)
      │  ├─ client.ts                     # fetch + refresh en 401
      │  └─ auth.ts, services.ts, providers.ts, availability.ts, bookings.ts, admin.ts
      ├─ auth/ (AuthProvider.tsx, useAuth.ts, ProtectedRoute.tsx)
      ├─ components/ (Layout, Navbar, Modal, StatusBadge, Spinner, ErrorState, EmptyState …)
      ├─ pages/
      │  ├─ auth/ (Login, Register, VerifyEmail, ForgotPassword, ResetPassword)
      │  ├─ customer/ (BookingFlow, MyBookings)
      │  ├─ provider/ (Agenda, Availability, TimeOff)
      │  ├─ admin/ (Services, Providers, Users, Bookings, Stats)
      │  └─ errors/ (Forbidden, NotFound)
      └─ lib/ (dates.ts, errors.ts)
```

## 2. Qué se sube a GitHub y qué no

`.gitignore` mínimo (la fase 01 lo crea; verifícalo):

```gitignore
.env
__pycache__/
*.pyc
.venv/
.pytest_cache/
.ruff_cache/
node_modules/
dist/
.DS_Store
*.log
```

- **Se sube:** `AGENTS.md`, `CLAUDE.md`, `opencode.json`, `prompts/`, `.env.example`, `frontend/src/api/schema.d.ts` (el CI de la fase 07 lo necesita para compilar).
- **No se sube nunca:** `.env`, claves, contraseñas reales. Tu API key de Anthropic se guarda con `/connect` en OpenCode (queda en tu usuario, fuera del repo). **No la pongas en `opencode.json`.**

## 3. `opencode.json` (raíz del repo)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-opus-5-5",
  "small_model": "anthropic/claude-haiku-5-5",
  "default_agent": "build",
  "agent": {
    "build": { "steps": 60 }
  },
  "permission": {
    "edit": "allow",
    "bash": {
      "*": "ask",
      "git status*": "allow",
      "git diff*": "allow",
      "git log*": "allow",
      "pytest*": "allow",
      "ruff*": "allow",
      "alembic*": "allow",
      "npm run *": "allow",
      "npx tsc*": "allow",
      "docker compose *": "allow",
      "git push*": "ask",
      "rm -rf*": "deny"
    }
  },
  "command": {
    "fase": {
      "description": "Ejecuta un prompt de fase",
      "template": "Lee prompts/$ARGUMENTS y ejecútalo completo siguiendo AGENTS.md."
    }
  }
}
```

Qué hace cada bloque:

- `model`: Opus 5.5 por defecto, con la API key conectada vía `/connect`.
- `small_model`: Haiku 5.5 para tareas menores de OpenCode (por ejemplo, generar títulos de sesión), que así no gastan Opus. Si Haiku 5.5 no aparece en `/models`, borra esa línea.
- `agent.build.steps`: tope de iteraciones automáticas por turno (60). Es una válvula de seguridad contra un agente dando vueltas con tu saldo. Si una fase legítima se corta, escribe `continúa`.
- `permission`: edita archivos sin preguntar, pero pregunta antes de comandos desconocidos y de `git push`, y bloquea `rm -rf`. Deja siempre `"*": "ask"` **primero**; las reglas más específicas van después.
- `command.fase`: atajo para lanzar fases. Uso: `/fase 02_auth_y_roles.md`.

`AGENTS.md` no se declara en `instructions`: OpenCode ya lo lee solo, y declararlo podría cargarlo dos veces (más tokens por turno).

## 4. Preparación día 0

```bash
mkdir turnos && cd turnos
git init -b main
mkdir prompts docs
# copia aquí AGENTS.md, opencode.json y los prompts 01..07 dentro de prompts/
echo "@AGENTS.md" > CLAUDE.md
git add -A
git commit -m "chore: add project context, opencode config and phase prompts"
# crea el repositorio vacío en GitHub y conéctalo:
git remote add origin https://github.com/jasserav7/turnos.git
git push -u origin main
```

Después, en OpenCode: `/connect` → Anthropic → pega tu API key.

## 5. Flujo de trabajo por fase (una rama por fase)

```bash
git checkout -b feat/fase-02-auth
opencode                      # abre sesión nueva
/fase 02_auth_y_roles.md
# revisa el diff, corre los comandos de verificación del prompt
git add -A
git commit -m "feat: jwt auth with refresh rotation, email verification and role guards"
git push -u origin feat/fase-02-auth
# abre el Pull Request en GitHub, revísalo y haz merge a main
```

Trabajar con ramas y Pull Requests deja un historial limpio en tu perfil, que es justo lo que ve quien revisa tu HdV.

## 6. Modelo por fase y presupuesto

| Fase | Modelo | Nota |
|---|---|---|
| 01 Infra y BD | Opus 5.5 o el de Copilot | Mecánica; cámbialo con `/models` si quieres ahorrar |
| 02 Auth y roles | **Opus 5.5** | Seguridad: aquí sí vale la pena |
| 03 Reservas | **Opus 5.5** | Concurrencia y slots: aquí sí vale la pena |
| 04 Correos | Copilot | Plantillas y SMTP |
| 05 y 06 Frontend | Copilot | Mucho código repetitivo |
| 07 Tests, CI, README | Copilot + auditoría Opus | La auditoría solo sobre 5 archivos |

Usar Opus 5.5 en las siete fases probablemente no cabe en $5. Mis estimaciones (`00_GUIA_DE_USO.md`) suponen Opus solo en 02, 03 y la auditoría. Antes de cada fase, revisa tu saldo en la consola de Anthropic; el saldo prepago es tu tope real.

## 7. Notas de verificación

- La sintaxis de `$schema`, `model`, `permission`, `agent.steps` y `command` salió de la documentación de OpenCode. `small_model` aparece documentado en una sola referencia.
- `$ARGUMENTS` en el atajo `/fase`: si tu versión no lo reemplaza, escribe a mano `Lee prompts/02_auth_y_roles.md y ejecútalo completo.`
- **No pude confirmar cómo fijar el esfuerzo de razonamiento de Opus 5.5 en OpenCode.** La documentación solo muestra variantes `high` y `max` para Anthropic. Evita `max`: el razonamiento se cobra como tokens de salida ($20 por millón). Usa el atajo de cambio de variante de OpenCode si necesitas bajarlo.
- Revisa la columna de caché en Usage de la consola después de la fase 02, como indica la guía.
