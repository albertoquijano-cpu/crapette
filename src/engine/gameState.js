// gameState.js — Estado completo de la partida

import { createDeck, dealCards } from "./deck.js";

export const GAME_MODES = {
  VICTORY_CRAPETTE: "crapette",   // Gana quien vacíe su Crapette primero
  VICTORY_ALL: "all",             // Gana quien termine todas sus cartas
};

export const AI_LEVELS = {
  BASIC: "basic",
  MEDIUM: "medium",
  EXPERT: "expert",
};

export const GAME_PHASES = {
  SETUP: "setup",
  HUMAN_TURN: "human_turn",
  HUMAN_CRAPETTE: "human_crapette",   // Fase: jugando cartas del crapette
  HUMAN_TALON: "human_talon",         // Fase: jugando cartas del talon
  AI_TURN: "ai_turn",
  AI_CRAPETTE: "ai_crapette",
  AI_TALON: "ai_talon",
  STOP_DECLARED: "stop_declared",     // Stop declarado, pendiente evaluacion
  STOP_EVALUATION: "stop_evaluation",
  GAME_OVER: "game_over",
  REPLAY: "replay",
};

// Fases activas del humano
export const HUMAN_PHASES = ["human_turn", "human_crapette", "human_talon"];
// Fases activas de la IA
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
    // Configuracion
    victoryMode,
    aiLevel,
    aiSpeed,
    penaltyEnabled,

    // Fundaciones centrales: 8 pilas (4 por jugador origen, pero compartidas)
    // Indexadas por palo: spades, hearts, diamonds, clubs (x2 mazos)
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

    // Estado del humano
    human: {
      crapette: humanDealt.crapette,
      houses: humanDealt.houses,
      talon: humanDealt.talon,
      discard: [],
      flippedCard: null,
    },

    // Estado de la IA
    ai: {
      crapette: aiDealt.crapette,
      houses: aiDealt.houses,
      talon: aiDealt.talon,
      discard: [],
      flippedCard: null,
    },

    // Control de turno
    phase: GAME_PHASES.HUMAN_TURN,
    currentPlayer: "human",
    turnNumber: 0,
    winner: null,
    crapetteUsedThisTurn: false,  // Ya no puede usar crapette este turno
    mandatoryMoves: [],           // Jugadas obligatorias pendientes
    stopMessage: "",
    stopValid: null,

    // Historial para replay
    history: [],

    // Stop
    stopDeclared: false,
    stopValid: null,
    stopMessage: "",

    // Mensaje de estado para la UI
    statusMessage: "Tu turno — comienza la partida",
  };
}

export function getTopCard(pile) {
  return pile[pile.length - 1];
}

export function isCrapetteEmpty(playerState) {
  return playerState.crapette.length === 0;
}

export function isTalonEmpty(playerState) {
  return playerState.talon.length === 0;
}

export function isDiscardEmpty(playerState) {
  return playerState.discard.length === 0;
}

export function canUseDiscard(playerState) {
  return isCrapetteEmpty(playerState);
}

export function getTotalCards(playerState) {
  const crapette = playerState.crapette.length;
  const houses = playerState.houses.reduce((sum, h) => sum + h.length, 0);
  const talon = playerState.talon.length;
  const discard = playerState.discard.length;
  const flipped = playerState.flippedCard ? 1 : 0;
  return crapette + houses + talon + discard + flipped;
}

export function checkVictory(state) {
  for (const player of ["human", "ai"]) {
    const ps = state[player];
    if (state.victoryMode === GAME_MODES.VICTORY_CRAPETTE) {
      if (isCrapetteEmpty(ps)) return player;
    } else {
      if (getTotalCards(ps) === 0) return player;
    }
  }
  return null;
}
