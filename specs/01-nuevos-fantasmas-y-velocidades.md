# SPEC 01 — Nuevos fantasmas y ajuste de velocidades

> **Estado:** implementado
> **Depende de:** —
> **Fecha:** 2026-09-10
> **Objetivo:** Añadir 2 fantasmas con comportamientos propios (impredecible y tímido) y reducir las velocidades de Pacman y del hunter para que el juego sea manejable y permita girar por los pasillos intermedios.

## Alcance

**Incluye:**

- 2 fantasmas nuevos con `kind: 'erratic'` (alterna perseguir/vagar cada 5 s) y `kind: 'timid'` (huye si Pacman está a <6 celdas; si no, patrulla hacia su esquina).
- Velocidades propias por fantasma, definidas en `GHOST_STARTS`.
- Reducción de `PACMAN_SPEED` de 0.125 a 0.1 y del hunter de 0.1 a 0.08.
- Posiciones iniciales de los 2 nuevos en (12,14) y (15,14).

**Fuera del alcance (para specs futuros):**

- Power pellets / modo asustado (fantasmas azules comestibles).
- Pathfinding avanzado (BFS/A*); se mantiene la heurística greedy por distancia Manhattan.
- Más niveles, dificultad progresiva o soporte móvil.

## Modelo de datos

```js
// maze.js
const PACMAN_START = { x: 13, y: 23 };
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter',  speed: 0.08 },
  { x: 14, y: 14, kind: 'random',  speed: 0.1  },
  { x: 12, y: 14, kind: 'erratic', speed: 0.09 },
  { x: 15, y: 14, kind: 'timid',   speed: 0.07 },
];

// game.js
const PACMAN_SPEED = 0.1; // 1/10 celda/frame
// erratic: g.mode ('chase'|'wander') y g.modeTimer (frames, 300 ≈ 5 s a 60 fps)
// timid: objetivo de patrulla fijo en (1, 1)
```

## Plan de implementación

1. `maze.js`: añadir `speed` a las entradas existentes de `GHOST_STARTS` y las 2 entradas nuevas (`erratic`, `timid`). La partida sigue funcionando igual (2 fantasmas visibles).
2. `game.js`: `PACMAN_SPEED = 0.1`; `createGame()` usa `g.speed` de cada entrada. Prueba manual: Pacman y hunter visiblemente más lentos.
3. `game.js`: lógica `erratic` en `decideGhost()` — alterna entre decisión de hunter (chase) y random (wander) con `modeTimer`; resetear el temporizador en `resetPositions()`. Prueba manual: se ve el cambio de conducta cada ~5 s.
4. `game.js`: lógica `timid` — si distancia Manhattan a Pacman < 6, elegir la dirección que maximice la distancia; si no, acercarse a (1,1). Prueba manual: huye de cerca, patrulla de lejos.
5. Verificación final en navegador: 4 fantasmas, 4 colores, giros en pasillos intermedios.

## Criterios de aceptación

- [ ] Al iniciar se ven 4 fantasmas con colores distintos (rojo, cyan, rosa, naranja).
- [ ] Pacman se mueve a 0.1 celdas/frame (visiblemente más lento que antes).
- [ ] Pulsar una flecha hacia un pasillo perpendicular antes de llegar a la esquina ejecuta el giro al alinearse (pasillos intermedios accesibles).
- [ ] El hunter persigue a Pacman a 0.08 celdas/frame.
- [ ] El impredecible alterna entre perseguir y vagar cada ~5 segundos.
- [ ] El tímido se aleja de Pacman cuando está a menos de 6 celdas y patrulla hacia (1,1) cuando está lejos.
- [ ] Ningún fantasma atraviesa paredes; solo los fantasmas cruzan la puerta (celda 3).
- [ ] Al perder una vida, los 4 fantasmas y Pacman vuelven a sus posiciones y el modo del impredecible se resetea.

## Decisiones

- **Sí:** velocidades por fantasma en `GHOST_STARTS` — permite ajustar el feeling de cada uno sin tocar el resto.
- **Sí:** temporizador del impredecible en frames (300 ≈ 5 s) — determinista y coherente con el bucle `requestAnimationFrame`; no usa `Date.now()`.
- **Sí:** reutilizar los colores por índice de `render.js` (`GHOST_COLORS`) — cero cambios en el render.
- **No:** velocidad compartida `GHOST_SPEED` única — no permite diferenciar personalidades por ritmo.
- **No:** extender el temporizador impredecible con intervalos aleatorios — el usuario eligió 5 s fijos, más fácil de verificar.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| 4 fantasmas saliendo de la pen se amontonan en la puerta | Posiciones iniciales separadas (x = 12, 13, 14, 15); se verifica en el paso 5. |
| Dificultad desbalanceada (hunter + impredecible persiguen a la vez) | Velocidades ya reducidas; el balance fino va en otro spec si hace falta. |

## Qué **no** está en este spec

- Power pellets y modo asustado.
- Pathfinding con búsqueda de caminos.
- Niveles, dificultad progresiva, puntuaciones altas.
