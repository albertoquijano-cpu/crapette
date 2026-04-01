// deck.js — Generador y barajador de mazos
// Algoritmo Fisher-Yates con entropía adicional

const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
const RED_SUITS = ["hearts", "diamonds"];

export function createDeck(ownerId) {
  const deck = [];
  for (const [i, suit] of SUITS.entries()) {
    for (const rank of RANKS) {
      deck.push({
        id: `${SUIT_NAMES[i]}_${rank}_${ownerId}`,
        suit: SUIT_NAMES[i],
        suitSymbol: suit,
        rank,
        value: RANK_VALUES[rank],
        color: RED_SUITS.includes(SUIT_NAMES[i]) ? "red" : "black",
        ownerId,
        faceUp: false,
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const arr = [...deck];
  // Fisher-Yates con multiple passes para mayor entropia
  for (let pass = 0; pass < 3; pass++) {
    for (let i = arr.length - 1; i > 0; i--) {
      // Combinar Math.random() con Date para mayor entropia
      const entropy = (Math.random() * Date.now()) % 1;
      const j = Math.floor(entropy * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  return arr;
}

export function dealCards(deck) {
  // Retorna el estado inicial de las pilas de un jugador
  const shuffled = shuffleDeck(deck);

  // Crapette: 13 cartas boca abajo, la superior (indice 12) boca arriba
  const crapette = shuffled.slice(0, 13).map((c, i) => ({
    ...c,
    faceUp: i === 12,
    position: { type: 'crapette', player: c.ownerId, index: i },
  }));

  // 4 casas de 1 carta cada una, boca arriba
  const houses = [];
  for (let h = 0; h < 4; h++) {
    houses.push([{ ...shuffled[13 + h], faceUp: true, position: { type: 'house', player: null, index: null } }]);
  }

  // Talon: 35 cartas restantes, todas boca abajo
  const talon = shuffled.slice(17).map((c, i) => ({ ...c, faceUp: false, position: { type: 'talon', player: c.ownerId, index: i } }));

  return { crapette, houses, talon, discard: [] };
}

export function isRed(card) {
  return card.color === "red";
}

export function isBlack(card) {
  return card.color === "black";
}

export function oppositeColor(card) {
  return isRed(card) ? "black" : "red";
}

// Verificar integridad del estado — sin duplicados
export function verifyStateIntegrity(state) {
  const seen = new Map();
  const allCards = [
    ...state.houses.flat(),
    ...Object.values(state.foundations).flat(),
    ...state.human.crapette,
    ...state.human.talon,
    ...state.human.discard,
    ...(state.human.flippedCard ? [state.human.flippedCard] : []),
    ...state.ai.crapette,
    ...state.ai.talon,
    ...state.ai.discard,
    ...(state.ai.flippedCard ? [state.ai.flippedCard] : []),
  ].filter(Boolean);

  const duplicates = [];
  for (const card of allCards) {
    if (!card.id) continue;
    if (seen.has(card.id)) duplicates.push(card.id);
    else seen.set(card.id, true);
  }

  if (duplicates.length > 0) console.error("[INTEGRITY] Cartas duplicadas:", duplicates);
  if (seen.size !== 104) console.warn("[INTEGRITY] Total cartas:", seen.size, "(esperado: 104)");
  return duplicates.length === 0;
}
