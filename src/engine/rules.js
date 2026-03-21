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
  if (!top) return true; // Casa vacia acepta cualquier carta
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

// Verificar si hay casas vacias que deben llenarse con el crapette
export function getMandatoryCasaFills(playerState) {
  const emptyCasas = playerState.houses.filter(h => h.length === 0);
  if (emptyCasas.length === 0) return [];
  const crapetteTop = getTopCard(playerState.crapette);
  if (!crapetteTop) return [];
  return [{ card: crapetteTop, reason: "Hay casas vacias que deben llenarse con el Crapette" }];
}

// Evaluacion de Stop
export function evaluateStop(state, lastMove) {
  const player = state.currentPlayer;
  const playerState = state[player];
  const rival = player === "human" ? "ai" : "human";
  const rivalState = state[rival];

  // Condicion A: habia jugadas obligatorias a fundaciones
  const mandatory = getMandatoryFoundationMoves(playerState, rivalState, state.foundations);
  if (mandatory.length > 0 && lastMove?.type !== "foundation") {
    return { valid: true, reason: "Habia jugadas obligatorias a las fundaciones" };
  }

  // Condicion B: carta destapada del talon debia ir a fundacion
  if (lastMove?.type === "flip") {
    const fKey = canPlayToFoundation(lastMove.card, state.foundations);
    if (fKey) return { valid: true, reason: "La carta del talon debia ir a una fundacion" };
  }

  // Condicion C: movimiento libero carta que debe ir a fundacion
  if (lastMove?.type === "house" || lastMove?.type === "foundation") {
    const newMandatory = getMandatoryFoundationMoves(playerState, rivalState, state.foundations);
    if (newMandatory.length > 0) return { valid: true, reason: "El movimiento libero una carta para la fundacion" };
  }

  // Condicion D: hay casas vacias y el crapette tiene cartas
  const casaFills = getMandatoryCasaFills(playerState);
  if (casaFills.length > 0 && lastMove?.type !== "crapette_to_casa") {
    return { valid: true, reason: casaFills[0].reason };
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
