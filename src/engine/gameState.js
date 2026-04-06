// gameState.js — Estado completo de la partida
// Arquitectura nueva: pilas numeradas, posición relativa

import {
  createDeck, dealCards,
  PILES, HOUSE_PILES, FOUND_PILES, SUIT_FOUNDATIONS,
} from './deck.js';

// ── Fases del juego ──────────────────────────────────────────────────────────
export const GAME_PHASES = {
  SETUP:           'setup',
  HUMAN_TURN:      'human_turn',
  AI_TURN:         'ai_turn',
  GAME_OVER:       'game_over',
};

export const GAME_MODES = {
  VICTORY_CRAPETTE: 'crapette',  // gana quien vacía su crapette primero
  VICTORY_ALL:      'all',       // gana quien vacía todo
};

export const AI_LEVELS = {
  BASIC:  'basic',   // solo cartas en pos=0
  MEDIUM: 'medium',  // cartas en pos=0 y pos=1
  EXPERT: 'expert',  // cualquier profundidad
};

// ── Estado inicial ────────────────────────────────────────────────────────────
export function createInitialState(config = {}) {
  const {
    victoryMode  = GAME_MODES.VICTORY_CRAPETTE,
    aiLevel      = AI_LEVELS.MEDIUM,
    aiSpeed      = 1000,
    penaltyEnabled = true,
  } = config;

  const humanDeck = createDeck('h');
  const aiDeck    = createDeck('a');

  const humanDealt = dealCards(humanDeck, PILES.HUMAN_CRAPETTE, PILES.HUMAN_TALON);
  const aiDealt    = dealCards(aiDeck,    PILES.AI_CRAPETTE,    PILES.AI_TALON);

  // ── Fundaciones: objeto con clave = ID de pila ──────────────────────────
  // Cada fundación empieza vacía. Cualquier jugador puede depositar en cualquiera.
  const foundations = {};
  for (const id of FOUND_PILES) foundations[id] = [];

  // ── Casas del tablero ───────────────────────────────────────────────────
  // Casas 1-4: cartas iniciales de la IA (lado izquierdo en pantalla)
  // Casas 5-8: cartas iniciales del humano (lado derecho en pantalla)
  const houses = {};
  for (const id of HOUSE_PILES) houses[id] = [];

  // Colocar cartas iniciales de la IA en casas 1-4
  aiDealt.startingHouses.forEach((card, i) => {
    const pileId = HOUSE_PILES[i]; // 1,2,3,4
    houses[pileId] = [{ ...card, pile: pileId, pos: 0, faceUp: true }];
  });

  // Colocar cartas iniciales del humano en casas 5-8
  humanDealt.startingHouses.forEach((card, i) => {
    const pileId = HOUSE_PILES[4 + i]; // 5,6,7,8
    houses[pileId] = [{ ...card, pile: pileId, pos: 0, faceUp: true }];
  });

  return {
    victoryMode,
    aiLevel,
    aiSpeed,
    penaltyEnabled,

    foundations,  // { 9: [], 10: [], 11: [], 12: [], 13: [], 14: [], 15: [], 16: [] }
    houses,       // { 1: [carta], 2: [carta], ..., 8: [carta] }

    human: {
      crapette: humanDealt.crapette,  // array de cartas, last = pos 0
      talon:    humanDealt.talon,     // array de cartas, last = pos 0
      discard:  [],
      flipped:  null,                 // carta volteada del talon (zona temporal)
    },

    ai: {
      crapette: aiDealt.crapette,
      talon:    aiDealt.talon,
      discard:  [],
      flipped:  null,
    },

    phase:         GAME_PHASES.HUMAN_TURN,
    currentPlayer: 'human',
    turnNumber:    0,
    winner:        null,

    // Stop
    stopDeclared:  false,
    stopValid:     null,
    stopMessage:   '',

    statusMessage: 'Tu turno — comienza la partida',
  };
}

// ── Helpers de pilas ─────────────────────────────────────────────────────────

// Carta superior de cualquier array (la jugable, pos=0)
export function topCard(pile) {
  return pile.length > 0 ? pile[pile.length - 1] : null;
}

// Devuelve la pila real según su ID y el estado
export function getPile(state, pileId) {
  if (pileId >= 1 && pileId <= 8)   return state.houses[pileId];
  if (pileId >= 9 && pileId <= 16)  return state.foundations[pileId];
  if (pileId === PILES.HUMAN_CRAPETTE) return state.human.crapette;
  if (pileId === PILES.HUMAN_TALON)    return state.human.talon;
  if (pileId === PILES.HUMAN_DISCARD)  return state.human.discard;
  if (pileId === PILES.AI_CRAPETTE)    return state.ai.crapette;
  if (pileId === PILES.AI_TALON)       return state.ai.talon;
  if (pileId === PILES.AI_DISCARD)     return state.ai.discard;
  return null;
}

// ── Sistema de posición relativa ──────────────────────────────────────────────
// Regla: la carta superior (última del array) siempre tiene pos=0.
//        Las que están debajo tienen pos=1, 2, 3...
// Esta función recalcula y asigna las posiciones de todas las cartas de una pila.
export function recalcPositions(pile) {
  const n = pile.length;
  return pile.map((card, i) => ({
    ...card,
    pos: (n - 1) - i,  // última carta → pos 0; primera → pos n-1
  }));
}

// Recalcula posiciones de una pila dentro del estado (inmutable)
function recalcPileInState(state, pileId) {
  if (pileId >= 1 && pileId <= 8) {
    return {
      ...state,
      houses: {
        ...state.houses,
        [pileId]: recalcPositions(state.houses[pileId]),
      },
    };
  }
  if (pileId >= 9 && pileId <= 16) {
    return {
      ...state,
      foundations: {
        ...state.foundations,
        [pileId]: recalcPositions(state.foundations[pileId]),
      },
    };
  }
  // Pilas personales
  const player = pileId < 24 ? 'human' : 'ai';
  const key = {
    [PILES.HUMAN_CRAPETTE]: 'crapette',
    [PILES.HUMAN_TALON]:    'talon',
    [PILES.HUMAN_DISCARD]:  'discard',
    [PILES.AI_CRAPETTE]:    'crapette',
    [PILES.AI_TALON]:       'talon',
    [PILES.AI_DISCARD]:     'discard',
  }[pileId];
  if (!key) return state;
  return {
    ...state,
    [player]: {
      ...state[player],
      [key]: recalcPositions(state[player][key]),
    },
  };
}

// ── Mover una carta ───────────────────────────────────────────────────────────
// Quita la carta superior (pos=0) de fromPile y la pone en toPile.
// Recalcula posiciones de ambas pilas.
// La carta movida llega a toPile con pos=0 (será la nueva superior).
// Retorna nuevo estado. No muta el original.
export function moveTopCard(state, fromPileId, toPileId) {
  const fromPile = getPile(state, fromPileId);
  if (!fromPile || fromPile.length === 0) {
    console.warn('[MOVE] Pila origen vacía:', fromPileId);
    return state;
  }

  const card = { ...fromPile[fromPile.length - 1] };

  // Quitar de origen
  let s = setPile(state, fromPileId, fromPile.slice(0, -1));
  // Recalc origen
  s = recalcPileInState(s, fromPileId);

  // Agregar a destino con pile actualizado
  const toPile = getPile(s, toPileId) ?? [];
  card.pile = toPileId;
  card.faceUp = true; // siempre boca arriba al moverse al tablero
  s = setPile(s, toPileId, [...toPile, card]);
  // Recalc destino
  s = recalcPileInState(s, toPileId);

  return s;
}

// setPile: reemplaza una pila en el estado (inmutable)
function setPile(state, pileId, newPile) {
  if (pileId >= 1 && pileId <= 8) {
    return { ...state, houses: { ...state.houses, [pileId]: newPile } };
  }
  if (pileId >= 9 && pileId <= 16) {
    return { ...state, foundations: { ...state.foundations, [pileId]: newPile } };
  }
  const player = pileId <= 23 ? 'human' : 'ai';
  const key = {
    [PILES.HUMAN_CRAPETTE]: 'crapette',
    [PILES.HUMAN_TALON]:    'talon',
    [PILES.HUMAN_DISCARD]:  'discard',
    [PILES.AI_CRAPETTE]:    'crapette',
    [PILES.AI_TALON]:       'talon',
    [PILES.AI_DISCARD]:     'discard',
  }[pileId];
  if (!key) return state;
  return { ...state, [player]: { ...state[player], [key]: newPile } };
}

// ── Buscar carta por ID ───────────────────────────────────────────────────────
// Devuelve { card, pileId, indexInPile } o null
export function findCard(state, cardId) {
  const allPiles = [
    ...HOUSE_PILES.map(id => ({ id, pile: state.houses[id] })),
    ...FOUND_PILES.map(id => ({ id, pile: state.foundations[id] })),
    { id: PILES.HUMAN_CRAPETTE, pile: state.human.crapette },
    { id: PILES.HUMAN_TALON,    pile: state.human.talon },
    { id: PILES.HUMAN_DISCARD,  pile: state.human.discard },
    ...(state.human.flipped ? [{ id: PILES.HUMAN_FLIPPED, pile: [state.human.flipped] }] : []),
    { id: PILES.AI_CRAPETTE,    pile: state.ai.crapette },
    { id: PILES.AI_TALON,       pile: state.ai.talon },
    { id: PILES.AI_DISCARD,     pile: state.ai.discard },
    ...(state.ai.flipped ? [{ id: PILES.AI_FLIPPED, pile: [state.ai.flipped] }] : []),
  ];

  for (const { id, pile } of allPiles) {
    for (let i = 0; i < pile.length; i++) {
      if (pile[i].id === cardId) return { card: pile[i], pileId: id, indexInPile: i };
    }
  }
  return null;
}

// ── Victoria ──────────────────────────────────────────────────────────────────
export function checkVictory(state) {
  for (const player of ['human', 'ai']) {
    const ps = state[player];
    if (state.victoryMode === GAME_MODES.VICTORY_CRAPETTE) {
      if (ps.crapette.length === 0) return player;
    } else {
      const total = ps.crapette.length + ps.talon.length + ps.discard.length + (ps.flipped ? 1 : 0);
      if (total === 0) return player;
    }
  }
  return null;
}

// ── Talon: reconstruir desde descarte ────────────────────────────────────────
export function rebuildTalon(playerState, talonPile) {
  if (playerState.talon.length > 0) return playerState;
  if (playerState.discard.length === 0) return playerState;
  const newTalon = [...playerState.discard]
    .reverse()
    .map((c, i, arr) => ({ ...c, faceUp: false, pile: talonPile, pos: (arr.length - 1) - i }));
  return { ...playerState, talon: newTalon, discard: [] };
}

// ── Penalidad de stop fallido ────────────────────────────────────────────────
// Las últimas 3 cartas del descarte pasan al crapette
export function applyStopPenalty(playerState, crapettePile) {
  const discard  = [...playerState.discard];
  const count    = Math.min(3, discard.length);
  const penalty  = discard.splice(discard.length - count, count);
  const crapette = recalcPositions([
    ...playerState.crapette,
    ...penalty.map(c => ({ ...c, faceUp: false, pile: crapettePile })),
  ]);
  return { ...playerState, crapette, discard };
}

// ── Clonar estado (inmutable profundo) ───────────────────────────────────────
export function cloneState(s) {
  const clonePile = arr => arr.map(c => ({ ...c }));
  const clonePlayer = p => ({
    ...p,
    crapette: clonePile(p.crapette),
    talon:    clonePile(p.talon),
    discard:  clonePile(p.discard),
    flipped:  p.flipped ? { ...p.flipped } : null,
  });
  const cloneObj = obj =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, clonePile(v)]));

  return {
    ...s,
    foundations: cloneObj(s.foundations),
    houses:      cloneObj(s.houses),
    human:       clonePlayer(s.human),
    ai:          clonePlayer(s.ai),
  };
}
