// ai.js - Logica de IA con casas compartidas del tablero

import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard, canPlayToRivalCrapette } from "./rules.js";
import { getTopCard, findCardById, removeCardFromState } from "./gameState.js";

// Cartas jugables de la IA (crapette, flipped, discard)
// houses: state.houses (todas las casas del tablero)
function getAIPlayable(ai, houses) {
  const cards = [];

  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) cards.push({ card: { ...crapetteTop, faceUp: true }, source: "crapette" });

  if (ai.flippedCard) cards.push({ card: { ...ai.flippedCard }, source: "flipped" });

  houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: { ...top }, source: "house", houseIndex: i });
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

// Mover carta de casa a casa con proposito:
// 1. Destino es casa vacia (crea espacio)
// 2. Destapa carta que puede ir a fundacion
// 3. Cualquier movimiento valido entre casas (reorganizacion util)
function findPurposefulHouseMove(fromIndex, houses, foundations, moveHistory = []) {
  const card = getTopCard(houses[fromIndex]);
  if (!card) return null;

  // Anti ping-pong usando historial de la carta
  // card.moveHistory = lista de indices de casas de donde salio la carta en este turno
  const cardMoveHistory = Array.isArray(card.moveHistory) ? card.moveHistory : [];

  for (let ti = 0; ti < houses.length; ti++) {
    if (ti === fromIndex) continue;
    if (!canPlayToHouse(card, houses[ti])) continue;

    // Bloquear si la carta ya salio de esta casa destino antes en el turno
    // (evita A→B→A y A→B→C→B)
    if (houses[ti].length > 0 && cardMoveHistory.includes(ti)) continue;

    // Bloquear si el movimiento inmediatamente anterior fue el reverso
    if (cardMoveHistory.length > 0) {
      const lastFrom = cardMoveHistory[cardMoveHistory.length - 1];
      if (lastFrom === ti) continue;
    }

    // Proposito 1: origen tiene 1 carta — crea casa vacia
    if (houses[fromIndex].length === 1) {
      return { card: { ...card }, source: "house", houseIndex: fromIndex, type: "house", target: ti };
    }

    // Proposito 2: destapa carta que puede ir a fundacion
    if (houses[fromIndex].length >= 2) {
      const buried = houses[fromIndex][houses[fromIndex].length - 2];
      if (canPlayToFoundation(buried, foundations)) {
        return { card: { ...card }, source: "house", houseIndex: fromIndex, type: "house", target: ti };
      }
    }

    // Proposito 3: casa destino vacia
    if (houses[ti].length === 0) {
      return { card: { ...card }, source: "house", houseIndex: fromIndex, type: "house", target: ti };
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
function getMove(ai, human, houses, foundations, moveHistory, maxDepth) {
  const playable = getAIPlayable(ai, houses);

  // 1. Cartas a fundaciones desde cualquier origen
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }

  // 1b. Desenterrar cartas enterradas (segun nivel)
  if (maxDepth > 0) {
    const uncover = findUncoverMove(houses, foundations, human, maxDepth);
    if (uncover) return uncover;
  }

  // 2. Llenar casas vacias (obligatorio)
  const emptyIdx = houses.findIndex(h => h.length === 0);
  if (emptyIdx >= 0) {
    const crapetteTop = getTopCard(ai.crapette);
    if (crapetteTop) return { card: { ...crapetteTop, faceUp: true }, source: "crapette", houseIndex: undefined, type: "house", target: emptyIdx };
    if (ai.flippedCard) return { card: { ...ai.flippedCard }, source: "flipped", houseIndex: undefined, type: "house", target: emptyIdx };
    for (let si = 0; si < houses.length; si++) {
      if (si === emptyIdx) continue;
      const card = getTopCard(houses[si]);
      if (card) return { card: { ...card }, source: "house", houseIndex: si, type: "house", target: emptyIdx };
    }
  }

  // 3. Vaciar crapette — objetivo principal
  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) {
    const cCard = { ...crapetteTop, faceUp: true };
    const houseMove = findHouseMove(cCard, "crapette", -1, houses, []);
    if (houseMove) return houseMove;
  }
  if (ai.flippedCard) {
    const houseMove = findHouseMove({ ...ai.flippedCard }, "flipped", -1, houses, []);
    if (houseMove) return houseMove;
  }

  // 4. Mover entre casas con proposito (sin ping-pong)
  for (let si = 0; si < houses.length; si++) {
    const move = findPurposefulHouseMove(si, houses, foundations, moveHistory);
    if (move) return move;
  }

  // 5. Enviar cartas al rival
  for (const { card, source, houseIndex } of playable) {
    if (canPlayToRivalCrapette(card, human.crapette)) return { card, source, houseIndex, type: "rival_crapette" };
    if (canPlayToRivalDiscard(card, human.discard)) return { card, source, houseIndex, type: "rival_discard" };
  }

  return null;
}

function getBasicMove(ai, human, houses, foundations) {
  return getMove(ai, human, houses, foundations, [], 0);
}

function getMediumMove(ai, human, houses, foundations, moveHistory) {
  return getMove(ai, human, houses, foundations, moveHistory, 1);
}

function getExpertMove(ai, human, houses, foundations, moveHistory) {
  return getMove(ai, human, houses, foundations, moveHistory, Infinity);
}

const aiMoveHistory = [];
const HISTORY_SIZE = 8;

export function resetAIHistory() {
  aiMoveHistory.length = 0;
}

export function getAIMove(ai, human, houses, foundations, level) {
  let move;
  switch (level) {
    case "basic":  move = getBasicMove(ai, human, houses, foundations); break;
    case "expert": move = getExpertMove(ai, human, houses, foundations, aiMoveHistory); break;
    case "medium":
    default:       move = getMediumMove(ai, human, houses, foundations, aiMoveHistory);
  }

  if (!move) {
    return null;
  }

  // Registrar movimiento en historial (solo casas, no limpiar en otros tipos)
  if (move.type === "house") {
    const moveKey = (move.card.id || "?") + ":" + (move.houseIndex ?? -1) + ">" + move.target;
    aiMoveHistory.push(moveKey);
  }

  return move;
}

export function applyAIMove(state, move) {
  if (!move) return null;

  // Verificar que la carta existe usando findCardById (busca en todo el estado)
  const found = findCardById(state, move.card.id);
  if (!found) {
    console.warn("[APPLYAI] Carta no encontrada en estado:", move.card.id);
    return null;
  }

  // Quitar carta de donde realmente esta (no de donde la IA cree que esta)
  const stateWithoutCard = removeCardFromState(state, move.card.id);

  // Clonar estado limpio para aplicar el movimiento
  const houses = stateWithoutCard.houses.map(h => h.map(c => ({ ...c })));
  const ai = {
    ...stateWithoutCard.ai,
    crapette: stateWithoutCard.ai.crapette.map(c => ({ ...c })),
    discard: stateWithoutCard.ai.discard.map(c => ({ ...c })),
    talon: stateWithoutCard.ai.talon.map(c => ({ ...c })),
    flippedCard: stateWithoutCard.ai.flippedCard ? { ...stateWithoutCard.ai.flippedCard } : null,
  };
  const human = {
    ...stateWithoutCard.human,
    crapette: stateWithoutCard.human.crapette.map(c => ({ ...c })),
    discard: stateWithoutCard.human.discard.map(c => ({ ...c })),
    talon: stateWithoutCard.human.talon.map(c => ({ ...c })),
    flippedCard: stateWithoutCard.human.flippedCard ? { ...stateWithoutCard.human.flippedCard } : null,
  };
  const foundations = { ...stateWithoutCard.foundations };

  // Carta ya removida por removeCardFromState — agregar al destino con historial
  const prevHistory = Array.isArray(move.card.moveHistory) ? move.card.moveHistory : [];
  const fromIdx = move.houseIndex !== undefined ? move.houseIndex : -1;

  if (move.type === "foundation") {
    foundations[move.target] = [...(foundations[move.target] || []), { ...move.card, faceUp: true, moveHistory: [] }];
  } else if (move.type === "house") {
    houses[move.target].push({ ...move.card, faceUp: true, moveHistory: [...prevHistory, fromIdx] });
  } else if (move.type === "rival_discard") {
    human.discard.push({ ...move.card, faceUp: true, moveHistory: [] });
  } else if (move.type === "rival_crapette") {
    human.crapette.push({ ...move.card, faceUp: true, moveHistory: [] });
    human.crapette[human.crapette.length - 1] = { ...human.crapette[human.crapette.length - 1], faceUp: true };
  }

  // Revelar nueva carta del crapette de la IA si aplica
  if (move.source === "crapette" && ai.crapette.length > 0) {
    ai.crapette[ai.crapette.length - 1] = { ...ai.crapette[ai.crapette.length - 1], faceUp: true };
  }

  return { ...stateWithoutCard, houses, ai, human, foundations };
}
