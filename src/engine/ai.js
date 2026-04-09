import {
  canPlayToFoundation, canPlayToHouse,
  canPlayToRivalDiscard, canPlayToRivalCrapette,
  findFoundationMove, findUncoverMove,
  findClearHouseMove, findCrapetteToHouseMove, findFlippedToHouseMove,
} from './rules.js';
import { topCard, moveTopCard, cloneState, recalcPositions } from './gameState.js';
import { PILES, HOUSE_PILES } from './deck.js';

export function resetAITurnSession() {}

export function getAIMove(state) {
  const { ai, human, houses, foundations, aiLevel } = state;
  const maxDepth = aiLevel === 'basic' ? 0 : aiLevel === 'medium' ? 1 : Infinity;
  const crapTop = topCard(ai.crapette);
  const flipped = ai.flipped;
  const playable = getAIPlayableCards(ai, houses);

  // P1a: cartas pos=0 a fundacion
  for (const card of playable) {
    const move = findFoundationMove(card, foundations);
    if (move) return move;
  }

  // P1b: llenar casa vacia - primero crapette, luego flipped, luego otra casa
  const emptyHouse = HOUSE_PILES.find(h => houses[h].length === 0);
  if (emptyHouse !== undefined) {
    if (crapTop) {
      return { type: 'fill_empty', card: crapTop, fromPile: PILES.AI_CRAPETTE, toPile: emptyHouse };
    }
    if (flipped) {
      return { type: 'fill_empty', card: flipped, fromPile: PILES.AI_FLIPPED, toPile: emptyHouse };
    }
    for (const hId of HOUSE_PILES) {
      if (hId === emptyHouse) continue;
      const top = topCard(houses[hId]);
      if (top) return { type: 'fill_empty', card: top, fromPile: hId, toPile: emptyHouse };
    }
  }

  // P1c: desenterrar carta para fundacion
  if (maxDepth > 0) {
    const uncover = findUncoverMove(houses, foundations, maxDepth);
    if (uncover) return uncover;
  }

  // P2: jugar al descarte del rival
  for (const card of playable) {
    if (canPlayToRivalDiscard(card, human.discard)) {
      return { type: 'rival_discard', card, fromPile: card.pile, toPile: PILES.HUMAN_DISCARD };
    }
  }

  // P2: jugar al crapette del rival
  for (const card of playable) {
    if (canPlayToRivalCrapette(card, human.crapette)) {
      return { type: 'rival_crapette', card, fromPile: card.pile, toPile: PILES.HUMAN_CRAPETTE };
    }
  }

  // P2: vaciar casa para bajar crapette/flipped
  const clearMove = findClearHouseMove(houses, crapTop, flipped);
  if (clearMove) return clearMove;

  // P2: bajar crapette a casa
  if (crapTop) {
    const move = findCrapetteToHouseMove(crapTop, houses);
    if (move) return move;
  }

  // P2: bajar flipped a casa
  if (flipped) {
    const move = findFlippedToHouseMove(flipped, houses);
    if (move) return move;
  }

  return null;
}

export function applyAIMove(state, move) {
  if (!move) return null;
  try {
    let ns = cloneState(state);

    switch (move.type) {

      case 'foundation': {
        if (move.fromPile === PILES.AI_FLIPPED) {
          const card = ns.ai.flipped;
          if (!card) return null;
          ns.ai = { ...ns.ai, flipped: null };
          ns.foundations = { ...ns.foundations,
            [move.toPile]: [...ns.foundations[move.toPile], { ...card, pile: move.toPile, pos: 0, faceUp: true }] };
        } else if (move.fromPile === PILES.AI_CRAPETTE) {
          const arr = [...ns.ai.crapette];
          if (!arr.length) return null;
          const card = arr.pop();
          if (arr.length > 0) arr[arr.length-1] = { ...arr[arr.length-1], faceUp: true };
          ns.ai = { ...ns.ai, crapette: arr };
          ns.foundations = { ...ns.foundations,
            [move.toPile]: [...ns.foundations[move.toPile], { ...card, pile: move.toPile, pos: 0, faceUp: true }] };
        } else {
          ns = moveTopCard(ns, move.fromPile, move.toPile);
        }
        break;
      }

      case 'fill_empty': {
        if (move.fromPile === PILES.AI_FLIPPED) {
          const card = ns.ai.flipped;
          if (!card) return null;
          ns.ai = { ...ns.ai, flipped: null };
          const pile = [...ns.houses[move.toPile], { ...card, pile: move.toPile, pos: 0, faceUp: true }];
          ns.houses = { ...ns.houses, [move.toPile]: recalcPositions(pile) };
        } else if (move.fromPile === PILES.AI_CRAPETTE) {
          const arr = [...ns.ai.crapette];
          if (!arr.length) return null;
          const card = arr.pop();
          if (arr.length > 0) arr[arr.length-1] = { ...arr[arr.length-1], faceUp: true };
          ns.ai = { ...ns.ai, crapette: arr };
          const pile = [...ns.houses[move.toPile], { ...card, pile: move.toPile, pos: 0, faceUp: true }];
          ns.houses = { ...ns.houses, [move.toPile]: recalcPositions(pile) };
        } else {
          ns = moveTopCard(ns, move.fromPile, move.toPile);
        }
        break;
      }

      case 'flipped_to_house': {
        const card = ns.ai.flipped;
        if (!card) return null;
        ns.ai = { ...ns.ai, flipped: null };
        const pile = [...ns.houses[move.toPile], { ...card, pile: move.toPile, pos: 0, faceUp: true }];
        ns.houses = { ...ns.houses, [move.toPile]: recalcPositions(pile) };
        break;
      }

      case 'uncover':
      case 'clear_house':
      case 'crapette_to_house':
      case 'house_to_house': {
        ns = moveTopCard(ns, move.fromPile, move.toPile);
        break;
      }

      case 'rival_discard':
      case 'rival_crapette': {
        const destKey = move.type === 'rival_discard' ? 'discard' : 'crapette';
        let card = null;
        if (move.fromPile === PILES.AI_FLIPPED) {
          card = ns.ai.flipped;
          if (!card) return null;
          ns.ai = { ...ns.ai, flipped: null };
        } else if (move.fromPile === PILES.AI_CRAPETTE) {
          const arr = [...ns.ai.crapette];
          if (!arr.length) return null;
          card = arr.pop();
          if (arr.length > 0) arr[arr.length-1] = { ...arr[arr.length-1], faceUp: true };
          ns.ai = { ...ns.ai, crapette: arr };
        } else {
          // Desde una casa
          const fromArr = [...ns.houses[move.fromPile]];
          if (!fromArr.length) return null;
          card = fromArr.pop();
          ns.houses = { ...ns.houses, [move.fromPile]: recalcPositions(fromArr) };
        }
        const destArr = [...ns.human[destKey], { ...card, faceUp: true }];
        ns.human = { ...ns.human, [destKey]: destArr };
        break;
      }

      default:
        console.warn('[AI] Tipo desconocido:', move.type);
        return null;
    }

    return ns;
  } catch (err) {
    console.error('[AI] Error:', err, move);
    return null;
  }
}

function getAIPlayableCards(ai, houses) {
  const cards = [];
  const crapTop = topCard(ai.crapette);
  if (crapTop) cards.push({ ...crapTop, pile: PILES.AI_CRAPETTE });
  if (ai.flipped) cards.push({ ...ai.flipped, pile: PILES.AI_FLIPPED });
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
