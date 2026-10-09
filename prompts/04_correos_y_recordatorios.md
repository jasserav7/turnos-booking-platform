# Fase 04 — Correos y recordatorios

**Modelo:** el incluido en tu Copilot · **Costo Opus:** $0 · **Requisito:** fase 03 terminada y commiteada.

Sesión nueva (`/new`). Lee `AGENTS.md`, `core/notifications.py` y `core/config.py`.

## Objetivo

Correos transaccionales reales en español, enviados fuera de la transacción de base de datos, más un job de recordatorios 24 horas antes.

## Tareas

1. **`core/email.py`:**
   - interfaz `EmailSender` con `send(to, subject, html, text)`.
   - `SmtpEmailSender` con `smtplib` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, STARTTLS según `SMTP_STARTTLS`), construyendo `EmailMessage` con parte de texto y alternativa HTML.
   - función `get_email_sender()` inyectable, para poder sustituirla en tests.
   - si el envío falla, se registra el error en el log y **no** se propaga (la reserva ya está hecha).
2. **Plantillas Jinja2** en `app/templates/email/`: `base.html` (layout simple y responsive) y una por correo: verificación de correo, recuperación de contraseña, reserva creada (al cliente y al profesional), reserva confirmada, reserva cancelada, recordatorio. Cada una con versión de texto plano. Textos en español, con enlaces construidos con `FRONTEND_URL` (`/verify-email?token=`, `/reset-password?token=`).
3. **`core/notifications.py`:** reemplaza los stubs por implementaciones reales. Se ejecutan con `BackgroundTasks` de FastAPI **después** del commit; los routers pasan `background_tasks` a los servicios o encolan desde el router tras recibir el resultado.
4. **Job de recordatorios** `app/jobs/send_reminders.py`, ejecutable con `python -m app.jobs.send_reminders`: reservas `confirmed` que empiezan en las próximas 24 horas y con `reminder_sent_at` nulo; envía y marca `reminder_sent_at`. Idempotente (correrlo dos veces no duplica correos).
5. **Documenta en `docs/DECISIONS.md`** cómo programarlo (cron, tarea programada de ECS o GitHub Actions con `schedule`).
6. **Tests** con un `FakeEmailSender` que guarda los mensajes:
   - registro envía un correo de verificación con enlace válido.
   - forgot-password envía correo solo si el usuario existe, pero la respuesta es la misma.
   - crear, confirmar y cancelar una reserva envía los correos a quien corresponde.
   - un fallo del sender no rompe la respuesta de la API.
   - el job de recordatorios es idempotente y respeta la ventana de 24 horas.

## Verificación manual

```bash
docker compose up -d db mailpit api
```

Registra un usuario y revisa el correo en http://localhost:8025.

```bash
cd backend
pytest tests/test_emails.py
pytest
ruff check .
```

## Criterios de aceptación

- Ningún correo se envía dentro de una transacción abierta.
- Todos los correos tienen asunto, texto plano y HTML.
- Sin secretos en el código.

## Commit

`feat: transactional emails with smtp, templates and reminder job`
