// rules.js — Reglas de Banca Rusa (Crapette)
// Arquitectura nueva: pilas numeradas, posición relativa

import { topCard, getPile } from './gameState.js';
import { PILES, HOUSE_PILES, FOUND_PILES, SUIT_FOUNDATIONS } from './deck.js';

// ── Reglas de destino ─────────────────────────────────────────────────────────

// Fundación: As primero, luego ascendente mismo palo.
// Una carta solo puede ir a la fundación si su palo coincide y el valor es el siguiente.
// Devuelve el ID de la fundación destino, o null.
export function canPlayToFoundation(card, foundations) {
  if (!card) return null;
  const foundIds = SUIT_FOUNDATIONS[card.suit];
  for (const fId of foundIds) {
    const pile = foundations[fId];
    const top  = topCard(pile);
    if (!top && card.rank === 1)                              return fId; // As abre fundación vacía
    if (top && top.suit === card.suit && card.rank === top.rank + 1) return fId;
  }
  return null;
}

// Casa: orden descendente, colores alternados. Casa vacía acepta cualquier carta.
export function canPlayToHouse(card, housePile) {
  if (!card) return false;
  const top = topCard(housePile);
  if (!top) return true;  // casa vacía: cualquier carta
  return card.rank === top.rank - 1 && card.color !== top.color;
}

// Descarte rival: debe haber carta existente; mismo palo, valor ±1.
export function canPlayToRivalDiscard(card, rivalDiscard) {
  if (!card) return false;
  const top = topCard(rivalDiscard);
  if (!top) return false;
  return card.suit === top.suit && Math.abs(card.rank - top.rank) === 1;
}

// Crapette rival: mismo palo, valor ±1. No acepta si el crapette rival está vacío.
export function canPlayToRivalCrapette(card, rivalCrapette) {
  if (!card || rivalCrapette.length === 0) return false;
  const top = topCard(rivalCrapette);
  return card.suit === top.suit && Math.abs(card.rank - top.rank) === 1;
}

// ── Análisis de propósitos ────────────────────────────────────────────────────
//
// PROPÓSITO 1 (obligatorio):
//   1a. Carta en pos=0 que puede ir a fundación
//   1b. Carta en pos=0 a casa vacía (solo si hay casa vacía)
//   1c. Desenterrar carta que puede ir a fundación (mover cartas encima de ella)
//       — profundidad depende del nivel de IA (depth=1 medio, Infinity experto)
//
// PROPÓSITO 2 (no obligatorio pero prioritario sobre pasar turno):
//   2a. Vaciar una casa para bajar crapette/talon
//   2b. Bajar carta de crapette a una casa
//   2c. Bajar carta de talon (flipped) a una casa

// ── Propósito 1a: carta pos=0 a fundación ────────────────────────────────────
export function findFoundationMove(card, foundations) {
  if (!card || card.pos !== 0) return null;
  const fId = canPlayToFoundation(card, foundations);
  return fId ? { type: 'foundation', card, fromPile: card.pile, toPile: fId } : null;
}

// ── Propósito 1b: carta pos=0 a casa vacía ────────────────────────────────────
export function findFillEmptyHouseMove(card, houses) {
  if (!card || card.pos !== 0) return null;
  for (const hId of HOUSE_PILES) {
    if (houses[hId].length === 0) {
      return { type: 'fill_empty', card, fromPile: card.pile, toPile: hId };
    }
  }
  return null;
}

// ── Propósito 1c: desenterrar carta candidata a fundación ──────────────────────
// Busca en las casas cartas que podrían ir a fundación si se despejaran.
// Para cada carta candidata (pos > 0), intenta mover las cartas encima de ella.
// maxDepth: cuántas cartas encima puede mover (1=medio, Infinity=experto)
// Devuelve el primer movimiento necesario para desenterrar, o null.
export function findUncoverMove(houses, foundations, maxDepth) {
  for (const hId of HOUSE_PILES) {
    const pile = houses[hId];
    if (pile.length < 2) continue;

    // Buscar cartas enterradas que pueden ir a fundación
    for (let depth = 1; depth < pile.length; depth++) {
      if (depth > maxDepth) break;
      const buried = pile[pile.length - 1 - depth]; // depth niveles abajo de la cima
      if (!canPlayToFoundation(buried, foundations)) continue;

      // Intentar mover las 'depth' cartas encima de buried
      // Simulación greedy: mover la carta superior primero
      const topC = topCard(pile);
      for (const tHId of HOUSE_PILES) {
        if (tHId === hId) continue;
        if (canPlayToHouse(topC, houses[tHId])) {
          return {
            type:     'uncover',
            card:     topC,
            fromPile: hId,
            toPile:   tHId,
            goal:     buried.id,  // carta que se quiere desenterrar
          };
        }
      }
    }
  }
  return null;
}

// ── Propósito 2a: vaciar una casa ────────────────────────────────────────────
// Busca una casa con solo 1 carta que pueda moverse a otra casa.
// Útil para crear espacio para bajar crapette/talon.
export function findClearHouseMove(houses, crapetteTop, flippedCard) {
  for (const hId of HOUSE_PILES) {
    const pile = houses[hId];
    if (pile.length !== 1) continue;
    const card = pile[0];

    // Solo vaciar si hay crapette o flipped para bajar
    if (!crapetteTop && !flippedCard) continue;

    for (const tHId of HOUSE_PILES) {
      if (tHId === hId) continue;
      if (houses[tHId].length === 0) continue; // no mover a otra vacía (loop infinito)
      if (canPlayToHouse(card, houses[tHId])) {
        return { type: 'clear_house', card, fromPile: hId, toPile: tHId };
      }
    }
  }
  return null;
}

// ── Propósito 2b: bajar crapette a casa ───────────────────────────────────────
export function findCrapetteToHouseMove(crapetteTop, houses) {
  if (!crapetteTop) return null;
  for (const hId of HOUSE_PILES) {
    if (canPlayToHouse(crapetteTop, houses[hId])) {
      return { type: 'crapette_to_house', card: crapetteTop, fromPile: crapetteTop.pile, toPile: hId };
    }
  }
  return null;
}

// ── Propósito 2c: bajar flipped (talon) a casa ───────────────────────────────
export function findFlippedToHouseMove(flipped, houses) {
  if (!flipped) return null;
  for (const hId of HOUSE_PILES) {
    if (canPlayToHouse(flipped, houses[hId])) {
      return { type: 'flipped_to_house', card: flipped, fromPile: PILES.AI_FLIPPED, toPile: hId };
    }
  }
  return null;
}

// ── Movimientos obligatorios del jugador (para detección de Stop) ─────────────
// Devuelve array de movimientos obligatorios (Propósito 1) que el jugador
// debería hacer pero no ha hecho.
export function getMandatoryMoves(playerState, houses, foundations, level = 'basic', isHuman = true) {
  const mandatory = [];

  // Cartas que el jugador puede mover en pos=0
  const playable = getPlayableCards(playerState, houses, isHuman);

  // 1a: cartas a fundación
  for (const card of playable) {
    const fId = canPlayToFoundation(card, foundations);
    if (fId) mandatory.push({ type: 'foundation', card, fromPile: card.pile, toPile: fId });
  }

  // 1b: cartas a casas vacías (solo crapette o flipped)
  const hasEmpty = HOUSE_PILES.some(h => houses[h].length === 0);
  if (hasEmpty) {
    const crapTop = topCard(playerState.crapette);
    if (crapTop) mandatory.push({ type: 'fill_empty', card: crapTop, fromPile: crapTop.pile });
  }

  // 1c: desenterrar para fundación (solo medio/experto)
  if (level !== 'basic') {
    const maxDepth = level === 'medium' ? 1 : Infinity;
    const uncover  = findUncoverMove(houses, foundations, maxDepth);
    if (uncover) mandatory.push(uncover);
  }

  return mandatory;
}

// Cartas jugables del jugador en pos=0 (crapette, flipped, tope de casas)
export function getPlayableCards(playerState, houses, isHuman = true) {
  const cards = [];

  const crapTop = topCard(playerState.crapette);
  if (crapTop) cards.push(crapTop);

  if (playerState.flipped) cards.push(playerState.flipped);

  // Topes de casas (pos=0, que pertenecen al estado compartido)
  for (const hId of HOUSE_PILES) {
    const top = topCard(houses[hId]);
    if (top) cards.push(top);
  }

  // Descarte solo si no hay crapette
  if (playerState.crapette.length === 0) {
    const discTop = topCard(playerState.discard);
    if (discTop) cards.push(discTop);
  }

  return cards;
}

// ── Verificar si una carta es jugable en pos=0 ────────────────────────────────
export function isPlayable(card) {
  return card && card.pos === 0;
}
