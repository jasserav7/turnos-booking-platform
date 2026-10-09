# Guía de uso — proyecto Turnos

Plataforma de reservas multi-rol (admin / provider / customer) con FastAPI, PostgreSQL y React + TypeScript. Incluye JWT con refresh rotatorio, correos transaccionales y anti doble reserva garantizado por la base de datos.

## Archivos

| Archivo | Para qué |
|---|---|
| `AGENTS.md` | Contexto permanente del proyecto. Va en la raíz del repo; OpenCode lo lee solo. |
| `01` a `07` | Un prompt por fase. Se ejecutan en orden. |

## Preparación (una sola vez)

1. Crea el repositorio `turnos` en GitHub y clónalo.
2. Copia `AGENTS.md` a la raíz y crea `CLAUDE.md` con una sola línea: `@AGENTS.md`.
3. Crea la carpeta `prompts/` y copia ahí los archivos `01` a `07`.
4. Primer commit: `chore: add project context and phase prompts`.

## Flujo por fase

1. En OpenCode, abre una sesión limpia con `/new`. El historial anterior se vuelve a enviar en cada turno y se paga.
2. Elige el modelo de la tabla con `/models`.
3. Escribe: `Lee prompts/0X_nombre.md y ejecútalo completo.`
4. Revisa el diff y corre los comandos de verificación que trae el prompt.
5. Haz commit y push.
6. Revisa Usage en la consola de Anthropic antes de empezar la siguiente fase.

## Presupuesto de $5

Opus 5.5 cuesta $4 por millón de tokens de entrada y $20 por millón de salida; la lectura de caché cuesta $0.20 por millón. El saldo prepago es tu tope real, así que no actives la recarga automática.

Las cifras de la tabla son **estimaciones mías, no mediciones**. El costo real depende de cuántas vueltas dé el agente.

| Fase | Modelo | Costo Opus estimado |
|---|---|---|
| 01 Infra y base de datos | Modelo incluido en tu Copilot | $0 |
| 02 Auth y roles | **Opus 5.5 por API** | $0.8 – 1.5 |
| 03 Reservas (núcleo) | **Opus 5.5 por API** | $1.0 – 1.8 |
| 04 Correos | Copilot | $0 |
| 05 Frontend base y auth | Copilot | $0 |
| 06 Frontend reservas y admin | Copilot | $0 |
| 07 Tests, CI y README | Copilot; auditoría final con Opus | $0.3 – 0.6 |
| **Total Opus** | | **$2.1 – 3.9** |

Eso deja entre $1.1 y $2.9 de reserva para correcciones. Opus va en las fases 02 y 03 porque ahí un error cuesta caro (seguridad y concurrencia). El frontend y los CRUD son repetitivos y los resuelve bien un modelo más barato. Con `/models` revisa cuáles de tu Copilot no consumen créditos.

## Control de costos

- **Caché:** después de la fase 02 mira Usage en la consola. Si los tokens de lectura de caché están en 0, cada turno paga todo el contexto a precio completo y una fase puede costar varias veces más. En ese caso corre las fases 02 y 03 en Claude Code, donde Opus 5.5 viene incluido en tu Pro.
- **Esfuerzo de razonamiento:** si OpenCode te deja elegirlo, ponlo en bajo o medio. El razonamiento se cobra como salida.
- **Regla de parada:** si una fase pasa de unos $1.5, interrumpe, revisa qué hizo y divide el prompt en dos.
- **Contexto corto:** pasa rutas de archivos, no pegues logs ni archivos enteros en el chat.
- **Commit al terminar cada fase.** Si algo sale mal, volver atrás con Git es gratis; otra vuelta del agente no.

## Alternativa sin gastar saldo

Todas las fases se pueden correr en Claude Code con tu Pro. Tiene límites por ventana de 5 horas, así que haz una fase por sesión.

## Antes de publicar

- Entiende cada decisión técnica del código: en entrevistas te van a preguntar por qué.
- Nunca subas `.env`; solo `.env.example`.
- Agrega capturas de pantalla al README.
