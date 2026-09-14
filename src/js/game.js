// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.1; // 1/10 celda/frame -> alinea cada 10 frames
const ERRATIC_MODE_FRAMES = 300; // 300 frames ≈ 5 s a 60 fps
const TIMID_FLEE_DIST = 6;       // huye si Pacman esta a menos de 6 celdas
const TIMID_PATROL = { x: 1, y: 1 }; // esquina de patrulla del timido
const PEN_EXIT = { x: 13, y: 11 }; // celda de salida: cruzando la puerta de la col 13

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: g.speed,
      kind: g.kind,
      phase: 'waiting',
      releaseTimer: g.releaseDelay,
      ...( g.kind === 'erratic'
        ? { mode: 'chase', modeTimer: ERRATIC_MODE_FRAMES }
        : {} ),
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Distancia hasta el siguiente borde de celda en la direccion delta (-1, 0, 1).
function distToEdge( v, delta ) {
  if ( delta > 0 ) return Math.floor( v + 1e-6 ) + 1 - v;
  if ( delta < 0 ) return v - ( Math.ceil( v - 1e-6 ) - 1 );
  return Infinity;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); la puerta (3) solo la cruzan los 'exiting'
function isWall( grid, x, y, actor, phase ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) {
    if ( actor === 'pacman' ) return true;
    if ( actor === 'ghost' && phase !== 'exiting' ) return true;
  }
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor, phase ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor, phase );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Elige la direccion greedy (Manhattan) que mas acerca a (tx,ty),
// o que mas aleja si maximize es true.
function greedyDir( g, choices, tx, ty, maximize ) {
  let best = choices[ 0 ];
  let bestDist = maximize ? -Infinity : Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    const better = maximize ? dist > bestDist : dist < bestDist;
    if ( better ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function pacmanDist( game, g ) {
  const p = game.pacman;
  return Math.abs( Math.round( g.x ) - Math.round( p.x ) )
    + Math.abs( Math.round( g.y ) - Math.round( p.y ) );
}

function chaseDir( game, g, choices ) {
  const p = game.pacman;
  return greedyDir( g, choices, Math.round( p.x ), Math.round( p.y ), false );
}

function wanderDir( choices ) {
  return choices[ Math.floor( Math.random() * choices.length ) ];
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost', g.phase )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( g.kind === 'hunter' ) {
    g.dir = chaseDir( game, g, choices );
  } else if ( g.kind === 'erratic' ) {
    g.dir = g.mode === 'chase'
      ? chaseDir( game, g, choices )
      : wanderDir( choices );
  } else if ( g.kind === 'timid' ) {
    // Huye de Pacman si esta cerca; si no, patrulla hacia su esquina.
    if ( pacmanDist( game, g ) < TIMID_FLEE_DIST ) {
      const p = game.pacman;
      g.dir = greedyDir( g, choices, Math.round( p.x ), Math.round( p.y ), true );
    } else {
      g.dir = greedyDir( g, choices, TIMID_PATROL.x, TIMID_PATROL.y, false );
    }
  } else {
    g.dir = wanderDir( choices );
  }
}

// Direccion de salida: horizontal hasta la columna 13 en la fila de la pen,
// y luego hacia arriba hasta (13,11). Ignora la personalidad del fantasma.
function exitDir( g ) {
  if ( g.y === TUNNEL_ROW && g.x !== PEN_EXIT.x ) {
    return g.x > PEN_EXIT.x ? 'left' : 'right';
  }
  return 'up';
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Alterna entre perseguir (chase) y vagar (wander) cada ~5 s.
  // Se decrementa por frame (no al alinearse) para que el ciclo sea real.
  if ( g.kind === 'erratic' ) {
    g.modeTimer--;
    if ( g.modeTimer <= 0 ) {
      g.mode = g.mode === 'chase' ? 'wander' : 'chase';
      g.modeTimer = ERRATIC_MODE_FRAMES;
    }
  }

  // En la pen espera quieto hasta que termine su temporizador de liberacion.
  if ( g.phase === 'waiting' ) {
    g.releaseTimer--;
    if ( g.releaseTimer > 0 ) return;
    g.phase = 'exiting';
  }

  // Avanza como maximo hasta el siguiente borde de celda, decide en cada
  // celda y continua con el remanente del frame.
  let remaining = g.speed;
  while ( remaining > 1e-9 ) {
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );

      if ( g.phase === 'exiting' ) {
        if ( g.x === PEN_EXIT.x && g.y === PEN_EXIT.y ) {
          g.phase = 'free';
        } else {
          g.dir = exitDir( g );
        }
      }
      if ( g.phase === 'free' ) decideGhost( game, g );
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', g.phase ) ) return;
    }

    const d = DIRS[ g.dir ];
    const edgeDist = Math.min(
      d.x !== 0 ? distToEdge( g.x, d.x ) : Infinity,
      d.y !== 0 ? distToEdge( g.y, d.y ) : Infinity
    );
    const step = Math.min( remaining, edgeDist );

    g.x += d.x * step;
    g.y += d.y * step;
    wrapTunnel( g, width );
    remaining -= step;
  }
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.phase = 'waiting';
    g.releaseTimer = GHOST_STARTS[ i ].releaseDelay;
    if ( g.kind === 'erratic' ) {
      g.mode = 'chase';
      g.modeTimer = ERRATIC_MODE_FRAMES;
    }
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
