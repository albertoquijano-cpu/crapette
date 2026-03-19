// ai.js - Logica de IA en tres niveles

import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard } from "./rules.js";
import { getTopCard } from "./gameState.js";

// Obtener todas las cartas jugables de la IA
function getAIPlayable(ai) {
  const cards = [];

  // Carta superior del crapette
  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) cards.push({ card: { ...crapetteTop, faceUp: true }, source: "crapette" });

  // Carta volteada del talon
  if (ai.flippedCard) cards.push({ card: ai.flippedCard, source: "flipped" });

  // Cartas superiores de casas
  ai.houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });

  // Carta superior del descarte (solo si crapette vacio)
  if (ai.crapette.length === 0) {
    const discardTop = getTopCard(ai.discard);
    if (discardTop) cards.push({ card: discardTop, source: "discard" });
  }

  return cards;
}

// Nivel Basico: solo jugadas a fundaciones evidentes
function getBasicMove(ai, human, foundations) {
  const playable = getAIPlayable(ai);
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }
  return null;
}

// Nivel Experto: evalua todas las jugadas posibles
function getExpertMove(ai, human, foundations) {
  const playable = getAIPlayable(ai);

  // 1. Jugadas obligatorias a fundaciones (maxima prioridad)
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }

  // 2. Llenar casas vacias con crapette o flipped
  const emptyCasaIndex = ai.houses.findIndex(h => h.length === 0);
  if (emptyCasaIndex >= 0) {
    if (ai.flippedCard) {
      return { card: ai.flippedCard, source: "flipped", type: "house", target: emptyCasaIndex };
    }
    const crapetteTop = getTopCard(ai.crapette);
    if (crapetteTop) {
      return { card: { ...crapetteTop, faceUp: true }, source: "crapette", type: "house", target: emptyCasaIndex };
    }
  }

  // 3. Mover crapette o flipped a casas existentes
  const sources = [];
  if (ai.flippedCard) sources.push({ card: ai.flippedCard, source: "flipped" });
  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) sources.push({ card: { ...crapetteTop, faceUp: true }, source: "crapette" });

  for (const { card, source } of sources) {
    for (let i = 0; i < ai.houses.length; i++) {
      if (canPlayToHouse(card, ai.houses[i])) {
        return { card, source, type: "house", target: i };
      }
    }
    // Intentar en casas del humano tambien
    for (let i = 0; i < human.houses.length; i++) {
      if (canPlayToHouse(card, human.houses[i])) {
        return { card, source, type: "human_house", target: i };
      }
    }
  }

  // 4. Mover entre casas para desenterrar cartas
  for (let si = 0; si < ai.houses.length; si++) {
    const card = getTopCard(ai.houses[si]);
    if (!card) continue;
    for (let ti = 0; ti < ai.houses.length; ti++) {
      if (si === ti) continue;
      if (canPlayToHouse(card, ai.houses[ti])) {
        return { card, source: "house", houseIndex: si, type: "house", target: ti };
      }
    }
    for (let ti = 0; ti < human.houses.length; ti++) {
      if (canPlayToHouse(card, human.houses[ti])) {
        return { card, source: "house", houseIndex: si, type: "human_house", target: ti };
      }
    }
  }

  // 5. Jugar al descarte o crapette del rival
  for (const { card, source, houseIndex } of playable) {
    if (canPlayToRivalDiscard(card, human.discard)) {
      return { card, source, houseIndex, type: "rival_discard" };
    }
    if (canPlayToRivalDiscard(card, human.crapette)) {
      return { card, source, houseIndex, type: "rival_crapette" };
    }
  }

  return null;
}

// Nivel Medio: mezcla basico y experto
function getMediumMove(ai, human, foundations) {
  // Siempre hace jugadas obligatorias
  const basic = getBasicMove(ai, human, foundations);
  if (basic) return basic;
  // 50% de las veces juega experto
  if (Math.random() > 0.5) return getExpertMove(ai, human, foundations);
  return null;
}

export function getAIMove(ai, human, foundations, level) {
  switch (level) {
    case "basic":  return getBasicMove(ai, human, foundations);
    case "expert": return getExpertMove(ai, human, foundations);
    case "medium":
    default:       return getMediumMove(ai, human, foundations);
  }
}

export function applyAIMove(state, move) {
  if (!move) return null;

  const ai = { ...state.ai, houses: state.ai.houses.map(h => [...h]), crapette: [...state.ai.crapette], discard: [...state.ai.discard] };
  const human = { ...state.human, houses: state.human.houses.map(h => [...h]), crapette: [...state.human.crapette], discard: [...state.human.discard] };
  const foundations = { ...state.foundations };

  // Quitar carta de la fuente
  const removeFromAI = () => {
    if (move.source === "crapette") {
      ai.crapette.pop();
      if (ai.crapette.length > 0)
        ai.crapette[ai.crapette.length - 1] = { ...ai.crapette[ai.crapette.length - 1], faceUp: true };
    } else if (move.source === "house") {
      ai.houses[move.houseIndex].pop();
    } else if (move.source === "discard") {
      ai.discard.pop();
    } else if (move.source === "flipped") {
      ai.flippedCard = null;
    }
  };

  if (move.type === "foundation") {
    removeFromAI();
    foundations[move.target] = [...(foundations[move.target] || []), { ...move.card, faceUp: true }];
  } else if (move.type === "house") {
    removeFromAI();
    ai.houses[move.target].push({ ...move.card, faceUp: true });
  } else if (move.type === "human_house") {
    removeFromAI();
    human.houses[move.target].push({ ...move.card, faceUp: true });
  } else if (move.type === "rival_discard") {
    removeFromAI();
    human.discard.push({ ...move.card, faceUp: true });
  } else if (move.type === "rival_crapette") {
    removeFromAI();
    human.crapette.push({ ...move.card, faceUp: true });
    if (human.crapette.length > 0)
      human.crapette[human.crapette.length - 1] = { ...human.crapette[human.crapette.length - 1], faceUp: true };
  }

  return { ...state, ai, human, foundations };
}
