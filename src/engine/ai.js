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
function findHouseMove(card, source, houseIndex, allHouses, history = []) {
  // Destinos ya visitados por esta carta (evitar loop)
  const visitedTargets = history
    .filter(k => k.startsWith(card.id + ":"))
    .map(k => parseInt(k.split(">")[1]));

  for (let ti = 0; ti < allHouses.length; ti++) {
    if (ti === houseIndex) continue;
    if (visitedTargets.includes(ti)) continue; // ya fue aqui antes
    if (canPlayToHouse(card, allHouses[ti])) {
      return { card, source, houseIndex, type: "house", target: ti };
    }
  }
  return null;
}

// Buscar si mover una carta de encima libera una carta obligatoria (fundacion)
function findUncoverMove(ai, human, foundations, allHouses, history = []) {
  // allHouses aqui son todas las casas del board
  for (let hi = 0; hi < allHouses.length; hi++) {
    const house = allHouses[hi];
    if (house.length < 2) continue;
    const buried = house[house.length - 2];
    if (!canPlayToFoundation(buried, foundations)) continue;
    // La carta encima puede moverse?
    const top = house[house.length - 1];
    const move = findHouseMove(top, "house", hi, allHouses, history);
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
  const uncover = findUncoverMove(ai, human, foundations, allHouses, aiMoveHistory);
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
    const move = findHouseMove(cCard, "crapette", -1, allHouses, aiMoveHistory);
    if (move) return move;
    // Tambien al rival si aplica
    if (canPlayToRivalDiscard(cCard, human.crapette)) {
      return { card: cCard, source: "crapette", houseIndex: undefined, type: "rival_crapette" };
    }
    if (canPlayToRivalDiscard(cCard, human.discard)) {
      return { card: cCard, source: "crapette", houseIndex: undefined, type: "rival_discard" };
    }
  }

  // 5. DESARROLLO: enviar al rival (crapette primero — mas dañino) desde cualquier fuente
  // Evaluar todas las fuentes contra ambas pilas del rival
  const rivalTargets = [
    { pile: human.crapette, type: "rival_crapette" },
    { pile: human.discard,  type: "rival_discard"  },
  ];

  // 5a. flipped al rival
  if (ai.flippedCard) {
    for (const { pile, type } of rivalTargets) {
      if (canPlayToRivalDiscard(ai.flippedCard, pile)) {
        return { card: ai.flippedCard, source: "flipped", houseIndex: undefined, type };
      }
    }
  }

  // 5b. cartas de casas al rival
  for (const { pile, type } of rivalTargets) {
    for (let si = 0; si < allHouses.length; si++) {
      const card = getTopCard(allHouses[si]);
      if (!card) continue;
      if (canPlayToRivalDiscard(card, pile)) {
        return { card, source: "house", houseIndex: si, type };
      }
    }
  }

  // 5c. flipped a casas (posicional)
  if (ai.flippedCard) {
    const move = findHouseMove(ai.flippedCard, "flipped", -1, allHouses, aiMoveHistory);
    if (move) return move;
  }

  // 5d. mover entre casas (posicional)
  for (let si = 0; si < allHouses.length; si++) {
    const card = getTopCard(allHouses[si]);
    if (!card) continue;
    const move = findHouseMove(card, "house", si, allHouses, aiMoveHistory);
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

// Historial de movimientos para detectar loops
const aiMoveHistory = [];
const HISTORY_SIZE = 6;

export function getAIMove(ai, human, foundations, level) {
  let move;
  switch (level) {
    case "basic":  move = getBasicMove(ai, human, foundations); break;
    case "expert": move = getExpertMove(ai, human, foundations); break;
    case "medium":
    default:       move = getMediumMove(ai, human, foundations);
  }

  if (!move) {
    aiMoveHistory.length = 0;
    return null;
  }

  // Detectar loop: la misma carta volviendo al mismo origen
  if (move.type === "house") {
    const moveKey = move.card.id + ":" + move.houseIndex + ">" + move.target;
    // Solo detectar el reverso directo: A->B seguido de B->A
    if (aiMoveHistory.length > 0) {
      const lastKey = aiMoveHistory[aiMoveHistory.length - 1];
      const reverseKey = move.card.id + ":" + move.target + ">" + move.houseIndex;
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

  const ai = { ...state.ai, houses: state.ai.houses.map(h => [...h]), crapette: [...state.ai.crapette], discard: [...state.ai.discard] };
  const human = { ...state.human, houses: state.human.houses.map(h => [...h]), crapette: [...state.human.crapette], discard: [...state.human.discard] };
  const foundations = { ...state.foundations };

  // allHouses = [...human.houses (0-3), ...ai.houses (4-7)]
  // houseIndex en move usa indices globales del board

  // Quitar carta de su fuente (human.houses 0-3, ai.houses 4-7)
  const removeFromSource = () => {
    if (move.source === "crapette") {
      ai.crapette.pop();
      if (ai.crapette.length > 0)
        ai.crapette[ai.crapette.length - 1] = { ...ai.crapette[ai.crapette.length - 1], faceUp: true };
    } else if (move.source === "house") {
      const hi = move.houseIndex;
      if (hi < 4) human.houses[hi].pop();
      else ai.houses[hi - 4].pop();
    } else if (move.source === "discard") {
      ai.discard.pop();
    } else if (move.source === "flipped") {
      ai.flippedCard = null;
    }
  };

  // Colocar carta en casa destino (indice global del board)
  const placeToHouse = (targetIndex) => {
    if (targetIndex < 4) human.houses[targetIndex].push({ ...move.card, faceUp: true });
    else ai.houses[targetIndex - 4].push({ ...move.card, faceUp: true });
  };

  console.log("[APPLY] move:", move.type, move.card.rank, move.card.suit, "source:", move.source, "houseIndex:", move.houseIndex, "target:", move.target);
  if (move.type === "foundation") {
    removeFromSource();
    foundations[move.target] = [...(foundations[move.target] || []), { ...move.card, faceUp: true }];
  } else if (move.type === "house") {
    removeFromSource();
    placeToHouse(move.target);
  } else if (move.type === "rival_discard") {
    removeFromSource();
    human.discard.push({ ...move.card, faceUp: true });
  } else if (move.type === "rival_crapette") {
    removeFromSource();
    human.crapette.push({ ...move.card, faceUp: true });
    if (human.crapette.length > 0)
      human.crapette[human.crapette.length - 1] = { ...human.crapette[human.crapette.length - 1], faceUp: true };
  }

  return { ...state, ai, human, foundations };
}
