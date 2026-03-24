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
