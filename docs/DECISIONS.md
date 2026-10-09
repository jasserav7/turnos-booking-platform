# Decisiones técnicas

Una línea por decisión ambigua: `- [fase] decisión — motivo`.

- [docs] Entorno de desarrollo: Windows + PowerShell 5.1, sin `&&`, scripts y Dockerfiles con LF (`.gitattributes`) — evitar fallos de comandos y de finales de línea en contenedores.
- [docs] ESLint con la configuración por defecto de Vite y `npm run lint` en la definición de terminado — lint consistente sin configuración extra.
- [docs] `GET /health` es un endpoint de sistema público, no de admin — lo usan healthchecks de Docker/CI sin autenticación.
- [docs] `PUT /admin/providers/{id}/services` vive en `routers/services.py` — agrupa la lógica de catálogo en un solo router.
- [docs] Un slot fuera de disponibilidad responde `409 slot_unavailable` (no 422) — mismo código que el conflicto de solape; el payload es válido, el recurso no está disponible.
- [01] Driver de PostgreSQL `psycopg[binary]` (v3) añadido a las dependencias — SQLAlchemy lo necesita y AGENTS.md no listaba ninguno.
- [01] Puerto del host para Postgres es 5433 (contenedor sigue en 5432) — en la máquina de desarrollo ya hay un PostgreSQL local usando el 5432.
- [02] Rama `feat/fase-02-auth` basada en `feat/fase-01-infra` (PRs apilados) — la fase 01 aún no estaba fusionada en `main`.
- [02] El login no exige correo verificado — la verificación solo marca `email_verified_at`; lo más simple hasta que se pida bloquearlo.
- [02] Tokens de verificación/reset inválidos, expirados o ya usados → `400 invalid_token` (no 401) — no son credenciales de sesión.
- [02] Admin que intenta degradarse o desactivarse → `400 cannot_modify_self`.
- [02] Resetear la contraseña revoca todos los refresh tokens del usuario — cierra sesiones posiblemente comprometidas.
- [02] Login y forgot-password aceptan el email como texto (no `EmailStr`) — el admin del seed usa el dominio `.local`, que email-validator rechaza; el registro sí valida con `EmailStr`.
- [02] Rate limit responde `429 {"detail": "rate_limited"}`; en tests se reinicia el limitador antes de cada test.
- [03] `GET /services`, `GET /providers` y `GET /providers/{id}/slots` son públicos (sin token) — permiten explorar el catálogo antes de registrarse.
- [03] `date_from`/`date_to` (slots y listado de reservas) son fechas locales en `APP_TIMEZONE`, ambas inclusivas; rango invertido → `422 invalid_range`, más de 31 días → `422 range_too_large`.
- [03] Servicio inexistente o inactivo → `404 service_not_found`; profesional inexistente, inactivo o que no ofrece el servicio → `404 provider_not_found`.
- [03] `PUT /admin/providers/{id}/services` con un usuario que no es `provider` → `404 provider_not_found`; ids de servicio inexistentes → `422 invalid_service`.
- [03] Reglas de disponibilidad solapadas el mismo día → `422 overlapping_rules`; las reglas contiguas (fin = inicio) se permiten.
- [03] Cliente que cancela con menos de `CANCEL_MIN_HOURS` → `409 cancellation_window_closed`; un customer que intenta confirmar/completar una reserva propia → 403.
- [03] `complete` no notifica — solo existen los stubs `notify_booking_created|confirmed|cancelled` que pide la fase.
- [03] `GET /bookings` ordena por `starts_at` ascendente; `GET /admin/stats` agrupa por día local de `starts_at` (últimos 30 días incluido hoy) y el top 5 cuenta reservas en cualquier estado.
- [03] Un slot es válido si su inicio cae en `[now + MIN_NOTICE_MINUTES, now + BOOKING_HORIZON_DAYS]`; el avance por duración se calcula en UTC desde el inicio local de cada regla.
