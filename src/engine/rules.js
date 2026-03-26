// rules.js - Reglas completas Banca Rusa

import { getTopCard } from "./gameState.js";

// Fundacion: As primero, luego orden ascendente mismo palo
export function canPlayToFoundation(card, foundations) {
  if (!card || !foundations) return null;
  for (const [key, pile] of Object.entries(foundations)) {
    if (!key.startsWith(card.suit)) continue;
    const top = getTopCard(pile);
    if (!top && card.value === 1) return key;
    if (top && top.suit === card.suit && card.value === top.value + 1) return key;
  }
  return null;
}

// Casa: orden descendente, colores alternados, casa vacia acepta cualquier carta
export function canPlayToHouse(card, targetPile) {
  if (!card) return false;
  const top = getTopCard(targetPile);
  if (!top) return true;
  return (card.value === top.value - 1 && card.color !== top.color);
}

// Descarte rival: pila vacia NO acepta — solo sobre carta existente mismo palo +/-1
export function canPlayToRivalDiscard(card, rivalPile) {
  if (!card) return false;
  const top = getTopCard(rivalPile);
  if (!top) return false;
  return (card.suit === top.suit &&
    (card.value === top.value + 1 || card.value === top.value - 1));
}

// Crapette rival: pila vacia NO acepta (crapette vacio = zona de victoria)
export function canPlayToRivalCrapette(card, rivalCrapette) {
  if (!card) return false;
  if (rivalCrapette.length === 0) return false; // crapette vacio no acepta
  const top = getTopCard(rivalCrapette);
  return (card.suit === top.suit &&
    (card.value === top.value + 1 || card.value === top.value - 1));
}

// Obtener cartas jugables del jugador activo
// houses: todas las casas del tablero (state.houses)
export function getPlayableCards(playerState, canUseDiscard, canUseCrapette, houses) {
  const cards = [];

  if (canUseCrapette) {
    const top = getTopCard(playerState.crapette);
    if (top) cards.push({ card: { ...top, faceUp: true }, source: "crapette" });
  }

  if (playerState.flippedCard) {
    cards.push({ card: playerState.flippedCard, source: "flipped" });
  }

  houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });

  if (canUseDiscard && playerState.crapette.length === 0) {
    const top = getTopCard(playerState.discard);
    if (top) cards.push({ card: top, source: "discard" });
  }

  return cards;
}

// Jugadas OBLIGATORIAS: cartas a fundaciones y llenar casas vacias con crapette
export function getMandatoryMoves(playerState, houses, foundations, canUseCrapette) {
  const mandatory = [];
  const canUseDiscard = playerState.crapette.length === 0;
  const playable = getPlayableCards(playerState, canUseDiscard, canUseCrapette, houses);

  // 1. Cartas que deben ir a fundaciones
  for (const { card, source, houseIndex } of playable) {
    const fKey = canPlayToFoundation(card, foundations);
    if (fKey) {
      mandatory.push({
        type: "foundation",
        card, source, houseIndex,
        target: fKey,
        reason: card.rank + " de " + card.suit + " debe ir a la fundacion"
      });
    }
  }

  // 2. Casas vacias — obligatorio llenarlas con cualquier carta (no solo crapette)
  // El humano puede usar casas vacias temporalmente para jugadas intermedias
  // Solo es obligatorio si al final del turno sigue vacia sin haber sido usada
  const hasEmpty = houses.some(h => h.length === 0);
  if (hasEmpty) {
    mandatory.push({
      type: "fill_empty_casa",
      card: null,
      source: null,
      reason: "Hay casas vacias que deben llenarse"
    });
  }

  return mandatory;
}

// Nivel Basico: cartas superficiales a fundaciones o crapette a casa vacia
export function hasObligatoryMovesBasic(playerState, houses, foundations, canUseCrapette) {
  const canUseDiscard = playerState.crapette.length === 0;
  const surface = getPlayableCards(playerState, canUseDiscard, canUseCrapette, houses);

  for (const { card } of surface) {
    if (canPlayToFoundation(card, foundations)) return true;
  }

  if (canUseCrapette && playerState.crapette.length > 0) {
    const hasEmpty = houses.some(h => h.length === 0);
    if (hasEmpty) return true;
  }

  return false;
}

// Nivel Medio: incluye cartas enterradas 1 nivel
export function hasObligatoryMovesMedium(playerState, houses, foundations, canUseCrapette) {
  if (hasObligatoryMovesBasic(playerState, houses, foundations, canUseCrapette)) return true;

  for (let hi = 0; hi < houses.length; hi++) {
    const house = houses[hi];
    if (house.length < 2) continue;
    const buried = house[house.length - 2];
    if (!canPlayToFoundation(buried, foundations)) continue;
    const topCard = house[house.length - 1];
    for (let ti = 0; ti < houses.length; ti++) {
      if (ti === hi) continue;
      if (canPlayToHouse(topCard, houses[ti])) return true;
    }
  }

  return false;
}

// Nivel Experto: busqueda profunda
export function hasObligatoryMovesExpert(playerState, houses, foundations, canUseCrapette) {
  if (hasObligatoryMovesMedium(playerState, houses, foundations, canUseCrapette)) return true;

  for (let hi = 0; hi < houses.length; hi++) {
    const house = houses[hi];
    for (let depth = 2; depth < house.length; depth++) {
      const buried = house[house.length - 1 - depth];
      if (!canPlayToFoundation(buried, foundations)) continue;
      let canClear = true;
      const houseCopy = houses.map(h => [...h]);
      for (let d = 0; d < depth; d++) {
        const cardToMove = house[house.length - 1 - d];
        let moved = false;
        for (let ti = 0; ti < houseCopy.length; ti++) {
          if (ti === hi) continue;
          if (canPlayToHouse(cardToMove, houseCopy[ti])) {
            houseCopy[ti] = [...houseCopy[ti], cardToMove];
            moved = true;
            break;
          }
        }
        if (!moved) { canClear = false; break; }
      }
      if (canClear) return true;
    }
  }

  return false;
}

export function hasObligatoryMoves(playerState, houses, foundations, canUseCrapette, level = "basic") {
  switch(level) {
    case "expert": return hasObligatoryMovesExpert(playerState, houses, foundations, canUseCrapette);
    case "medium": return hasObligatoryMovesMedium(playerState, houses, foundations, canUseCrapette);
    default: return hasObligatoryMovesBasic(playerState, houses, foundations, canUseCrapette);
  }
}

export function applyStopPenalty(playerState) {
  const discard = [...playerState.discard];
  const crapette = [...playerState.crapette];
  const count = Math.min(3, discard.length);
  const penaltyCards = discard.splice(discard.length - count, count).map(c => ({ ...c, faceUp: true }));
  return { ...playerState, crapette: [...crapette, ...penaltyCards], discard };
}

export function rebuildTalon(playerState) {
  if (playerState.talon.length > 0) return playerState;
  if (playerState.discard.length === 0) return playerState;
  const newTalon = [...playerState.discard].reverse().map(c => ({ ...c, faceUp: false }));
  return { ...playerState, talon: newTalon, discard: [] };
}
