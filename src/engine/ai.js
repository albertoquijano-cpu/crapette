// ai.js - Logica de IA con casas compartidas del tablero

import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard, canPlayToRivalCrapette } from "./rules.js";
import { getTopCard } from "./gameState.js";

// Cartas jugables de la IA (crapette, flipped, discard)
// houses: state.houses (todas las casas del tablero)
function getAIPlayable(ai, houses) {
  const cards = [];

  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) cards.push({ card: { ...crapetteTop, faceUp: true }, source: "crapette" });

  if (ai.flippedCard) cards.push({ card: ai.flippedCard, source: "flipped" });

  houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });

  if (ai.crapette.length === 0) {
    const discardTop = getTopCard(ai.discard);
    if (discardTop) cards.push({ card: discardTop, source: "discard" });
  }

  return cards;
}

// Buscar destino en casas para una carta (evitar origen y destinos ya visitados)
function findHouseMove(card, source, fromIndex, houses, visited = []) {
  for (let ti = 0; ti < houses.length; ti++) {
    if (ti === fromIndex) continue;
    if (visited.includes(ti)) continue;
    if (canPlayToHouse(card, houses[ti])) {
      return { card, source, houseIndex: fromIndex, type: "house", target: ti };
    }
  }
  return null;
}

// Buscar movimiento que desentierr carta util hasta maxDepth niveles de profundidad
// maxDepth=1: solo 1 carta encima, maxDepth=Infinity: cualquier profundidad
function findUncoverMove(houses, foundations, human, maxDepth = 1) {
  for (let hi = 0; hi < houses.length; hi++) {
    const house = houses[hi];
    if (house.length < 2) continue;
    // Buscar en cada nivel de profundidad hasta maxDepth
    for (let depth = 1; depth <= Math.min(maxDepth, house.length - 1); depth++) {
      const buried = house[house.length - 1 - depth];
      const goesToFoundation = canPlayToFoundation(buried, foundations);
      const goesToRivalDiscard = human && human.discard && canPlayToRivalDiscard(buried, human.discard);
      const goesToRivalCrapette = human && human.crapette && canPlayToRivalCrapette(buried, human.crapette);
      if (!goesToFoundation && !goesToRivalDiscard && !goesToRivalCrapette) continue;
      // La carta encima (depth-1 niveles arriba de la enterrada) puede moverse?
      const top = house[house.length - depth];
      const move = findHouseMove(top, "house", hi, houses, []);
      if (move) return move;
    }
  }
  return null;
}

// Nivel Basico: solo jugadas a fundaciones evidentes
function getBasicMove(ai, human, houses, foundations) {
  const playable = getAIPlayable(ai, houses);
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }
  return null;
}

// Nivel Experto: prioridades correctas
function getExpertMove(ai, human, houses, foundations, moveHistory) {
  const playable = getAIPlayable(ai, houses);

  // Destinos ya visitados por cada carta (para evitar loops)
  const visitedFor = (cardId, fromIdx) => moveHistory
    .filter(k => k.startsWith(cardId + ":" + fromIdx + ">"))
    .map(k => parseInt(k.split(">")[1]));

  // 1. OBLIGATORIO: cartas superficiales a fundaciones
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }

  // 2. OBLIGATORIO: desenterrar carta que debe ir a fundacion (cualquier profundidad)
  const uncover = findUncoverMove(houses, foundations, human, Infinity);
  if (uncover) return uncover;

  // 3. OBLIGATORIO: llenar casas vacias con crapette primero
  const emptyIdx = houses.findIndex(h => h.length === 0);
  if (emptyIdx >= 0) {
    const crapetteTop = getTopCard(ai.crapette);
    if (crapetteTop) {
      return { card: { ...crapetteTop, faceUp: true }, source: "crapette", houseIndex: undefined, type: "house", target: emptyIdx };
    }
    if (ai.flippedCard) {
      return { card: ai.flippedCard, source: "flipped", houseIndex: undefined, type: "house", target: emptyIdx };
    }
  }

  // 4. Vaciar crapette: jugar crapette a casas o rival
  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) {
    const cCard = { ...crapetteTop, faceUp: true };
    const visited = visitedFor(cCard.id, -1);
    const move = findHouseMove(cCard, "crapette", -1, houses, visited);
    if (move) return move;
    if (canPlayToRivalCrapette(cCard, human.crapette)) return { card: cCard, source: "crapette", type: "rival_crapette" };
    if (canPlayToRivalDiscard(cCard, human.discard)) return { card: cCard, source: "crapette", type: "rival_discard" };
  }

  // 5. Jugar flipped al rival o casas
  if (ai.flippedCard) {
    if (canPlayToRivalCrapette(ai.flippedCard, human.crapette)) return { card: ai.flippedCard, source: "flipped", type: "rival_crapette" };
    if (canPlayToRivalDiscard(ai.flippedCard, human.discard)) return { card: ai.flippedCard, source: "flipped", type: "rival_discard" };
    const visited = visitedFor(ai.flippedCard.id, -1);
    const move = findHouseMove(ai.flippedCard, "flipped", -1, houses, visited);
    if (move) return move;
  }

  // 6. Enviar cartas de casas al rival
  const rivalTargets = [
    { pile: human.crapette, type: "rival_crapette" },
    { pile: human.discard, type: "rival_discard" },
  ];
  for (const { pile, type } of rivalTargets) {
    for (let si = 0; si < houses.length; si++) {
      const card = getTopCard(houses[si]);
      if (!card) continue;
      const canPlay = type === "rival_crapette" ? canPlayToRivalCrapette(card, pile) : canPlayToRivalDiscard(card, pile);
      if (canPlay) {
        return { card, source: "house", houseIndex: si, type };
      }
    }
  }

  // 7. Mover cartas entre casas para crear espacios (sin simulacion para evitar bugs)
  for (let si = 0; si < houses.length; si++) {
    const card = getTopCard(houses[si]);
    if (!card) continue;
    const move = findHouseMove(card, "house", si, houses, []);
    if (move) return move;
  }

  return null;
}

function getMediumMove(ai, human, houses, foundations, moveHistory) {
  const playable = getAIPlayable(ai, houses);

  // 1. OBLIGATORIO: cartas superficiales a fundaciones (igual que basico)
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }

  // 2. Desenterrar carta util — solo 1 nivel de profundidad
  const uncover = findUncoverMove(houses, foundations, human, 1);
  if (uncover) return uncover;

  // 3. Llenar casas vacias con crapette
  const emptyIdx = houses.findIndex(h => h.length === 0);
  if (emptyIdx >= 0) {
    const crapetteTop = getTopCard(ai.crapette);
    if (crapetteTop) return { card: { ...crapetteTop, faceUp: true }, source: "crapette", houseIndex: undefined, type: "house", target: emptyIdx };
    if (ai.flippedCard) return { card: ai.flippedCard, source: "flipped", houseIndex: undefined, type: "house", target: emptyIdx };
  }

  // 4. Jugar crapette a casas
  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) {
    const cCard = { ...crapetteTop, faceUp: true };
    const move = findHouseMove(cCard, "crapette", -1, houses, []);
    if (move) return move;
  }

  // 5. Jugar flipped a casas
  if (ai.flippedCard) {
    const move = findHouseMove(ai.flippedCard, "flipped", -1, houses, []);
    if (move) return move;
  }

  return null;
}

// Historial de movimientos para detectar loops
const aiMoveHistory = [];
const HISTORY_SIZE = 8;

export function getAIMove(ai, human, houses, foundations, level) {
  let move;
  switch (level) {
    case "basic":  move = getBasicMove(ai, human, houses, foundations); break;
    case "expert": move = getExpertMove(ai, human, houses, foundations, aiMoveHistory); break;
    case "medium":
    default:       move = getMediumMove(ai, human, houses, foundations, aiMoveHistory);
  }

  if (!move) {
    aiMoveHistory.length = 0;
    return null;
  }

  // Registrar movimiento en historial (solo casas)
  if (move.type === "house") {
    const moveKey = (move.card.id || "?") + ":" + (move.houseIndex ?? -1) + ">" + move.target;
    // Detectar ping-pong directo
    if (aiMoveHistory.length > 0) {
      const lastKey = aiMoveHistory[aiMoveHistory.length - 1];
      const reverseKey = (move.card.id || "?") + ":" + move.target + ">" + (move.houseIndex ?? -1);
      if (lastKey === reverseKey) {
        aiMoveHistory.length = 0;
        return null;
      }
    }
    aiMoveHistory.push(moveKey);
    if (aiMoveHistory.length > HISTORY_SIZE) aiMoveHistory.shift();
  } else {
    aiMoveHistory.length = 0;
  }

  return move;
}

export function applyAIMove(state, move) {
  if (!move) return null;

  // Clonar estado
  const houses = state.houses.map(h => [...h]);
  const ai = {
    ...state.ai,
    crapette: [...state.ai.crapette],
    discard: [...state.ai.discard],
    talon: [...state.ai.talon],
  };
  const human = {
    ...state.human,
    crapette: [...state.human.crapette],
    discard: [...state.human.discard],
  };
  const foundations = { ...state.foundations };

  // Quitar carta de su origen
  const removeFromSource = () => {
    if (move.source === "crapette") {
      ai.crapette.pop();
      if (ai.crapette.length > 0)
        ai.crapette[ai.crapette.length - 1] = { ...ai.crapette[ai.crapette.length - 1], faceUp: true };
    } else if (move.source === "house") {
      houses[move.houseIndex].pop();
    } else if (move.source === "discard") {
      ai.discard.pop();
    } else if (move.source === "flipped") {
      ai.flippedCard = null;
    }
  };

  if (move.type === "foundation") {
    removeFromSource();
    foundations[move.target] = [...(foundations[move.target] || []), { ...move.card, faceUp: true }];
  } else if (move.type === "house") {
    removeFromSource();
    houses[move.target].push({ ...move.card, faceUp: true });
  } else if (move.type === "rival_discard") {
    removeFromSource();
    human.discard.push({ ...move.card, faceUp: true });
  } else if (move.type === "rival_crapette") {
    removeFromSource();
    human.crapette.push({ ...move.card, faceUp: true });
    human.crapette[human.crapette.length - 1] = { ...human.crapette[human.crapette.length - 1], faceUp: true };
  }

  return { ...state, houses, ai, human, foundations };
}
