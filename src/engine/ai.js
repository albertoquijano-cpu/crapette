// ai.js — Lógica de IA
// Arquitectura nueva: propósitos 1 y 2, anti ping-pong externo al estado de cartas

import {
  canPlayToFoundation,
  canPlayToHouse,
  canPlayToRivalDiscard,
  canPlayToRivalCrapette,
  findFoundationMove,
  findFillEmptyHouseMove,
  findUncoverMove,
  findClearHouseMove,
  findCrapetteToHouseMove,
  findFlippedToHouseMove,
} from './rules.js';

import { topCard, moveTopCard, cloneState, GAME_PHASES } from './gameState.js';
import { PILES, HOUSE_PILES, FOUND_PILES } from './deck.js';

// ── Sesión de turno ────────────────────────────────────────────────────────────
// El anti ping-pong vive aquí, FUERA del estado de las cartas.
// Se reinicia cada vez que empieza el turno de la IA.
// Registra pares "cardId:toPile" para evitar ciclos.
let turnSession = new Set();

export function resetAITurnSession() {
  turnSession = new Set();
}

function registerMove(cardId, toPile) {
  turnSession.add(`${cardId}:${toPile}`);
}

function isLoopMove(cardId, toPile) {
  return turnSession.has(`${cardId}:${toPile}`);
}

// ── Profundidad máxima según nivel ───────────────────────────────────────────
function maxDepthForLevel(level) {
  switch (level) {
    case 'basic':  return 0;        // solo cartas en pos=0, sin desenterrar
    case 'medium': return 1;        // desentierra hasta 1 nivel
    case 'expert': return Infinity; // cualquier profundidad
    default:       return 1;
  }
}

// ── Obtener jugada de la IA ───────────────────────────────────────────────────
// Devuelve un objeto move o null (sin jugadas posibles).
// Un move tiene: { type, card, fromPile, toPile }
export function getAIMove(state) {
  const { ai, human, houses, foundations, aiLevel } = state;
  const maxDepth = maxDepthForLevel(aiLevel);

  const crapTop  = topCard(ai.crapette);
  const flipped  = ai.flipped;
  const aiFlippedPile = PILES.AI_FLIPPED;

  // Todas las cartas en pos=0 que la IA puede mover
  // (crapette top, flipped, topes de casas, descarte si crapette vacío)
  const playable = getAIPlayableCards(ai, houses);

  // ── PROPÓSITO 1a: cartas pos=0 a fundación ────────────────────────────────
  for (const card of playable) {
    const move = findFoundationMove(card, foundations);
    if (move && !isLoopMove(card.id, move.toPile)) return move;
  }

  // ── PROPÓSITO 1b: casa vacía — llenar con crapette o flipped ──────────────
  const emptyHouse = HOUSE_PILES.find(h => houses[h].length === 0);
  if (emptyHouse !== undefined) {
    if (crapTop && !isLoopMove(crapTop.id, emptyHouse)) {
      return { type: 'fill_empty', card: crapTop, fromPile: crapTop.pile, toPile: emptyHouse };
    }
    if (flipped && !isLoopMove(flipped.id, emptyHouse)) {
      return { type: 'fill_empty', card: flipped, fromPile: aiFlippedPile, toPile: emptyHouse };
    }
    // Si no hay crapette ni flipped, mover cualquier carta de casa a la vacía no tiene propósito
    // (crearía otra vacía) — omitir
  }

  // ── PROPÓSITO 1c: desenterrar carta para fundación ─────────────────────────
  if (maxDepth > 0) {
    const uncover = findUncoverMoveFiltered(houses, foundations, maxDepth);
    if (uncover) return uncover;
  }

  // ── PROPÓSITO 1d: enviar al descarte/crapette del rival (jugada útil) ──────
  for (const card of playable) {
    if (canPlayToRivalDiscard(card, human.discard)) {
      const move = { type: 'rival_discard', card, fromPile: card.pile, toPile: PILES.HUMAN_DISCARD };
      if (!isLoopMove(card.id, move.toPile)) return move;
    }
  }
  for (const card of playable) {
    if (canPlayToRivalCrapette(card, human.crapette)) {
      const move = { type: 'rival_crapette', card, fromPile: card.pile, toPile: PILES.HUMAN_CRAPETTE };
      if (!isLoopMove(card.id, move.toPile)) return move;
    }
  }

  // ── PROPÓSITO 2a: vaciar una casa (para bajar crapette/flipped) ───────────
  const clearMove = findClearHouseMoveFiltered(houses, crapTop, flipped);
  if (clearMove) return clearMove;

  // ── PROPÓSITO 2b: bajar crapette a casa ────────────────────────────────────
  if (crapTop) {
    const move = findCrapetteToHouseMove(crapTop, houses);
    if (move && !isLoopMove(crapTop.id, move.toPile)) return move;
  }

  // ── PROPÓSITO 2c: bajar flipped a casa ────────────────────────────────────
  if (flipped) {
    const move = findFlippedToHouseMoveFiltered(flipped, houses);
    if (move) return move;
  }

  return null; // sin jugadas con propósito
}

// ── Aplicar jugada de la IA al estado ─────────────────────────────────────────
// Devuelve nuevo estado, o null si el movimiento no es válido.
export function applyAIMove(state, move) {
  if (!move) return null;

  try {
    let newState = cloneState(state);

    switch (move.type) {
      case 'foundation':
      case 'fill_empty':
      case 'uncover':
      case 'clear_house':
      case 'crapette_to_house':
      case 'house_to_house': {
        newState = moveTopCard(newState, move.fromPile, move.toPile);
        break;
      }

      case 'flipped_to_house': {
        // La carta flipped no está en una pila normal — moverla manualmente
        const card = newState.ai.flipped;
        if (!card) return null;
        newState.ai = { ...newState.ai, flipped: null };
        newState.houses = {
          ...newState.houses,
          [move.toPile]: [...newState.houses[move.toPile], { ...card, pile: move.toPile, pos: 0, faceUp: true }],
        };
        // Recalc posiciones
        newState = recalcAfterMove(newState, move.toPile);
        break;
      }

      case 'rival_discard': {
        newState = moveTopCard(newState, move.fromPile, PILES.HUMAN_DISCARD);
        break;
      }

      case 'rival_crapette': {
        newState = moveTopCard(newState, move.fromPile, PILES.HUMAN_CRAPETTE);
        // Revelar nueva carta del crapette humano si aplica
        if (newState.human.crapette.length > 0) {
          const last = newState.human.crapette[newState.human.crapette.length - 1];
          newState.human.crapette[newState.human.crapette.length - 1] = { ...last, faceUp: true };
        }
        break;
      }

      default:
        console.warn('[AI] Tipo de movimiento desconocido:', move.type);
        return null;
    }

    // Si la fuente era el crapette de la IA, revelar la nueva carta superior
    if (move.fromPile === PILES.AI_CRAPETTE && newState.ai.crapette.length > 0) {
      const last = newState.ai.crapette[newState.ai.crapette.length - 1];
      newState.ai.crapette[newState.ai.crapette.length - 1] = { ...last, faceUp: true };
    }

    // Registrar en sesión para anti ping-pong
    registerMove(move.card.id, move.toPile);

    return newState;
  } catch (err) {
    console.error('[AI] Error aplicando movimiento:', err, move);
    return null;
  }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

function getAIPlayableCards(ai, houses) {
  const cards = [];
  const crapTop = topCard(ai.crapette);
  if (crapTop) cards.push(crapTop);
  if (ai.flipped) cards.push(ai.flipped);

  for (const hId of HOUSE_PILES) {
    const top = topCard(houses[hId]);
    if (top) cards.push(top);
  }

  if (ai.crapette.length === 0) {
    const discTop = topCard(ai.discard);
    if (discTop) cards.push(discTop);
  }

  return cards;
}

// findUncoverMove con filtro anti ping-pong
function findUncoverMoveFiltered(houses, foundations, maxDepth) {
  for (const hId of HOUSE_PILES) {
    const pile = houses[hId];
    if (pile.length < 2) continue;

    for (let depth = 1; depth < pile.length; depth++) {
      if (depth > maxDepth) break;
      const buried = pile[pile.length - 1 - depth];
      if (!canPlayToFoundation(buried, foundations)) continue;

      const topC = topCard(pile);
      for (const tHId of HOUSE_PILES) {
        if (tHId === hId) continue;
        if (isLoopMove(topC.id, tHId)) continue;
        if (canPlayToHouse(topC, houses[tHId])) {
          return { type: 'uncover', card: topC, fromPile: hId, toPile: tHId, goal: buried.id };
        }
      }
    }
  }
  return null;
}

// findClearHouseMove con filtro anti ping-pong
function findClearHouseMoveFiltered(houses, crapetteTop, flipped) {
  if (!crapetteTop && !flipped) return null;
  for (const hId of HOUSE_PILES) {
    const pile = houses[hId];
    if (pile.length !== 1) continue;
    const card = pile[0];
    for (const tHId of HOUSE_PILES) {
      if (tHId === hId) continue;
      if (houses[tHId].length === 0) continue;
      if (isLoopMove(card.id, tHId)) continue;
      if (canPlayToHouse(card, houses[tHId])) {
        return { type: 'clear_house', card, fromPile: hId, toPile: tHId };
      }
    }
  }
  return null;
}

// findFlippedToHouseMove con filtro anti ping-pong
function findFlippedToHouseMoveFiltered(flipped, houses) {
  if (!flipped) return null;
  for (const hId of HOUSE_PILES) {
    if (isLoopMove(flipped.id, hId)) continue;
    if (canPlayToHouse(flipped, houses[hId])) {
      return { type: 'flipped_to_house', card: flipped, fromPile: PILES.AI_FLIPPED, toPile: hId };
    }
  }
  return null;
}

// Recalcula posiciones de una pila casa después de una inserción manual
function recalcAfterMove(state, hId) {
  const pile = state.houses[hId];
  const n = pile.length;
  return {
    ...state,
    houses: {
      ...state.houses,
      [hId]: pile.map((c, i) => ({ ...c, pos: (n - 1) - i })),
    },
  };
}
