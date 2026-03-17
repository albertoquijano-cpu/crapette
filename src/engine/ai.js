// ai.js — Logica de IA en tres niveles

import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard, getPlayableCards, getMandatoryFoundationMoves } from "./rules.js";
import { getTopCard } from "./gameState.js";

// Obtener todas las cartas jugables de la IA
function getAIPlayable(playerState, rivalState) {
  const cards = [];
  const canDiscard = playerState.crapette.length === 0;

  // Carta superior del crapette
  const crapetteTop = getTopCard(playerState.crapette);
  if (crapetteTop) cards.push({ card: crapetteTop, source: "crapette" });

  // Carta volteada del talon
  if (playerState.flippedCard) {
    cards.push({ card: playerState.flippedCard, source: "flipped" });
  }

  // Cartas superiores de casas propias
  playerState.houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });

  // Carta superior del descarte (si crapette vacio)
  if (canDiscard) {
    const discardTop = getTopCard(playerState.discard);
    if (discardTop) cards.push({ card: discardTop, source: "discard" });
  }

  return cards;
}

// ─── Nivel Basico ─────────────────────────────────────────────────────────
function getBasicMove(playerState, rivalState, foundations) {
  const playable = getAIPlayable(playerState, rivalState);
  for (const { card, source, houseIndex } of playable) {
    const foundationKey = canPlayToFoundation(card, foundations);
    if (foundationKey) return { card, source, houseIndex, type: "foundation", target: foundationKey };
  }
  return null;
}

// ─── Nivel Experto ────────────────────────────────────────────────────────
function getExpertMove(playerState, rivalState, foundations) {
  const playable = getAIPlayable(playerState, rivalState);

  // 1. Jugadas obligatorias a fundaciones
  for (const { card, source, houseIndex } of playable) {
    const foundationKey = canPlayToFoundation(card, foundations);
    if (foundationKey) return { card, source, houseIndex, type: "foundation", target: foundationKey };
  }

  // 2. Mover flippedCard a casa
  if (playerState.flippedCard) {
    for (let i = 0; i < playerState.houses.length; i++) {
      if (canPlayToHouse(playerState.flippedCard, playerState.houses[i])) {
        return { card: playerState.flippedCard, source: "flipped", type: "house", target: i };
      }
    }
  }

  // 3. Mover crapette a casa
  const crapetteTop = getTopCard(playerState.crapette);
  if (crapetteTop) {
    for (let i = 0; i < playerState.houses.length; i++) {
      if (canPlayToHouse(crapetteTop, playerState.houses[i])) {
        return { card: crapetteTop, source: "crapette", type: "house", target: i };
      }
    }
  }

  // 4. Mover entre casas
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

  // 5. Jugar al descarte del rival
  if (playerState.crapette.length === 0 && rivalState) {
    const discardTop = getTopCard(playerState.discard);
    if (discardTop && canPlayToRivalDiscard(discardTop, rivalState.discard)) {
      return { card: discardTop, source: "discard", type: "rival_discard" };
    }
  }

  // 6. Mover al crapette del rival
  if (rivalState) {
    for (const { card, source, houseIndex } of playable) {
      if (canPlayToRivalDiscard(card, rivalState.crapette)) {
        return { card, source, houseIndex, type: "rival_crapette" };
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
  if (!move) return null;

  const ai = { ...state.ai, houses: state.ai.houses.map(h => [...h]) };
  const human = { ...state.human, houses: state.human.houses.map(h => [...h]) };
  const foundations = { ...state.foundations };

  // Quitar carta de la fuente
  const removeFromSource = () => {
    if (move.source === "crapette") {
      ai.crapette = ai.crapette.slice(0, -1);
    } else if (move.source === "house") {
      ai.houses[move.houseIndex] = ai.houses[move.houseIndex].slice(0, -1);
    } else if (move.source === "discard") {
      ai.discard = ai.discard.slice(0, -1);
    } else if (move.source === "flipped") {
      ai.flippedCard = null;
    }
  };

  if (move.type === "foundation") {
    removeFromSource();
    foundations[move.target] = [...foundations[move.target], { ...move.card, faceUp: true }];
  } else if (move.type === "house") {
    removeFromSource();
    ai.houses[move.target] = [...ai.houses[move.target], { ...move.card, faceUp: true }];
  } else if (move.type === "rival_discard") {
    removeFromSource();
    human.discard = [...human.discard, { ...move.card, faceUp: true }];
  } else if (move.type === "rival_crapette") {
    removeFromSource();
    human.crapette = [...human.crapette, { ...move.card, faceUp: true }];
  }

  // Descubrir nueva carta superior del crapette de la IA
  if (ai.crapette.length > 0) {
    ai.crapette = ai.crapette.map((c, i) => ({
      ...c,
      faceUp: i === ai.crapette.length - 1,
    }));
  }

  return { ...state, ai, human, foundations };
}
