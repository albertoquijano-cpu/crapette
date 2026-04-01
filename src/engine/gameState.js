// gameState.js — Estado completo de la partida

import { createDeck, dealCards } from "./deck.js";

export const GAME_MODES = {
  VICTORY_CRAPETTE: "crapette",
  VICTORY_ALL: "all",
};

export const AI_LEVELS = {
  BASIC: "basic",
  MEDIUM: "medium",
  EXPERT: "expert",
};

export const GAME_PHASES = {
  SETUP: "setup",
  HUMAN_TURN: "human_turn",
  HUMAN_CRAPETTE: "human_crapette",
  HUMAN_TALON: "human_talon",
  AI_TURN: "ai_turn",
  AI_CRAPETTE: "ai_crapette",
  AI_TALON: "ai_talon",
  STOP_DECLARED: "stop_declared",
  STOP_EVALUATION: "stop_evaluation",
  GAME_OVER: "game_over",
  REPLAY: "replay",
};

export const HUMAN_PHASES = ["human_turn", "human_crapette", "human_talon"];
export const AI_PHASES = ["ai_turn", "ai_crapette", "ai_talon"];

export function createInitialState(config = {}) {
  const {
    victoryMode = GAME_MODES.VICTORY_CRAPETTE,
    aiLevel = AI_LEVELS.MEDIUM,
    aiSpeed = 1000,
    penaltyEnabled = true,
  } = config;

  const humanDeck = createDeck("human");
  const aiDeck = createDeck("ai");

  const humanDealt = dealCards(humanDeck);
  const aiDealt = dealCards(aiDeck);

  return {
    victoryMode,
    aiLevel,
    aiSpeed,
    penaltyEnabled,

    // Fundaciones centrales: 8 pilas
    foundations: {
      spades_human: [],
      hearts_human: [],
      diamonds_human: [],
      clubs_human: [],
      spades_ai: [],
      hearts_ai: [],
      diamonds_ai: [],
      clubs_ai: [],
    },

    // Casas compartidas del tablero: 8 pilas
    // indices 0-3: lado izquierdo (antes ai.houses)
    // indices 4-7: lado derecho (antes human.houses)
    houses: [
      ...aiDealt.houses,
      ...humanDealt.houses,
    ],

    // Estado del humano (solo pilas personales)
    human: {
      crapette: humanDealt.crapette,
      talon: humanDealt.talon,
      discard: [],
      flippedCard: null,
    },

    // Estado de la IA (solo pilas personales)
    ai: {
      crapette: aiDealt.crapette,
      talon: aiDealt.talon,
      discard: [],
      flippedCard: null,
    },

    // Control de turno
    phase: GAME_PHASES.HUMAN_TURN,
    currentPlayer: "human",
    turnNumber: 0,
    winner: null,
    crapetteUsedThisTurn: false,
    mandatoryMoves: [],
    stopMessage: "",
    stopValid: null,
    stopDeclared: false,
    statusMessage: "Tu turno — comienza la partida",
  };
}

export function getTopCard(pile) {
  return pile[pile.length - 1];
}

export function isCrapetteEmpty(playerState) {
  return playerState.crapette.length === 0;
}

export function getTotalCards(playerState, houses) {
  const crapette = playerState.crapette.length;
  const talon = playerState.talon.length;
  const discard = playerState.discard.length;
  const flipped = playerState.flippedCard ? 1 : 0;
  return crapette + talon + discard + flipped;
}

export function checkVictory(state) {
  for (const player of ["human", "ai"]) {
    const ps = state[player];
    if (state.victoryMode === GAME_MODES.VICTORY_CRAPETTE) {
      if (ps.crapette.length === 0) return player;
    } else {
      // Modo vaciar todo: crapette + talon + discard + flipped = 0
      const total = ps.crapette.length + ps.talon.length + ps.discard.length + (ps.flippedCard ? 1 : 0);
      if (total === 0) return player;
    }
  }
  return null;
}

// ── Sistema de posición de cartas ─────────────────────────────────────────

// Encontrar carta por ID en el estado completo
export function findCardById(state, cardId) {
  // Buscar en casas
  for (let i = 0; i < state.houses.length; i++) {
    const pile = state.houses[i];
    for (let j = 0; j < pile.length; j++) {
      if (pile[j].id === cardId) return { card: pile[j], location: { type: 'house', index: i, pileIndex: j } };
    }
  }
  // Buscar en fundaciones
  for (const [key, pile] of Object.entries(state.foundations)) {
    for (let j = 0; j < pile.length; j++) {
      if (pile[j].id === cardId) return { card: pile[j], location: { type: 'foundation', key, pileIndex: j } };
    }
  }
  // Buscar en pilas del humano
  for (const pileType of ['crapette', 'talon', 'discard']) {
    const pile = state.human[pileType];
    for (let j = 0; j < pile.length; j++) {
      if (pile[j].id === cardId) return { card: pile[j], location: { type: pileType, player: 'human', pileIndex: j } };
    }
  }
  if (state.human.flippedCard && state.human.flippedCard.id === cardId)
    return { card: state.human.flippedCard, location: { type: 'flipped', player: 'human' } };

  // Buscar en pilas de la IA
  for (const pileType of ['crapette', 'talon', 'discard']) {
    const pile = state.ai[pileType];
    for (let j = 0; j < pile.length; j++) {
      if (pile[j].id === cardId) return { card: pile[j], location: { type: pileType, player: 'ai', pileIndex: j } };
    }
  }
  if (state.ai.flippedCard && state.ai.flippedCard.id === cardId)
    return { card: state.ai.flippedCard, location: { type: 'flipped', player: 'ai' } };

  return null; // Carta no encontrada
}

// Quitar carta de su ubicacion actual en el estado
export function removeCardFromState(state, cardId) {
  const found = findCardById(state, cardId);
  if (!found) return state;

  const { location } = found;
  const s = { ...state };

  if (location.type === 'house') {
    s.houses = s.houses.map((h, i) => i === location.index ? h.filter(c => c.id !== cardId) : h);
  } else if (location.type === 'foundation') {
    s.foundations = { ...s.foundations, [location.key]: s.foundations[location.key].filter(c => c.id !== cardId) };
  } else if (location.type === 'flipped') {
    if (location.player === 'human') s.human = { ...s.human, flippedCard: null };
    else s.ai = { ...s.ai, flippedCard: null };
  } else {
    if (location.player === 'human') s.human = { ...s.human, [location.type]: s.human[location.type].filter(c => c.id !== cardId) };
    else s.ai = { ...s.ai, [location.type]: s.ai[location.type].filter(c => c.id !== cardId) };
  }

  return s;
}
