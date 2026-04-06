// deck.js — Generador y barajador de mazos
// Arquitectura nueva — IDs limpios sin owner, posición relativa

// ── Constantes de pilas ──────────────────────────────────────────────────────
// Casas del tablero (compartidas, sin dueño)
export const PILES = {
  // Casas: 1-8
  HOUSE_1: 1, HOUSE_2: 2, HOUSE_3: 3, HOUSE_4: 4,
  HOUSE_5: 5, HOUSE_6: 6, HOUSE_7: 7, HOUSE_8: 8,

  // Fundaciones: 9-16 (dos por palo, cualquier jugador puede usarlas)
  FOUND_SPADES_A:   9,  FOUND_SPADES_B:   10,
  FOUND_HEARTS_A:   11, FOUND_HEARTS_B:   12,
  FOUND_DIAMONDS_A: 13, FOUND_DIAMONDS_B: 14,
  FOUND_CLUBS_A:    15, FOUND_CLUBS_B:    16,

  // Pilas del jugador humano
  HUMAN_CRAPETTE: 20,
  HUMAN_TALON:    21,
  HUMAN_DISCARD:  22,
  HUMAN_FLIPPED:  23,  // carta volteada del talon (zona temporal)

  // Pilas de la IA
  AI_CRAPETTE: 24,
  AI_TALON:    25,
  AI_DISCARD:  26,
  AI_FLIPPED:  27,     // carta volteada del talon (zona temporal)
};

export const HOUSE_PILES    = [1, 2, 3, 4, 5, 6, 7, 8];
export const FOUND_PILES    = [9, 10, 11, 12, 13, 14, 15, 16];
export const HUMAN_PILES    = [20, 21, 22, 23];
export const AI_PILES       = [24, 25, 26, 27];

// Qué fundaciones acepta cada palo
export const SUIT_FOUNDATIONS = {
  P: [9, 10],   // Picas
  C: [11, 12],  // Corazones
  D: [13, 14],  // Diamantes
  T: [15, 16],  // Tréboles
};

export const SUIT_COLOR = { P: 'black', C: 'red', D: 'red', T: 'black' };
export const SUIT_SYMBOL = { P: '♠', C: '♥', D: '♦', T: '♣' };
export const SUIT_NAME = { P: 'Picas', C: 'Corazones', D: 'Diamantes', T: 'Tréboles' };
export const RANK_DISPLAY = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// ── Estructura de una carta ───────────────────────────────────────────────────
// {
//   rank: 1-13       (1=As, 11=J, 12=Q, 13=K)
//   suit: 'P'|'C'|'D'|'T'
//   pile: number     (ID de pila, 0 = sin asignar aún)
//   pos:  number     (posición en la pila: 0 = carta superior/jugable)
//   faceUp: boolean
//   color: 'red'|'black'  (derivado)
//   id: string       (derivado, para React keys: "3P", "11C", etc.)
// }

export function createCard(rank, suit, owner) {
  // owner: 'h' (human) | 'a' (ai) — solo para hacer el ID único entre los 2 mazos
  return {
    rank,
    suit,
    pile: 0,
    pos: 0,
    faceUp: false,
    color: SUIT_COLOR[suit],
    owner,
    id: `${rank}${suit}${owner}`,  // ej: "3Ph", "3Pa" — únicos en las 104 cartas
  };
}

export function createDeck(owner) {
  const suits = ['P', 'C', 'D', 'T'];
  const deck = [];
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push(createCard(rank, suit, owner));
    }
  }
  return deck; // 52 cartas
}

// Fisher-Yates
export function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Reparto inicial ───────────────────────────────────────────────────────────
// Cada jugador recibe un mazo de 52 cartas barajado.
// Resultado: { crapette, talon, startingHouses }
//
// Posición en crapette/talon: la carta del fondo es la más antigua.
// La carta de ARRIBA (última del array) tiene pos=0.
// Las demás tienen pos= (distancia desde arriba).
//
// startingHouses: array de 4 cartas (una por casa inicial del jugador).
// Cada una tiene pile y pos=0 asignados en gameState al construir el tablero.

export function dealCards(deck, crapettePile, talonPile) {
  const shuffled = shuffleDeck(deck);

  // 13 cartas al crapette (la última boca arriba, pos=0 en la cima)
  const crapetteCards = shuffled.slice(0, 13).map((c, i, arr) => ({
    ...c,
    pile: crapettePile,
    pos: (arr.length - 1) - i,   // carta 0 del array → pos más alta; último → pos 0
    faceUp: i === arr.length - 1, // solo la superior boca arriba
  }));

  // 4 cartas iniciales para las casas (boca arriba, pos=0)
  // pile se asignará en gameState cuando se coloquen en el tablero
  const startingHouses = shuffled.slice(13, 17).map(c => ({
    ...c,
    pile: 0,  // se asigna en gameState
    pos: 0,
    faceUp: true,
  }));

  // 35 cartas restantes al talon (todas boca abajo)
  const talonCards = shuffled.slice(17).map((c, i, arr) => ({
    ...c,
    pile: talonPile,
    pos: (arr.length - 1) - i,
    faceUp: false,
  }));

  return { crapette: crapetteCards, startingHouses, talon: talonCards };
}

// ── Display helpers ───────────────────────────────────────────────────────────
export function rankDisplay(rank) {
  return RANK_DISPLAY[rank] ?? String(rank);
}

export function cardLabel(card) {
  return `${rankDisplay(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

// ── Integridad del estado ────────────────────────────────────────────────────
// Verifica que las 104 cartas (2 mazos) están presentes sin duplicados.
export function verifyStateIntegrity(state) {
  const seen = new Map();
  const allCards = getAllCardsFromState(state);
  const duplicates = [];

  for (const card of allCards) {
    if (!card?.id) continue;
    if (seen.has(card.id)) duplicates.push(card.id);
    else seen.set(card.id, true);
  }

  if (duplicates.length > 0) console.error('[INTEGRITY] Cartas duplicadas:', duplicates);
  if (seen.size !== 104) console.warn('[INTEGRITY] Total cartas:', seen.size, '(esperado: 104)');
  return duplicates.length === 0;
}

export function getAllCardsFromState(state) {
  return [
    ...Object.values(state.houses).flat(),
    ...Object.values(state.foundations).flat(),
    ...state.human.crapette,
    ...state.human.talon,
    ...state.human.discard,
    ...(state.human.flipped ? [state.human.flipped] : []),
    ...state.ai.crapette,
    ...state.ai.talon,
    ...state.ai.discard,
    ...(state.ai.flipped ? [state.ai.flipped] : []),
  ].filter(Boolean);
}
