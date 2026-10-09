# Fase 07 — Tests, CI, datos demo y README

**Modelo:** el incluido en tu Copilot para las tareas 1 a 4 · **Opus 5.5** solo para la auditoría final (tarea 5) · **Costo Opus estimado:** $0.3 – 0.6 · **Requisito:** fases 01 a 06 terminadas.

Sesión nueva (`/new`) para las tareas 1 a 4, y otra sesión nueva para la auditoría.

## Tareas 1 a 4 (modelo barato)

1. **GitHub Actions** en `.github/workflows/ci.yml`:
   - job `backend`: servicio PostgreSQL 16, Python 3.12, `pip install -e ".[dev]"`, `ruff check`, `alembic upgrade head`, `pytest`.
   - job `frontend`: Node LTS, `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
   - se ejecuta en push a `main` y en pull requests.
2. **Datos demo:** `app/scripts/seed_demo.py` idempotente: 1 admin, 2 profesionales, 1 cliente, 5 servicios, disponibilidad semanal para los profesionales y unas reservas de ejemplo en distintos estados. Contraseñas de demo documentadas en el README.
3. **`docker-compose.yml` completo:** `docker compose up --build` levanta `db`, `mailpit`, `api` y `web`; la API aplica migraciones al arrancar. Comprueba que un clon limpio funciona siguiendo solo el README.
4. **README.md** en la raíz, en español:
   - descripción corta y lista de funcionalidades por rol.
   - stack y decisiones técnicas destacadas: constraint de exclusión en PostgreSQL contra doble reserva, refresh con rotación y detección de reutilización, generación de slots como función pura, correos fuera de la transacción.
   - diagrama de arquitectura y diagrama entidad-relación en bloques `mermaid`.
   - cómo correrlo con Docker y sin Docker, variables de entorno, cómo correr los tests, credenciales demo.
   - sección de capturas con marcadores de posición `docs/img/...` (las pondré yo).
   - roadmap corto (ideas futuras).
   - `LICENSE` MIT y badge del workflow de CI.

## Verificación

```bash
docker compose up --build
cd backend && pytest && ruff check .
cd ../frontend && npx tsc --noEmit && npm run build
```

## Commit

`chore: ci pipeline, demo data and documentation`

---

## Tarea 5 — Auditoría final con Opus 5.5 (opcional, alto valor)

Sesión nueva. Prompt para pegar tal cual:

```
Audita SOLO estos archivos y no modifiques ninguno: backend/app/core/security.py,
backend/app/core/deps.py, backend/app/services/auth.py, backend/app/routers/auth.py,
backend/app/services/bookings.py. Busca fallos de seguridad (autenticación, autorización,
cookies, tokens, enumeración de usuarios, condiciones de carrera) y errores de lógica.
Responde con una lista priorizada (crítico / alto / medio / bajo): archivo, línea, problema
y arreglo propuesto en una frase. Sin introducciones ni resúmenes.
```

Revisa cada hallazgo, corrige lo que tenga sentido con el modelo barato y añade un test por cada arreglo.

## Commit

`fix: address security audit findings`
