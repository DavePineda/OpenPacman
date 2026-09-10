# AGENTS.md

Juego Pac-Man en Vanilla JS. Proyecto educativo para practicar **Spec-Driven Development** (ver README.md). Todo el contenido (README, comentarios, specs) está en español.

## Ejecutar

No hay build, package.json, tests ni lint. Solo abre `src/index.html` en el navegador (o sirve `src/` con un servidor estático).

## Arquitectura

Sin módulos ES: `index.html` carga los scripts en orden y cada archivo expone **globales**:

1. `maze.js` — `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
2. `game.js` — `createGame`, `update` (estado y reglas)
3. `render.js` — `draw` (canvas)
4. `main.js` — bucle `requestAnimationFrame`, teclado y overlays

Si añades un archivo JS, debes registrar su `<script>` en `src/index.html` en el orden de dependencia correcto.

### Convenciones del grid

- `MAZE` es la matriz pristina; `createGame()` la copia a `game.grid` para comer dots sin destruirla. Nunca mutar `MAZE` directamente.
- Valores de celda: `0` vacío, `1` muro, `2` dot, `3` puerta de fantasmas (bloquea a Pacman, no a los fantasmas).
- Velocidades son fracciones de celda por frame (`PACMAN_SPEED = 1/8`); cambiarlas rompe la alineación por frames. Posición y dirección se actualizan solo cuando el actor está alineado a la celda (`aligned()`).

## Workflow: specs

- Antes de implementar una feature grande, usar el skill `/spec` (define el spec en `specs/`, aún no existe la carpeta) y luego `/spec-impl` para implementarlo en una rama propia.
- Responder y escribir specs en el idioma del usuario (español en este proyecto).
- `skills-lock.json` fija los skills instalados desde `klerith/fernando-skills`; no editar a mano.
