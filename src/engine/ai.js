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

// Todas las casas son del board (compartidas). indices 0-3 = izquierda, 4-7 = derecha.
// allHouses = [...human.houses, ...ai.houses] segun useGameLoop

// Buscar movimiento en casas (todas las casas del board)
function findHouseMove(card, source, houseIndex, allHouses) {
  for (let ti = 0; ti < allHouses.length; ti++) {
    if (ti === houseIndex) continue;
    if (canPlayToHouse(card, allHouses[ti])) {
      return { card, source, houseIndex, type: "house", target: ti };
    }
  }
  return null;
}

// Buscar si mover una carta de encima libera una carta obligatoria (fundacion)
function findUncoverMove(ai, human, foundations, allHouses) {
  // allHouses aqui son todas las casas del board
  for (let hi = 0; hi < allHouses.length; hi++) {
    const house = allHouses[hi];
    if (house.length < 2) continue;
    const buried = house[house.length - 2];
    if (!canPlayToFoundation(buried, foundations)) continue;
    // La carta encima puede moverse?
    const top = house[house.length - 1];
    const move = findHouseMove(top, "house", hi, allHouses);
    if (move) return move;
  }
  return null;
}

// Nivel Experto: evalua todas las jugadas posibles con prioridades correctas
function getExpertMove(ai, human, foundations) {
  const allHouses = [...human.houses, ...ai.houses];
  const playable = getAIPlayable(ai);

  // 1. OBLIGATORIO: cartas superficiales a fundaciones
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }

  // 2. OBLIGATORIO: desenterrar carta que debe ir a fundacion (1 movimiento)
  const uncover = findUncoverMove(ai, human, foundations, allHouses);
  if (uncover) return uncover;

  // 3. OBLIGATORIO: llenar casas vacias — con crapette primero, luego flipped
  const emptyIdx = allHouses.findIndex(h => h.length === 0);
  if (emptyIdx >= 0) {
    const crapetteTop = getTopCard(ai.crapette);
    if (crapetteTop) {
      return { card: { ...crapetteTop, faceUp: true }, source: "crapette", type: "house", target: emptyIdx };
    }
    if (ai.flippedCard) {
      return { card: ai.flippedCard, source: "flipped", type: "house", target: emptyIdx };
    }
  }

  // 4. DESARROLLO: vaciar crapette — jugar crapette a cualquier casa valida
  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) {
    const cCard = { ...crapetteTop, faceUp: true };
    const move = findHouseMove(cCard, "crapette", -1, allHouses);
    if (move) return move;
    // Tambien al rival si aplica
    if (canPlayToRivalDiscard(cCard, human.crapette)) {
      return { card: cCard, source: "crapette", houseIndex: undefined, type: "rival_crapette" };
    }
    if (canPlayToRivalDiscard(cCard, human.discard)) {
      return { card: cCard, source: "crapette", houseIndex: undefined, type: "rival_discard" };
    }
  }

  // 5. DESARROLLO: jugar flipped/talon a casas o pilas del rival
  if (ai.flippedCard) {
    // Primero al rival si aplica
    if (canPlayToRivalDiscard(ai.flippedCard, human.crapette)) {
      return { card: ai.flippedCard, source: "flipped", houseIndex: undefined, type: "rival_crapette" };
    }
    if (canPlayToRivalDiscard(ai.flippedCard, human.discard)) {
      return { card: ai.flippedCard, source: "flipped", houseIndex: undefined, type: "rival_discard" };
    }
    // Luego a casas
    const move = findHouseMove(ai.flippedCard, "flipped", -1, allHouses);
    if (move) return move;
  }

  // 5b. Mover cartas de casas al rival o entre casas (desarrollo posicional)
  for (let si = 0; si < allHouses.length; si++) {
    const card = getTopCard(allHouses[si]);
    if (!card) continue;
    if (canPlayToRivalDiscard(card, human.crapette)) {
      return { card, source: "house", houseIndex: si, type: "rival_crapette" };
    }
    if (canPlayToRivalDiscard(card, human.discard)) {
      return { card, source: "house", houseIndex: si, type: "rival_discard" };
    }
  }
  for (let si = 0; si < allHouses.length; si++) {
    const card = getTopCard(allHouses[si]);
    if (!card) continue;
    const move = findHouseMove(card, "house", si, allHouses);
    if (move) return move;
  }

  return null;
}

// Nivel Medio: mezcla basico y experto
function getMediumMove(ai, human, foundations) {
  // Siempre intenta jugadas — basico primero, luego experto
  const basic = getBasicMove(ai, human, foundations);
  if (basic) return basic;
  return getExpertMove(ai, human, foundations);
}

// Ultimo movimiento para evitar loops
let lastAIMove = null;

export function getAIMove(ai, human, foundations, level) {
  let move;
  switch (level) {
    case "basic":  move = getBasicMove(ai, human, foundations); break;
    case "expert": move = getExpertMove(ai, human, foundations); break;
    case "medium":
    default:       move = getMediumMove(ai, human, foundations);
  }

  // Detectar loop: si el movimiento deshace el anterior, ignorarlo
  if (move && lastAIMove) {
    const isLoop = (
      move.type === "house" &&
      lastAIMove.type === "house" &&
      move.card.id === lastAIMove.card.id &&
      move.target === lastAIMove.houseIndex
    );
    if (isLoop) {
      lastAIMove = null;
      return null;
    }
  }

  lastAIMove = move;
  return move;
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
