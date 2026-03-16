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

  // Crapette: 13 cartas boca abajo, la superior boca arriba
  const crapette = shuffled.slice(0, 13).map((c, i) => ({
    ...c,
    faceUp: i === 12,
  }));

  // 4 casas de 4 cartas cada una, todas boca arriba
  const houses = [];
  for (let h = 0; h < 4; h++) {
    houses.push(
      shuffled.slice(13 + h * 4, 13 + h * 4 + 4).map((c) => ({
        ...c,
        faceUp: true,
      }))
    );
  }

  // Talon: cartas restantes (35) boca abajo
  const talon = shuffled.slice(29).map((c) => ({ ...c, faceUp: false }));

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
