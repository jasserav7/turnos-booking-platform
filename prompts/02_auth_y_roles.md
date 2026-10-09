# Fase 02 — Autenticación y roles

**Modelo:** Opus 5.5 · **Costo estimado:** $0.8 – 1.5 · **Requisito:** fase 01 terminada y commiteada.

Sesión nueva (`/new`). Lee solo `AGENTS.md` y los archivos de `backend/app/` que necesites tocar.

## Objetivo

Registro, login, refresh con rotación, verificación de correo, recuperación de contraseña y control de acceso por roles, todo cubierto por tests.

## Tareas

1. **`core/security.py`:** hash y verificación con `pwdlib` (argon2); `create_access_token` y `decode_token` con PyJWT (HS256, `SECRET_KEY`), validando `type`; generación de refresh tokens aleatorios (`secrets.token_urlsafe(48)`) y su hash sha256; tokens de verificación (24 h, `type=verify`) y reset (30 min, `type=reset`). El de reset incluye una huella corta del `password_hash` actual para que deje de valer al usarse.
2. **`core/deps.py`:** `get_current_user` (Bearer, rechaza inactivos y tokens que no sean `type=access`) y `require_roles(*roles)`.
3. **`core/notifications.py`:** `notify_verify_email(user, token)` y `notify_password_reset(user, token)` como stubs que solo escriben el enlace en el log (la fase 04 los implementa).
4. **Servicio `services/auth.py`** (la lógica; el router solo orquesta):
   - register (email en minúsculas, rol `customer`, único), login, refresh, logout, verify, forgot, reset.
   - Refresh con **rotación**: cada uso revoca el token anterior y emite uno nuevo en la misma `family_id`. Si llega un token ya revocado, revoca toda la familia y responde 401.
   - Logout revoca el refresh actual.
5. **Routers:**
   - `routers/auth.py` con los endpoints de `AGENTS.md`. Login devuelve `{access_token, token_type, user}` y fija la cookie `refresh_token` (`httpOnly`, `SameSite=Lax`, `Secure` según `COOKIE_SECURE`, path `/api/v1/auth`, 7 días). `forgot-password` responde 202 siempre. Mensaje de login incorrecto genérico.
   - `routers/users.py`: `GET|PATCH /users/me` (solo `full_name`).
   - `routers/admin_users.py`: `GET /admin/users` (paginado, filtro `role`) y `PATCH /admin/users/{id}` (`role`, `is_active`). Un admin no puede quitarse a sí mismo el rol ni desactivarse.
6. **Rate limit** con slowapi: login 5/min por IP, forgot-password 3/min por IP.
7. **`scripts/seed.py`:** pasa a usar `core/security.py`.
8. **Tests** (`tests/test_auth.py`, `tests/test_roles.py`):
   - registro (duplicado → 409, email normalizado), login correcto e incorrecto (mismo mensaje para email inexistente y contraseña errónea), usuario inactivo no entra.
   - refresh: rota, el token viejo falla, reutilizar uno revocado invalida la familia entera.
   - un token de tipo `refresh`, `verify` o `reset` usado como access → 401.
   - verificación de correo; reset de contraseña (token usado dos veces falla; token expirado falla).
   - `forgot-password` responde igual para email existente e inexistente.
   - matriz de roles: customer → 403 en `/admin/users`; admin → 200; sin token → 401.
   - no se puede auto-degradar ni auto-desactivar un admin.

## Verificación

```bash
cd backend
pytest tests/test_auth.py tests/test_roles.py
pytest
ruff check .
```

## Criterios de aceptación

- Ningún endpoint devuelve `password_hash` ni tokens de verificación/reset.
- Todos los tests de la lista pasan.
- Las rutas de admin están protegidas en el router y no solo en el frontend.

## Commit

`feat: jwt auth with refresh rotation, email verification, password reset and role guards`
