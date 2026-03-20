// useGameLoop.js - Motor principal del juego

import { useState, useCallback, useRef } from "react";
import { createInitialState, checkVictory, GAME_PHASES } from "../engine/gameState.js";
import { canPlayToFoundation, canPlayToHouse, rebuildTalon } from "../engine/rules.js";
import { getAIMove, applyAIMove } from "../engine/ai.js";
import { createHistory, recordMove } from "../engine/moveHistory.js";

export function useGameLoop(config) {
  const [state, setState] = useState(() => createInitialState(config));
  const [history, setHistory] = useState(createHistory());
  const [lastMove, setLastMove] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((newState, move) => {
    setHistory(h => recordMove(h, move, stateRef.current));
    setLastMove(move);
    setState(newState);
  }, []);

  // Clonar estado para mutacion segura
  const cloneState = (s) => ({
    ...s,
    foundations: { ...s.foundations },
    human: {
      ...s.human,
      crapette: [...s.human.crapette],
      houses: s.human.houses.map(h => [...h]),
      discard: [...s.human.discard],
    },
    ai: {
      ...s.ai,
      crapette: [...s.ai.crapette],
      houses: s.ai.houses.map(h => [...h]),
      discard: [...s.ai.discard],
    },
  });

  // Descubrir carta superior del crapette
  const revealCrapette = (crapette) => {
    if (crapette.length === 0) return crapette;
    const arr = [...crapette];
    arr[arr.length - 1] = { ...arr[arr.length - 1], faceUp: true };
    return arr;
  };

  // Quitar carta de su origen
  // Convencion indices: 0-3 = human.houses, 4-7 = ai.houses
  const removeFromSource = (ns, source, houseIndex) => {
    if (source === "crapette") {
      ns.human.crapette.pop();
      ns.human.crapette = revealCrapette(ns.human.crapette);
    } else if (source === "house") {
      if (houseIndex >= 4) {
        ns.ai.houses[houseIndex - 4].pop();
      } else {
        ns.human.houses[houseIndex].pop();
      }
    } else if (source === "discard") {
      ns.human.discard.pop();
    } else if (source === "flipped") {
      ns.human.flippedCard = null;
    }
  };

  // ── Mover carta a fundacion ──────────────────────────────────────────────
  const playToFoundation = useCallback((card, source, houseIndex) => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;
    const fKey = canPlayToFoundation(card, s.foundations);
    if (!fKey) return;

    const ns = cloneState(s);
    removeFromSource(ns, source, houseIndex);
    ns.foundations[fKey] = [...ns.foundations[fKey], { ...card, faceUp: true }];
    ns.statusMessage = "Carta a fundacion";

    const winner = checkVictory(ns);
    if (winner) { update({ ...ns, phase: GAME_PHASES.GAME_OVER, winner }, { type: "foundation", card }); return; }
    update(ns, { type: "foundation", card, source });
  }, [update]);

  // ── Mover carta a casa (casas son neutrales) ─────────────────────────────
  // Convencion: indices 0-3 = human.houses, indices 4-7 = ai.houses
  const playToHouse = useCallback((card, source, sourceIndex, targetIndex) => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;

    const isAITarget = targetIndex >= 4;
    const realTargetIndex = isAITarget ? targetIndex - 4 : targetIndex;
    const targetPile = isAITarget
      ? s.ai.houses[realTargetIndex]
      : s.human.houses[realTargetIndex];

    if (!targetPile) return;
    if (!canPlayToHouse(card, targetPile)) return;

    const ns = cloneState(s);
    removeFromSource(ns, source, sourceIndex);

    if (isAITarget) {
      ns.ai.houses[realTargetIndex].push({ ...card, faceUp: true });
    } else {
      ns.human.houses[realTargetIndex].push({ ...card, faceUp: true });
    }
    ns.statusMessage = "Carta movida";
    update(ns, { type: "house", card, source });
  }, [update]);

  // ── Mover carta al crapette o descarte del rival ────────────────────────
  const playToRivalPile = useCallback((card, source, sourceIndex, pileType) => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;
    const ns = cloneState(s);
    removeFromSource(ns, source, sourceIndex);
    if (pileType === "discard") {
      ns.ai.discard.push({ ...card, faceUp: true });
    } else if (pileType === "crapette") {
      ns.ai.crapette.push({ ...card, faceUp: true });
      ns.ai.crapette = ns.ai.crapette.map((c, i) => ({
        ...c, faceUp: i === ns.ai.crapette.length - 1
      }));
    }
    ns.statusMessage = "Carta enviada al rival";
    update(ns, { type: pileType, card, source });
  }, [update]);

  // ── Voltear carta del talon ──────────────────────────────────────────────
  const flipTalon = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;
    const ns = cloneState(s);

    // Si hay carta volteada, descartarla y terminar turno
    if (ns.human.flippedCard) {
      ns.human.discard.push(ns.human.flippedCard);
      ns.human.flippedCard = null;
      ns.phase = GAME_PHASES.AI_TURN;
      ns.currentPlayer = "ai";
      ns.statusMessage = "Turno de la IA";
      update(ns, { type: "discard", card: ns.human.flippedCard });
      return;
    }

    // Reconstruir talon si esta vacio
    if (ns.human.talon.length === 0) {
      const rebuilt = rebuildTalon(ns.human);
      ns.human.talon = rebuilt.talon;
      ns.human.discard = rebuilt.discard;
    }
    if (ns.human.talon.length === 0) return;

    // Voltear carta
    const card = { ...ns.human.talon.pop(), faceUp: true };
    ns.human.flippedCard = card;
    ns.statusMessage = "Carta volteada — jugala o presiona Talon para descartar";
    update(ns, { type: "flip", card });
  }, [update]);

  // ── Descartar carta volteada ─────────────────────────────────────────────
  const discardFlipped = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;
    if (!s.human.flippedCard) return;
    const ns = cloneState(s);
    const card = ns.human.flippedCard;
    ns.human.discard.push({ ...card, faceUp: true });
    ns.human.flippedCard = null;
    ns.phase = GAME_PHASES.AI_TURN;
    ns.currentPlayer = "ai";
    ns.statusMessage = "Turno de la IA";
    update(ns, { type: "discard", card });
  }, [update]);

  // ── Turno de la IA ───────────────────────────────────────────────────────
  const runAITurn = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.AI_TURN) return;

    const ns = cloneState(s);

    // Buscar jugada
    const move = getAIMove(ns.ai, ns.human, ns.foundations, ns.aiLevel);
    if (move) {
      const newState = applyAIMove(ns, move);
      if (!newState) return;
      const winner = checkVictory(newState);
      if (winner) { update({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, move); return; }
      // Movimientos a casas son mas lentos para que el humano pueda seguirlos
      const extraDelay = (move.type === "house" || move.type === "human_house") ? 300 : 0;
      if (extraDelay > 0) {
        setTimeout(() => update({ ...newState, statusMessage: "IA jugando..." }, move), extraDelay);
      } else {
        update({ ...newState, statusMessage: "IA jugando..." }, move);
      }
      return;
    }

    // Sin jugadas — voltear talon o descartar flipped
    if (ns.ai.flippedCard) {
      const card = ns.ai.flippedCard;
      ns.ai.discard.push(card);
      ns.ai.flippedCard = null;
      ns.phase = GAME_PHASES.HUMAN_TURN;
      ns.currentPlayer = "human";
      ns.statusMessage = "Tu turno";
      update(ns, { type: "discard", card, player: "ai" });
      return;
    }

    if (ns.ai.talon.length === 0) {
      const rebuilt = rebuildTalon(ns.ai);
      ns.ai.talon = rebuilt.talon;
      ns.ai.discard = rebuilt.discard;
    }

    if (ns.ai.talon.length === 0) {
      ns.phase = GAME_PHASES.HUMAN_TURN;
      ns.currentPlayer = "human";
      ns.statusMessage = "Tu turno";
      update(ns, { type: "pass" });
      return;
    }

    const card = { ...ns.ai.talon.pop(), faceUp: true };
    ns.ai.flippedCard = card;
    update({ ...ns, statusMessage: "IA jugando..." }, { type: "flip", card, player: "ai" });
  }, [update]);

  // ── Declarar Stop ────────────────────────────────────────────────────────
  const declareStop = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.AI_TURN) return;
    // TODO: evaluar stop
    setState(prev => ({
      ...prev,
      phase: GAME_PHASES.HUMAN_TURN,
      currentPlayer: "human",
      statusMessage: "Stop declarado — tu turno",
    }));
  }, []);

  // ── Reiniciar ────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    setState(createInitialState(config));
    setHistory(createHistory());
    setLastMove(null);
  }, [config]);

  return {
    state,
    history,
    lastMove,
    playToFoundation,
    playToHouse,
    playToRivalPile,
    flipTalon,
    discardFlipped,
    runAITurn,
    declareStop,
    resetGame,
  };
}
