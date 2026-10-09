# Fase 03 — Reservas (núcleo del negocio)

**Modelo:** Opus 5.5 · **Costo estimado:** $1.0 – 1.8 · **Requisito:** fase 02 terminada y commiteada.

Sesión nueva (`/new`). Lee solo `AGENTS.md`, `models/`, `core/deps.py`, `core/notifications.py` y `main.py`.

## Objetivo

Servicios, disponibilidad, generación de slots y reservas con máquina de estados y protección contra doble reserva bajo concurrencia.

## Tareas

1. **Servicios** (`routers/services.py`, `services/catalog.py`): `GET /services` (activos), y para admin `POST`, `PATCH`, `DELETE` (desactiva). `PUT /admin/providers/{id}/services` reemplaza los servicios que ofrece un profesional (el usuario debe tener rol `provider`). `GET /providers?service_id=` lista profesionales activos que ofrecen ese servicio.
2. **Disponibilidad** (`routers/availability.py`): `GET|PUT /providers/me/availability` (el PUT reemplaza todas las reglas; valida que `end_time > start_time` y que no se solapen entre sí el mismo día), `GET|POST|DELETE /providers/me/time-off`. Solo rol `provider`.
3. **Generación de slots** en `services/slots.py`, como **función pura** sin acceso a base de datos:
   - entrada: reglas semanales, bloqueos, reservas activas (intervalos), duración del servicio, rango de fechas, `now`, zona horaria y configuración (`MIN_NOTICE_MINUTES`, `BOOKING_HORIZON_DAYS`).
   - salida: lista de `datetime` UTC con inicio de cada slot libre, siguiendo las reglas de `AGENTS.md`.
   - rango máximo por consulta: 31 días.
   - `GET /providers/{id}/slots?service_id=&date_from=&date_to=` carga datos y llama a la función.
4. **Reservas** (`services/bookings.py`, `routers/bookings.py`):
   - `POST /bookings` (solo `customer`): valida servicio activo, que el profesional lo ofrezca y que `starts_at` esté entre los slots generados. Calcula `ends_at`. Inserta y captura la violación del constraint de exclusión (`IntegrityError` con sqlstate `23P01`) → `409 slot_unavailable`. Llama a `notify_booking_created`.
   - `GET /bookings`: customer ve las suyas, provider las que le corresponden, admin todas. Filtros `status`, `date_from`, `date_to`, `limit`, `offset`. Respuesta con total.
   - `GET /bookings/{id}`: 404 (no 403) si no tiene permiso, para no revelar existencia.
   - `confirm`, `cancel`, `complete` con la máquina de estados de `AGENTS.md`. Cancelar guarda `cancelled_by` y `cancel_reason`; el cliente respeta `CANCEL_MIN_HOURS`. Cada transición llama a su `notify_*`.
5. **`core/notifications.py`:** añade stubs de log `notify_booking_created`, `notify_booking_confirmed`, `notify_booking_cancelled`.
6. **Estadísticas** (`GET /admin/stats`): conteo por estado, reservas por día de los últimos 30 días, top 5 servicios y ingresos estimados (suma de `price_cents` de las completadas).
7. **Tests:**
   - `tests/test_slots.py` (función pura): respeta reglas, bloqueos y reservas; avance por duración; aviso mínimo; horizonte; cambio de zona horaria.
   - `tests/test_bookings.py`: flujo feliz; slot fuera de disponibilidad → 409 slot_unavailable; transición inválida → 409; cliente cancelando fuera de plazo → 409; customer no ve reservas ajenas (404); provider solo ve las suyas.
   - **Concurrencia:** dos peticiones simultáneas (hilos, sesiones distintas) al mismo slot → exactamente una responde 201 y la otra 409.
   - `tests/test_catalog.py`: permisos por rol en servicios y disponibilidad.

## Verificación

```bash
cd backend
pytest tests/test_slots.py tests/test_bookings.py tests/test_catalog.py
pytest
ruff check .
```

## Criterios de aceptación

- La doble reserva es imposible aunque se salte la validación de la aplicación (la garantiza el constraint).
- `slots.py` no importa nada de SQLAlchemy ni de FastAPI.
- Todas las reglas de permisos se comprueban en `services/`, no solo en los routers.

## Commit

`feat: services, availability, slot generation and bookings with overlap protection`
