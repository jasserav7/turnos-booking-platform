# Decisiones técnicas

Una línea por decisión ambigua: `- [fase] decisión — motivo`.

- [docs] Entorno de desarrollo: Windows + PowerShell 5.1, sin `&&`, scripts y Dockerfiles con LF (`.gitattributes`) — evitar fallos de comandos y de finales de línea en contenedores.
- [docs] ESLint con la configuración por defecto de Vite y `npm run lint` en la definición de terminado — lint consistente sin configuración extra.
- [docs] `GET /health` es un endpoint de sistema público, no de admin — lo usan healthchecks de Docker/CI sin autenticación.
- [docs] `PUT /admin/providers/{id}/services` vive en `routers/services.py` — agrupa la lógica de catálogo en un solo router.
- [docs] Un slot fuera de disponibilidad responde `409 slot_unavailable` (no 422) — mismo código que el conflicto de solape; el payload es válido, el recurso no está disponible.
- [01] Driver de PostgreSQL `psycopg[binary]` (v3) añadido a las dependencias — SQLAlchemy lo necesita y AGENTS.md no listaba ninguno.
- [01] Puerto del host para Postgres es 5433 (contenedor sigue en 5432) — en la máquina de desarrollo ya hay un PostgreSQL local usando el 5432.
