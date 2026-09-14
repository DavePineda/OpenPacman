# SPEC 02 — Salida de los fantasmas de la pen

> **Estado:** implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-14
> **Objetivo:** Hacer que los fantasmas salgan uno por uno de la pen por la puerta al iniciar la partida (y al perder una vida), y que decidan en cada celda para no atravesar paredes.

## Alcance

**Incluye:**

- Fase por fantasma (`g.phase`: `'waiting' | 'exiting' | 'free'`) con temporizador de liberación escalonado: hunter 0, random 120, erratic 240, timid 360 frames (~2 s entre cada uno).
- Salida caminando por la puerta (celda 3) por la columna 13, hasta (13,11); mientras sale, el fantasma ignora su personalidad.
- Movimiento de fantasmas con avance hasta el siguiente borde de celda como máximo (decide en cada celda), con remanente arrastrado al siguiente frame. Mantiene las velocidades actuales (0.07–0.1).
- La puerta (celda 3) bloquea a los fantasmas `free`; solo la cruzan los `exiting`. Pacman sigue bloqueado.
- Al perder una vida, `resetPositions()` devuelve fases y timers, y la salida escalonada se repite.

**Fuera del alcance (para specs futuros):**

- Modo asustado / power pellets / fantasmas comestibles.
- Modo "comido" (volver a la pen tras ser comido) y re-entrada voluntaria a la pen.
- Cambios de velocidad, dificultad progresiva, niveles o sonido.

## Modelo de datos

```js
// maze.js — campo nuevo por fantasma
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter',  speed: 0.08, releaseDelay: 0   },
  { x: 14, y: 14, kind: 'random',  speed: 0.1,  releaseDelay: 120 },
  { x: 12, y: 14, kind: 'erratic', speed: 0.09, releaseDelay: 240 },
  { x: 15, y: 14, kind: 'timid',   speed: 0.07, releaseDelay: 360 },
];

// game.js — estado nuevo por fantasma
// g.phase: 'waiting' | 'exiting' | 'free'
// g.releaseTimer: frames restantes mientras está en 'waiting'
// Ruta de salida: horizontal hasta x=13 sobre y=14, luego hacia arriba hasta (13,11).
// Al pisar (13,11): g.phase = 'free'.
```

`game.state` (`'start'/'playing'/'won'/'lost'`) no cambia. `render.js` no cambia.

## Plan de implementación

1. `maze.js`: añadir `releaseDelay` a las 4 entradas de `GHOST_STARTS`. La partida sigue igual (campo aún sin usar). Prueba: carga sin errores en consola.
2. `game.js`: reescribir el avance de `moveGhost()` para moverse como máximo hasta el siguiente borde de celda, alinear en cada celda, decidir ahí y continuar el remanente del frame. Prueba manual: ningún fantasma atraviesa paredes ni "salta" celdas; siguen atrapados en la pen por la heurística actual (comportamiento de partida).
3. `game.js`: añadir `phase` y `releaseTimer` en `createGame()` y `resetPositions()`; `moveGhost()` en `waiting` no se mueve, en `exiting` se dirige a (13,11) ignorando su `kind`, y al llegar pasa a `free`. Prueba manual: salen uno por uno cruzando la puerta, en orden hunter → random → erratic → timid.
4. `game.js`: `canMove()`/`isWall()` reciben la fase del fantasma: celda 3 bloquea a los `free` y deja pasar a los `exiting`. Prueba manual: un fantasma ya fuera no vuelve a entrar.
5. Verificación final en navegador: partida completa con reinicio por vida, salida escalonada repetida y comportamientos (`hunter/random/erratic/timid`) intactos tras salir.

## Criterios de aceptación

- [ ] Al iniciar, el hunter sale de inmediato y random/erratic/timid lo hacen a ~2 s, ~4 s y ~6 s respectivamente.
- [ ] Los fantasmas en `waiting` están quietos en su posición inicial.
- [ ] Cada fantasma sale cruzando la celda puerta (3) en la columna 13 y llega a (13,11).
- [ ] Mientras está en `exiting` el fantasma ignora su personalidad; al llegar a `free` la recupera.
- [ ] Ningún fantasma atraviesa paredes ni "teleporta" celdas con velocidades 0.07/0.08/0.09.
- [ ] Un fantasma `free` no puede volver a entrar a la pen; Pacman tampoco cruza la puerta.
- [ ] Un fantasma `waiting` o `exiting` sigue matando a Pacman al colisionar.
- [ ] Al perder una vida, los 4 fantasmas vuelven a la pen y repiten la salida escalonada.
- [ ] La partida puede llegar a GANASTE o PERDISTE sin errores en consola.

## Decisiones

- **Sí:** timers escalonados en frames (0/120/240/360) — determinista, verificable y consistente con el `modeTimer` del erratic de SPEC 01.
- **Sí:** salida por la columna 13 — la puerta está en las columnas 13–14 y la 13 conecta con el pasillo de la fila 11.
- **Sí:** clamp por borde de celda con remanente — mantiene velocidades y feeling, y elimina el cruce de paredes sin cambiar de actor.
- **Sí:** fase por fantasma separada de `game.state` — `game.state` describe la partida, `g.phase` describe al actor.
- **Sí:** los fantasmas esperan quietos (sin oscilar) en la pen — más simple de verificar.
- **No:** teletransportar fantasmas al mapa — rompe la lectura visual de la salida.
- **No:** permitir re-entrada a la pen — se reserva para un futuro modo "comido".
- **No:** ajustar velocidades a fracciones 1/N ni tocar el movimiento de Pacman (su 0.1 alinea bien).
- **No:** cambios en `render.js` — los estados nuevos no requieren dibujo distinto.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Amontonamiento de fantasmas esperando en la pen | Posiciones iniciales separadas (x = 12–15); al salir uno, los `waiting` no se mueven y no hay colisión entre fantasmas. |
| Bucle o doble decisión por el remanente en un frame | El avance es siempre menor a 1 celda/frame; el bucle cruza a lo sumo un borde por frame y se verifica en el paso 5. |
| Cambio de fase `exiting` → `free` justo en la puerta | El cambio ocurre en (13,11), ya fuera de la celda 3. |
| Regresión en los comportamientos de SPEC 01 | La personalidad solo se consulta en `free`; prueba manual de los 4 `kind` en el paso 5. |

## Qué **no** está en este spec

- Power pellets y modo asustado.
- Modo "comido" y re-entrada a la pen.
- Cambios de velocidad, dificultad, niveles o audio.
- Animaciones o cambios visuales en `render.js`.
