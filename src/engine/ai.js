// ai.js - Logica de IA con casas compartidas del tablero

import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard, canPlayToRivalCrapette } from "./rules.js";
import { getTopCard } from "./gameState.js";

// Cartas jugables de la IA (crapette, flipped, discard)
// houses: state.houses (todas las casas del tablero)
function getAIPlayable(ai, houses) {
  const cards = [];

  const crapetteTop = getTopCard(ai.crapette);
  if (crapetteTop) cards.push({ card: { ...crapetteTop, faceUp: true }, source: "crapette" });

  if (ai.flippedCard) cards.push({ card: { ...ai.flippedCard }, source: "flipped" });

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

// Mover carta de casa a casa con proposito:
// Propositos para mover carta entre casas:
// 1. El origen tiene 1 carta — moverla crea una casa vacia (sin ping-pong)
// 2. Destapa carta que puede ir a fundacion
// 3. El destino es una casa vacia (llenar espacio ya creado)
function findPurposefulHouseMove(fromIndex, houses, foundations, moveHistory = []) {
  const card = getTopCard(houses[fromIndex]);
  if (!card) return null;

  // Ultimo movimiento registrado
  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

  for (let ti = 0; ti < houses.length; ti++) {
    if (ti === fromIndex) continue;
    if (!canPlayToHouse(card, houses[ti])) continue;

    // Regla anti ping-pong: bloquear si este movimiento revierte exactamente el anterior
    const reverseKey = (card.id || "?") + ":" + ti + ">" + fromIndex;
    if (lastMove === reverseKey) continue;

    // Proposito 1: origen tiene 1 carta — moverla crea casa vacia
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

    // Proposito 3: destino es casa vacia — llenar espacio disponible
    if (houses[ti].length === 0) {
      return { card: { ...card }, source: "house", houseIndex: fromIndex, type: "house", target: ti };
    }

    // Proposito 4: cualquier movimiento valido que no revierta el anterior
    return { card: { ...card }, source: "house", houseIndex: fromIndex, type: "house", target: ti };
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

// ── Motor de jugadas unificado ──────────────────────────────────────────
// Prioridades iguales en todos los niveles:
// 1. Cartas a fundaciones (desde cualquier origen)
// 2. Llenar casas vacias con cualquier carta
// 3. Enviar cartas al crapette/descarte del rival
// 4. Mover entre casas con proposito (crear vacio o desenterrar, sin ping-pong)
// La unica diferencia entre niveles es maxDepth para desenterrar cartas:
//   basico: 0 (solo superficiales), medio: 1, experto: Infinity

function getMove(ai, human, houses, foundations, moveHistory, maxDepth) {
  const playable = getAIPlayable(ai, houses);

  // 1. Cartas a fundaciones desde cualquier origen
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) return { card, source, houseIndex, type: "foundation", target: fKey };
  }

  // 1b. Desenterrar cartas enterradas hacia fundaciones (segun nivel)
  if (maxDepth > 0) {
    const uncover = findUncoverMove(houses, foundations, human, maxDepth);
    if (uncover) return uncover;
  }

  // 2. Llenar casas vacias (obligatorio) con cualquier carta disponible
  const emptyIdx = houses.findIndex(h => h.length === 0);
  if (emptyIdx >= 0) {
    const crapetteTop = getTopCard(ai.crapette);
    if (crapetteTop) {
      return { card: { ...crapetteTop, faceUp: true }, source: "crapette", houseIndex: undefined, type: "house", target: emptyIdx };
    }
    if (ai.flippedCard) {
      return { card: { ...ai.flippedCard }, source: "flipped", houseIndex: undefined, type: "house", target: emptyIdx };
    }
    for (let si = 0; si < houses.length; si++) {
      if (si === emptyIdx) continue;
      const card = getTopCard(houses[si]);
      if (card) return { card: { ...card }, source: "house", houseIndex: si, type: "house", target: emptyIdx };
    }
  }

  // 3. Mover entre casas con proposito:
  //    - Crear casa vacia (origen con 1 carta) para recibir crapette
  //    - Desenterrar carta que va a fundacion
  //    - Cualquier movimiento valido sin ping-pong
  for (let si = 0; si < houses.length; si++) {
    const move = findPurposefulHouseMove(si, houses, foundations, moveHistory);
    if (move) return move;
  }

  // 4. Vaciar crapette — objetivo principal del juego
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

  // 5. Enviar cartas al rival (estrategico)
  for (const { card, source, houseIndex } of playable) {
    if (canPlayToRivalCrapette(card, human.crapette))
      return { card, source, houseIndex, type: "rival_crapette" };
    if (canPlayToRivalDiscard(card, human.discard))
      return { card, source, houseIndex, type: "rival_discard" };
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

// Historial de movimientos para detectar loops
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
  const houses = state.houses.map(h => h.map(c => ({ ...c })));
  const ai = {
    ...state.ai,
    crapette: state.ai.crapette.map(c => ({ ...c })),
    discard: state.ai.discard.map(c => ({ ...c })),
    talon: state.ai.talon.map(c => ({ ...c })),
  };
  const human = {
    ...state.human,
    crapette: state.human.crapette.map(c => ({ ...c })),
    discard: state.human.discard.map(c => ({ ...c })),
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
