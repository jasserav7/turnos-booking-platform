# Fase 06 — Frontend: reservas, agenda y panel de administración

**Modelo:** el incluido en tu Copilot · **Costo Opus:** $0 · **Requisito:** fase 05 terminada.

Sesión nueva (`/new`). Lee `AGENTS.md` y solo `frontend/src/api/` y `frontend/src/auth/`. Regenera los tipos con `npm run gen:api` antes de empezar.

## Objetivo

Las pantallas de los tres roles consumiendo la API real.

## Tareas

Hooks de TanStack Query en `src/api/` (un archivo por recurso). Invalida las consultas afectadas después de cada mutación. Las fechas se muestran en `VITE_APP_TIMEZONE` usando `Intl.DateTimeFormat` o date-fns.

1. **Customer**
   - Flujo de reserva en una página con pasos: elegir servicio → elegir profesional → elegir día (selector de fecha) y ver los slots disponibles como botones → confirmar con campo de notas opcional.
   - Si la API responde `slot_unavailable`, mostrar un mensaje claro y recargar los slots.
   - "Mis reservas": lista paginada con estado visible (etiquetas de color con texto, no solo color), filtro por estado y botón Cancelar con confirmación y motivo.
2. **Provider**
   - "Mi agenda": reservas del día o la semana (selector), con acciones Confirmar, Cancelar y Completar según el estado.
   - "Disponibilidad": editor semanal con varios rangos por día (agregar/quitar), validación de que fin > inicio y que no se solapen, guardado con `PUT`.
   - Bloqueos de tiempo: lista, alta con rango de fechas y motivo, eliminación.
3. **Admin**
   - Servicios: tabla con crear, editar y activar/desactivar (formulario en modal).
   - Profesionales: asignar los servicios que ofrece cada uno.
   - Usuarios: tabla paginada con filtro por rol y cambio de rol y estado activo.
   - Reservas: tabla de todas con filtros por estado y fechas.
   - Estadísticas: tarjetas con totales, reservas por día de los últimos 30 días como barras en CSS/SVG (sin librería de gráficos) y top de servicios.
4. **Calidad en todas las vistas:** estados de carga, error con opción de reintentar y vacío con texto útil; responsive (móvil primero); foco visible y etiquetas en formularios; botones con texto accesible.

## Verificación

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

Prueba a mano con tres usuarios (uno por rol): el customer reserva, el provider confirma, el admin lo ve en su tabla, y el customer recibe el correo en http://localhost:8025.

## Criterios de aceptación

- Un customer no ve opciones de provider ni de admin en la navegación.
- Dos pestañas reservando el mismo slot: una recibe el mensaje de conflicto.
- Sin `any` y sin errores de TypeScript.

## Commit

`feat: booking flow, provider agenda and admin panel`
