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

// Casa: orden descendente, colores alternados, casa vacia solo acepta Rey
export function canPlayToHouse(card, targetPile) {
  if (!card) return false;
  const top = getTopCard(targetPile);
  if (!top) return card.value === 13; // Solo Rey en casa vacia
  return (card.value === top.value - 1 && card.color !== top.color);
}

// Descarte rival: mismo palo, valor inmediatamente superior o inferior
export function canPlayToRivalDiscard(card, rivalDiscard) {
  if (!card) return false;
  const top = getTopCard(rivalDiscard);
  if (!top) return false;
  return (
    card.suit === top.suit &&
    (card.value === top.value + 1 || card.value === top.value - 1)
  );
}

// Crapette rival: mismo palo, valor inmediatamente superior o inferior
export function canPlayToRivalCrapette(card, rivalCrapette) {
  if (!card) return false;
  const top = getTopCard(rivalCrapette);
  if (!top) return false;
  return (
    card.suit === top.suit &&
    (card.value === top.value + 1 || card.value === top.value - 1)
  );
}

// Obtener todas las cartas jugables de un jugador
export function getPlayableCards(playerState, rivalState) {
  const cards = [];
  const canUseDiscard = playerState.crapette.length === 0;

  // Carta superior del crapette propio
  const crapetteTop = getTopCard(playerState.crapette);
  if (crapetteTop) cards.push({ card: crapetteTop, source: "crapette" });

  // Carta volteada del talon
  if (playerState.flippedCard) {
    cards.push({ card: playerState.flippedCard, source: "flipped" });
  }

  // Cartas superiores de las casas propias
  playerState.houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });

  // Carta superior del descarte propio (solo si crapette vacio)
  if (canUseDiscard) {
    const discardTop = getTopCard(playerState.discard);
    if (discardTop) cards.push({ card: discardTop, source: "discard" });
  }

  // Cartas superiores de las casas del rival
  if (rivalState && rivalState.houses) {
    rivalState.houses.forEach((house, i) => {
      const top = getTopCard(house);
      if (top) cards.push({ card: top, source: "rival_house", houseIndex: i });
    });
  }

  return cards;
}

// Jugadas obligatorias a fundaciones
export function getMandatoryFoundationMoves(playerState, rivalState, foundations) {
  const playable = getPlayableCards(playerState, rivalState || null);
  const mandatory = [];
  for (const { card, source, houseIndex } of playable) {
    const foundationKey = canPlayToFoundation(card, foundations);
    if (foundationKey) mandatory.push({ card, source, houseIndex, foundationKey });
  }
  return mandatory;
}

// Evaluacion de Stop
export function evaluateStop(state, lastMove) {
  const player = state.currentPlayer;
  const playerState = state[player];
  const rival = player === "human" ? "ai" : "human";
  const rivalState = state[rival];

  const mandatoryBefore = getMandatoryFoundationMoves(playerState, rivalState, state.foundations);
  if (mandatoryBefore.length > 0 && lastMove?.type !== "foundation") {
    return { valid: true, reason: "Habia jugadas obligatorias a las fundaciones sin realizar" };
  }
  if (lastMove?.type === "flip" || lastMove?.type === "talon") {
    const foundationKey = canPlayToFoundation(lastMove.card, state.foundations);
    if (foundationKey) return { valid: true, reason: "La carta destapada debia ir a una fundacion" };
  }
  if (lastMove?.type === "house" || lastMove?.type === "crapette") {
    const mandatory = getMandatoryFoundationMoves(playerState, rivalState, state.foundations);
    if (mandatory.length > 0) return { valid: true, reason: "El movimiento libero una carta que debe ir a una fundacion" };
  }
  return { valid: false, reason: "El Stop no es valido" };
}

// Penalizacion por Stop invalido
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

export function isTurnOver(lastMove) {
  return lastMove?.type === "discard";
}
