# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Clientes (`customer`)**: personas hispanohablantes que reservan una cita con un profesional, casi siempre desde el teléfono. Su tarea: elegir servicio, profesional y horario en pocos pasos, y luego consultar o cancelar sus reservas.
- **Profesionales (`provider`)**: atienden las citas. Trabajan sobre todo en escritorio o tablet. Su tarea: revisar la agenda del día o de la semana, confirmar, cancelar o completar reservas, y mantener su horario semanal y sus bloqueos.
- **Administradores (`admin`)**: operan la plataforma desde escritorio. Su tarea: gestionar el catálogo de servicios, asignar servicios a profesionales, gestionar usuarios y roles, revisar todas las reservas y las métricas.

## Product Purpose

Turnos permite que un negocio con citas publique sus servicios y la disponibilidad de sus profesionales, y que sus clientes reserven horarios libres sin llamadas ni mensajes. El éxito es una reserva sin fricción para el cliente, una agenda clara para el profesional y un panel fiable para el administrador.

## Positioning

Plataforma genérica multiservicio: sirve a cualquier negocio con citas (peluquerías, consultorios, asesorías, clases) sin atarse a un rubro. Garantiza que nunca haya dos reservas solapadas para un mismo profesional, incluso bajo concurrencia.

## Operating Context

- Tres roles con navegación propia; el registro público solo crea clientes y los profesionales los crea o promueve un administrador.
- Horarios en la zona del negocio (`VITE_APP_TIMEZONE`, por defecto America/Bogota); fechas en español.
- Correos transaccionales en español (verificación, recuperación, reserva creada, confirmada, cancelada y recordatorio 24 h antes).
- Estados de reserva: pendiente, confirmada, cancelada, completada.

## Capabilities and Constraints

- Frontend: Vite, React, TypeScript estricto, Tailwind CSS, React Router, TanStack Query, react-hook-form + zod, date-fns. Sin librerías de componentes ni de animación.
- Textos visibles en español; código en inglés.
- El token de acceso vive solo en memoria.

## Brand Commitments

- Nombre: **Turnos**.
- Tono: profesional, limpio y sereno; cercano sin ser informal.
- Usuarios hispanohablantes (formato es-CO para fechas y moneda).

## Evidence on Hand

No hay logotipo, fotografías, testimonios ni clientes reales. No se deben inventar.

## Product Principles

1. Reservar debe ser lo más corto posible en el teléfono: pocos pasos, todo visible.
2. El estado de cada reserva se entiende de un vistazo, con texto e ícono además de color.
3. La operación diaria (agenda, panel) prioriza densidad legible y consistencia sobre decoración.
4. Ningún error queda sin explicar: cada fallo dice qué pasó y cómo seguir.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste AA, foco visible, etiquetas en todos los formularios, estado nunca comunicado solo con color y respeto a `prefers-reduced-motion`.
