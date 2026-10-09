# Fase 05 — Frontend: base y autenticación

**Modelo:** el incluido en tu Copilot · **Costo Opus:** $0 · **Requisito:** fases 01 a 04 terminadas, API corriendo en `http://localhost:8000`.

Sesión nueva (`/new`). Lee `AGENTS.md`. No leas el backend: usa el esquema OpenAPI.

## Objetivo

App React + TypeScript con layout, rutas protegidas por rol y flujo de autenticación completo contra la API.

## Tareas

1. **Scaffold** en `/frontend` con Vite (React + TS), Tailwind CSS, React Router, TanStack Query, react-hook-form, zod, `@hookform/resolvers`, date-fns y `openapi-typescript` (dev). `tsconfig` con `strict: true`. Variables `VITE_API_URL` y `VITE_APP_TIMEZONE` en `.env.example`.
2. **Tipos de la API:** script `npm run gen:api` que ejecuta `openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts`. Úsalo para tipar las respuestas; no definas a mano tipos que ya estén ahí.
3. **Cliente HTTP** `src/api/client.ts` con `fetch` y `credentials: "include"`:
   - guarda el access token **solo en memoria** (variable de módulo + contexto de React).
   - ante un 401 intenta `POST /auth/refresh` **una sola vez**, con una única petición compartida si hay varias fallando a la vez, y reintenta la original; si falla, cierra sesión.
   - normaliza errores a `{ status, code }` usando `detail`.
4. **Auth** en `src/auth/`: `AuthProvider` (usuario, `login`, `logout`, `register`), restauración de sesión al cargar (intenta refresh), hook `useAuth`, componente `ProtectedRoute` con `allowedRoles` (redirige a `/login` si no hay sesión y muestra página 403 si el rol no alcanza).
5. **Layout y navegación:** barra superior que cambia según el rol (customer: Reservar y Mis reservas; provider: Mi agenda y Disponibilidad; admin: Servicios, Usuarios, Reservas y Estadísticas), con menú móvil.
6. **Páginas:** Login, Registro, Verificar correo (lee `token` de la URL y llama a la API), Olvidé mi contraseña, Restablecer contraseña, Inicio por rol, 403 y 404. Formularios con RHF + zod, errores de la API mostrados claramente, estados de carga y botones deshabilitados mientras se envía.
7. **Docker:** `frontend/Dockerfile` y servicio `web` en `docker-compose.yml` (puerto 5173). Añade el origen a `CORS_ORIGINS` en `.env.example`.

## Verificación

```bash
cd frontend
npm install
npm run gen:api
npx tsc --noEmit
npm run lint
npm run build
npm run dev
```

Prueba a mano: registro → correo en http://localhost:8025 → verificar → login → refrescar la página (la sesión se mantiene) → logout.

## Criterios de aceptación

- No hay `any` ni uso de `localStorage` para tokens.
- Un customer que abre una ruta de admin ve la página 403.
- Todas las vistas tienen estados de carga y error.

## Commit

`feat: frontend base with auth flow, role-based routing and typed api client`
