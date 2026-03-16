// ai.js — Logica de IA en tres niveles

import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard, getPlayableCards, getMandatoryFoundationMoves } from "./rules.js";
import { getTopCard } from "./gameState.js";

// ─── Nivel Basico ─────────────────────────────────────────────────────────
// Solo juega cartas evidentes que esten en superficie hacia fundaciones

function getBasicMove(playerState, rivalState, foundations) {
  const canDiscard = playerState.crapette.length === 0;
  const playable = getPlayableCards(playerState, canDiscard);

  for (const { card, source, houseIndex } of playable) {
    const foundationKey = canPlayToFoundation(card, foundations);
    if (foundationKey) return { card, source, houseIndex, type: "foundation", target: foundationKey };
  }
  return null;
}

// ─── Nivel Experto ────────────────────────────────────────────────────────
// Evalua todas las jugadas posibles y elige la optima

function getExpertMove(playerState, rivalState, foundations) {
  const canDiscard = playerState.crapette.length === 0;
  const playable = getPlayableCards(playerState, canDiscard);

  // Primero jugadas obligatorias a fundaciones
  for (const { card, source, houseIndex } of playable) {
    const foundationKey = canPlayToFoundation(card, foundations);
    if (foundationKey) return { card, source, houseIndex, type: "foundation", target: foundationKey };
  }

  // Luego mover de Crapette a casas si es posible
  const crapetteTop = getTopCard(playerState.crapette);
  if (crapetteTop) {
    for (let i = 0; i < playerState.houses.length; i++) {
      if (canPlayToHouse(crapetteTop, playerState.houses[i])) {
        return { card: crapetteTop, source: "crapette", type: "house", target: i };
      }
    }
  }

  // Mover entre casas para descubrir cartas utiles
  for (let si = 0; si < playerState.houses.length; si++) {
    const card = getTopCard(playerState.houses[si]);
    if (!card) continue;
    for (let ti = 0; ti < playerState.houses.length; ti++) {
      if (si === ti) continue;
      if (canPlayToHouse(card, playerState.houses[ti])) {
        return { card, source: "house", houseIndex: si, type: "house", target: ti };
      }
    }
  }

  // Jugar al descarte del rival
  const canDiscardRival = playerState.crapette.length === 0;
  if (canDiscardRival) {
    const discardTop = getTopCard(playerState.discard);
    if (discardTop) {
      if (canPlayToRivalDiscard(discardTop, rivalState.discard)) {
        return { card: discardTop, source: "discard", type: "rival_discard" };
      }
    }
  }

  return null;
}

// ─── Nivel Medio ──────────────────────────────────────────────────────────
// Con probabilidad aleatoria alterna entre basico y experto

function getMediumMove(playerState, rivalState, foundations) {
  const mandatory = getMandatoryFoundationMoves(playerState, foundations);
  if (mandatory.length > 0) return mandatory[0];

  const useExpert = Math.random() > 0.5;
  if (useExpert) return getExpertMove(playerState, rivalState, foundations);
  return getBasicMove(playerState, rivalState, foundations);
}

// ─── Selector de nivel ────────────────────────────────────────────────────

export function getAIMove(playerState, rivalState, foundations, level) {
  switch (level) {
    case "basic":  return getBasicMove(playerState, rivalState, foundations);
    case "expert": return getExpertMove(playerState, rivalState, foundations);
    case "medium":
    default:       return getMediumMove(playerState, rivalState, foundations);
  }
}

// ─── Aplicar movimiento de la IA al estado ────────────────────────────────

export function applyAIMove(state, move) {
  if (!move) return null; // Sin jugadas, termina turno

  const ai = { ...state.ai };
  const foundations = { ...state.foundations };

  if (move.type === "foundation") {
    if (move.source === "crapette") ai.crapette = ai.crapette.slice(0, -1);
    else if (move.source === "house") ai.houses[move.houseIndex] = ai.houses[move.houseIndex].slice(0, -1);
    else if (move.source === "discard") ai.discard = ai.discard.slice(0, -1);
    foundations[move.target] = [...foundations[move.target], { ...move.card, faceUp: true }];
  } else if (move.type === "house") {
    if (move.source === "crapette") ai.crapette = ai.crapette.slice(0, -1);
    else if (move.source === "house") ai.houses[move.houseIndex] = ai.houses[move.houseIndex].slice(0, -1);
    else if (move.source === "discard") ai.discard = ai.discard.slice(0, -1);
    ai.houses[move.target] = [...ai.houses[move.target], { ...move.card, faceUp: true }];
  } else if (move.type === "rival_discard") {
    ai.discard = ai.discard.slice(0, -1);
  }

  return { ...state, ai, foundations };
}
