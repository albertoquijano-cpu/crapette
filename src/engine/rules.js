// rules.js — Validacion de movimientos y condiciones de Stop

import { getTopCard, canUseDiscard } from "./gameState.js";

export function canPlayToFoundation(card, foundations) {
  if (!card) return null;
  for (const [key, pile] of Object.entries(foundations)) {
    if (!key.startsWith(card.suit)) continue;
    const top = getTopCard(pile);
    if (!top && card.value === 1) return key;
    if (top && top.suit === card.suit && card.value === top.value + 1) return key;
  }
  return null;
}

export function canPlayToHouse(card, targetPile) {
  if (!card) return false;
  const top = getTopCard(targetPile);
  if (!top) return true;
  return (card.value === top.value - 1 && card.color !== top.color);
}

export function canPlayToRivalDiscard(card, rivalDiscard) {
  if (!card) return false;
  const top = getTopCard(rivalDiscard);
  if (!top) return false;
  return (card.suit === top.suit && card.value === top.value + 1);
}

export function getPlayableCards(playerState, canUseDiscardPile) {
  const cards = [];
  const crapetteTop = playerState.crapette.length > 0 ? playerState.crapette[playerState.crapette.length - 1] : null;
  if (crapetteTop) cards.push({ card: crapetteTop, source: "crapette" });
  playerState.houses.forEach((house, i) => {
    const top = house.length > 0 ? house[house.length - 1] : null;
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });
  if (canUseDiscardPile && playerState.discard.length > 0) {
    const discardTop = playerState.discard[playerState.discard.length - 1];
    cards.push({ card: discardTop, source: "discard" });
  }
  return cards;
}

export function getMandatoryFoundationMoves(playerState, foundations) {
  const canDiscard = playerState.crapette.length === 0;
  const playable = getPlayableCards(playerState, canDiscard);
  const mandatory = [];
  for (const { card, source, houseIndex } of playable) {
    const foundationKey = canPlayToFoundation(card, foundations);
    if (foundationKey) mandatory.push({ card, source, houseIndex, foundationKey });
  }
  return mandatory;
}

export function evaluateStop(state, lastMove) {
  const player = state.currentPlayer;
  const playerState = state[player];

  const mandatoryBefore = getMandatoryFoundationMoves(playerState, state.foundations);
  if (mandatoryBefore.length > 0 && lastMove?.type !== "foundation") {
    return { valid: true, reason: "Habia jugadas obligatorias a las fundaciones sin realizar" };
  }
  if (lastMove?.type === "flip" || lastMove?.type === "talon") {
    const foundationKey = canPlayToFoundation(lastMove.card, state.foundations);
    if (foundationKey) return { valid: true, reason: "La carta destapada debia ir a una fundacion" };
  }
  if (lastMove?.type === "house" || lastMove?.type === "crapette") {
    const mandatory = getMandatoryFoundationMoves(playerState, state.foundations);
    if (mandatory.length > 0) return { valid: true, reason: "El movimiento libero una carta que debe ir a una fundacion" };
  }
  return { valid: false, reason: "El Stop no es valido" };
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

export function isTurnOver(lastMove) {
  return lastMove?.type === "discard";
}
