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
export function getMandatoryMoves(playerState, allHouses, foundations, canUseCrapette, player = "human") {
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
  if (canUseCrapette && playerState.crapette.length > 0) {
    const ownHouses = player === "ai" ? allHouses.slice(4, 8) : allHouses.slice(0, 4);
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

// ─── Analisis de jugadas obligatorias por nivel ──────────────────────────

// Obtener cartas superficiales jugables
function getSurfaceCards(playerState, canUseCrapette) {
  const cards = [];
  
  if (canUseCrapette) {
    const top = getTopCard(playerState.crapette);
    if (top) cards.push({ card: { ...top, faceUp: true }, source: "crapette" });
  }
  if (playerState.flippedCard) {
    cards.push({ card: playerState.flippedCard, source: "flipped" });
  }
  playerState.houses.forEach((house, i) => {
    const top = getTopCard(house);
    if (top) cards.push({ card: top, source: "house", houseIndex: i });
  });
  if (playerState.crapette.length === 0) {
    const top = getTopCard(playerState.discard);
    if (top) cards.push({ card: top, source: "discard" });
  }
  return cards;
}

// Nivel Basico: solo cartas en superficie que van a fundaciones o crapette a casa vacia
export function hasObligatoryMovesBasic(playerState, foundations, canUseCrapette) {
  const surface = getSurfaceCards(playerState, canUseCrapette);
  
  // Prioridad 1: As o carta a fundacion en superficie
  for (const { card } of surface) {
    if (canPlayToFoundation(card, foundations)) return true;
  }
  
  // Prioridad 2: Casa vacia que debe llenarse con crapette
  if (canUseCrapette && playerState.crapette.length > 0) {
    const hasEmpty = playerState.houses.some(h => h.length === 0);
    if (hasEmpty) return true;
  }
  
  return false;
}

// Nivel Medio: cartas enterradas 1 nivel que pueden liberarse con 1 movimiento
export function hasObligatoryMovesMedium(playerState, allHouses, foundations, canUseCrapette) {
  // Primero verificar nivel basico
  if (hasObligatoryMovesBasic(playerState, foundations, canUseCrapette)) return true;
  
  // Luego verificar cartas enterradas 1 nivel
  for (let hi = 0; hi < playerState.houses.length; hi++) {
    const house = playerState.houses[hi];
    if (house.length < 2) continue;
    
    // Carta enterrada (penultima)
    const buried = house[house.length - 2];
    if (!canPlayToFoundation(buried, foundations)) continue;
    
    // Carta encima (ultima) - puede moverse a otro sitio?
    const topCard = house[house.length - 1];
    for (let ti = 0; ti < allHouses.length; ti++) {
      if (ti === hi) continue;
      if (canPlayToHouse(topCard, allHouses[ti])) return true; // 1 movimiento indirecto posible
    }
  }
  
  return false;
}

// Nivel Experto: busqueda profunda de jugadas obligatorias
export function hasObligatoryMovesExpert(playerState, allHouses, foundations, canUseCrapette) {
  // Primero nivel medio
  if (hasObligatoryMovesMedium(playerState, allHouses, foundations, canUseCrapette)) return true;
  
  // Busqueda profunda: simular movimientos para llegar a carta obligatoria
  for (let hi = 0; hi < playerState.houses.length; hi++) {
    const house = playerState.houses[hi];
    
    // Buscar carta obligatoria enterrada a cualquier profundidad
    for (let depth = 2; depth < house.length; depth++) {
      const buried = house[house.length - 1 - depth];
      if (!canPlayToFoundation(buried, foundations)) continue;
      
      // Verificar si las cartas encima pueden moverse en cadena
      let canClear = true;
      const houseCopy = allHouses.map(h => [...h]);
      
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

// Funcion principal que usa el nivel correcto
export function hasObligatoryMoves(playerState, allPlayerHouses, foundations, canUseCrapette, level = "basic") {
  const allHouses = allPlayerHouses;
  switch(level) {
    case "expert": return hasObligatoryMovesExpert(playerState, allHouses, foundations, canUseCrapette);
    case "medium": return hasObligatoryMovesMedium(playerState, allHouses, foundations, canUseCrapette);
    default: return hasObligatoryMovesBasic(playerState, foundations, canUseCrapette);
  }
}

// Verificar si un movimiento especifico contribuye a liberar carta obligatoria
export function isMoveContributingToObligation(card, source, targetIndex, playerState, allHouses, foundations, canUseCrapette, level) {
  // Si la carta va directo a fundacion, siempre es valido
  if (canPlayToFoundation(card, foundations)) return true;
  
  // Si llena una casa vacia con el crapette, valido
  if (source === "crapette" && allHouses[targetIndex] && allHouses[targetIndex].length === 0) return true;
  
  // En nivel basico, cualquier otro movimiento puede ser stop
  if (level === "basic") return false;
  
  // En nivel medio/experto: verificar si este movimiento descubre carta obligatoria
  if (source === "house") {
    const sourceHouse = playerState.houses[targetIndex < 4 ? targetIndex : targetIndex - 4];
    if (sourceHouse && sourceHouse.length >= 2) {
      const nextCard = sourceHouse[sourceHouse.length - 2];
      if (canPlayToFoundation(nextCard, foundations)) return true;
    }
  }
  
  return false;
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
