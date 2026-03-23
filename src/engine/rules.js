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

// Descarte/crapette rival: mismo palo, valor +1 o -1
export function canPlayToRivalDiscard(card, rivalPile) {
  if (!card) return false;
  const top = getTopCard(rivalPile);
  if (!top) return false;
  return (card.suit === top.suit &&
    (card.value === top.value + 1 || card.value === top.value - 1));
}

// Obtener cartas jugables del jugador activo
export function getPlayableCards(playerState, canUseDiscard, canUseCrapette) {
  const cards = [];

  // Crapette (solo si aun puede usarlo este turno)
  if (canUseCrapette) {
    const top = getTopCard(playerState.crapette);
    if (top) cards.push({ card: { ...top, faceUp: true }, source: "crapette" });
  }

  // Carta volteada del talon
  if (playerState.flippedCard) {
    cards.push({ card: playerState.flippedCard, source: "flipped" });
  }

  // Cartas superiores de casas
  playerState.houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });

  // Descarte (solo si crapette vacio)
  if (canUseDiscard && playerState.crapette.length === 0) {
    const top = getTopCard(playerState.discard);
    if (top) cards.push({ card: top, source: "discard" });
  }

  return cards;
}

// Jugadas OBLIGATORIAS: cartas a fundaciones y llenar casas vacias con crapette
export function getMandatoryMoves(playerState, allHouses, foundations, canUseCrapette) {
  const mandatory = [];
  const canUseDiscard = playerState.crapette.length === 0;
  const playable = getPlayableCards(playerState, canUseDiscard, canUseCrapette);

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

  // 2. Casas vacias que deben llenarse con el crapette
  // Solo las casas propias del jugador cuentan como obligatorias
  // allHouses[0..3] = human, allHouses[4..7] = ai
  // Pasamos solo las primeras 4 (del jugador)
  if (canUseCrapette && playerState.crapette.length > 0) {
    const ownHouses = allHouses.slice(0, 4);
    const hasEmptyOwnHouse = ownHouses.some(h => h.length === 0);
    if (hasEmptyOwnHouse) {
      const crapetteTop = getTopCard(playerState.crapette);
      if (crapetteTop) {
        mandatory.push({
          type: "fill_empty_casa",
          card: { ...crapetteTop, faceUp: true },
          source: "crapette",
          reason: "Hay casas vacias que deben llenarse con el Crapette"
        });
      }
    }
  }

  return mandatory;
}

// Penalizacion por Stop invalido o no poder hacer jugada obligatoria
export function applyStopPenalty(playerState) {
  const discard = [...playerState.discard];
  const crapette = [...playerState.crapette];
  const count = Math.min(3, discard.length);
  const penaltyCards = discard.splice(discard.length - count, count).map(c => ({ ...c, faceUp: true }));
  return { ...playerState, crapette: [...crapette, ...penaltyCards], discard };
}

// Rehacer talon desde descarte
export function rebuildTalon(playerState) {
  if (playerState.talon.length > 0) return playerState;
  if (playerState.discard.length === 0) return playerState;
  const newTalon = [...playerState.discard].reverse().map(c => ({ ...c, faceUp: false }));
  return { ...playerState, talon: newTalon, discard: [] };
}
