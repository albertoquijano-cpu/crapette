// useGameLoop.js - Motor principal con casas compartidas del tablero

import { useState, useCallback, useRef } from "react";
import { createInitialState, checkVictory, GAME_PHASES, HUMAN_PHASES, AI_PHASES } from "../engine/gameState.js";
import { canPlayToFoundation, canPlayToHouse, rebuildTalon, getMandatoryMoves, applyStopPenalty, hasObligatoryMoves } from "../engine/rules.js";
import { getAIMove, applyAIMove } from "../engine/ai.js";
import { createHistory, recordMove } from "../engine/moveHistory.js";

export function useGameLoop(config) {
  const [state, setState] = useState(() => createInitialState(config));
  const [history, setHistory] = useState(createHistory());
  const [lastMove, setLastMove] = useState(null);
  const [announcedMove, setAnnouncedMove] = useState(null);
  const [flyingCard, setFlyingCard] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((newState, move) => {
    setHistory(h => recordMove(h, move, stateRef.current));
    setLastMove(move);
    setState(newState);
  }, []);

  const cloneState = (s) => ({
    ...s,
    foundations: { ...s.foundations },
    houses: s.houses.map(h => [...h]),
    human: {
      ...s.human,
      crapette: [...s.human.crapette],
      discard: [...s.human.discard],
    },
    ai: {
      ...s.ai,
      crapette: [...s.ai.crapette],
      discard: [...s.ai.discard],
    },
  });

  const revealCrapette = (crapette) => {
    if (crapette.length === 0) return crapette;
    const arr = [...crapette];
    arr[arr.length - 1] = { ...arr[arr.length - 1], faceUp: true };
    return arr;
  };

  const calcMandatory = (ns, player, canUseCrapette) => {
    const ps = ns[player];
    return getMandatoryMoves(ps, ns.houses, ns.foundations, canUseCrapette);
  };

  // Quitar carta de su origen en el estado clonado
  const removeFromSource = (ns, source, houseIndex, player = "human") => {
    if (source === "crapette") {
      ns[player].crapette.pop();
      ns[player].crapette = revealCrapette(ns[player].crapette);
    } else if (source === "house") {
      ns.houses[houseIndex].pop();
    } else if (source === "discard") {
      ns[player].discard.pop();
    } else if (source === "flipped") {
      ns[player].flippedCard = null;
    }
  };

  // ── Mover carta a fundacion ──────────────────────────────────────────────
  const playToFoundation = useCallback((card, source, houseIndex) => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;

    const fKey = canPlayToFoundation(card, s.foundations);
    if (!fKey) return;

    // Si hay stop valido pendiente, el primer movimiento DEBE ser el obligatorio
    if (s.stopDeclared && s.stopValid && s.mandatoryMoves && s.mandatoryMoves.length > 0) {
      const isObligatory = s.mandatoryMoves.some(m => m.card.id === card.id && m.type === "foundation");
      if (!isObligatory) {
        setState(prev => {
          const ns = cloneState(prev);
          for (let i = 0; i < 3; i++) {
            if (ns.human.talon.length === 0) break;
            ns.human.crapette.push({ ...ns.human.talon.pop(), faceUp: false });
          }
          return {
            ...ns,
            phase: GAME_PHASES.AI_TURN,
            currentPlayer: "ai",
            stopDeclared: false,
            stopValid: null,
            stopMessage: "Stop fallido — no hiciste la jugada obligatoria — 3 cartas de castigo",
            statusMessage: "Stop fallido — turno de la IA",
            crapetteUsedThisTurn: false,
          };
        });
        return;
      }
    }
    const ns = cloneState(s);
    ns.humanHasPlayed = true;
    removeFromSource(ns, source, houseIndex, "human");
    ns.foundations[fKey] = [...ns.foundations[fKey], { ...card, faceUp: true }];

    const canUseCrapette = !ns.crapetteUsedThisTurn;
    ns.mandatoryMoves = calcMandatory(ns, "human", canUseCrapette);
    ns.statusMessage = card.rank + " a fundacion";
    if (ns.mandatoryMoves.length === 0) {
      ns.stopDeclared = false;
      ns.stopValid = null;
      ns.stopMessage = "";
    }

    const winner = checkVictory(ns);
    if (winner) { update({ ...ns, phase: GAME_PHASES.GAME_OVER, winner }, { type: "foundation", card }); return; }
    update(ns, { type: "foundation", card, source });
  }, [update]);

  // ── Mover carta a casa ───────────────────────────────────────────────────
  const playToHouse = useCallback((card, source, sourceIndex, targetIndex) => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;

    // El jugador puede mover libremente — el rival puede declarar Stop si ignora obligatorias
    // Si hay stop valido pendiente, el primer movimiento DEBE ser el obligatorio
    if (s.stopDeclared && s.stopValid && s.mandatoryMoves && s.mandatoryMoves.length > 0) {
      const isObligatory = s.mandatoryMoves.some(m =>
        m.card.id === card.id && (m.type === "house" || m.type === "fill_empty_casa")
      );
      if (!isObligatory) {
        setState(prev => {
          const ns = cloneState(prev);
          for (let i = 0; i < 3; i++) {
            if (ns.human.talon.length === 0) break;
            ns.human.crapette.push({ ...ns.human.talon.pop(), faceUp: false });
          }
          return {
            ...ns,
            phase: GAME_PHASES.AI_TURN,
            currentPlayer: "ai",
            stopDeclared: false,
            stopValid: null,
            stopMessage: "Stop fallido — no hiciste la jugada obligatoria — 3 cartas de castigo",
            statusMessage: "Stop fallido — turno de la IA",
            crapetteUsedThisTurn: false,
          };
        });
        return;
      }
    }

    if (!canPlayToHouse(card, s.houses[targetIndex])) return;

    const ns = cloneState(s);
    ns.humanHasPlayed = true;
    if (source === "crapette") ns.crapetteUsedThisTurn = true;
    removeFromSource(ns, source, sourceIndex, "human");
    ns.houses[targetIndex].push({ ...card, faceUp: true });

    const canUseCrapette = !ns.crapetteUsedThisTurn;
    ns.mandatoryMoves = calcMandatory(ns, "human", canUseCrapette);
    ns.statusMessage = "Carta movida";
    if (ns.mandatoryMoves.length === 0) {
      ns.stopDeclared = false;
      ns.stopValid = null;
      ns.stopMessage = "";
    }
    update(ns, { type: "house", card, source });
  }, [update]);

  // ── Mover carta al rival ─────────────────────────────────────────────────
  const playToRivalPile = useCallback((card, source, sourceIndex, pileType) => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;

    // El jugador puede mover libremente — el rival puede declarar Stop si ignora obligatorias
    // Si hay stop valido pendiente, el primer movimiento DEBE ser el obligatorio
    if (s.stopDeclared && s.stopValid && s.mandatoryMoves && s.mandatoryMoves.length > 0) {
      const isObligatory = s.mandatoryMoves.some(m => m.card.id === card.id && m.type === "rival");
      if (!isObligatory) {
        setState(prev => {
          const ns = cloneState(prev);
          for (let i = 0; i < 3; i++) {
            if (ns.human.talon.length === 0) break;
            ns.human.crapette.push({ ...ns.human.talon.pop(), faceUp: false });
          }
          return {
            ...ns,
            phase: GAME_PHASES.AI_TURN,
            currentPlayer: "ai",
            stopDeclared: false,
            stopValid: null,
            stopMessage: "Stop fallido — no hiciste la jugada obligatoria — 3 cartas de castigo",
            statusMessage: "Stop fallido — turno de la IA",
            crapetteUsedThisTurn: false,
          };
        });
        return;
      }
    }

    const ns = cloneState(s);
    if (source === "crapette") ns.crapetteUsedThisTurn = true;
    removeFromSource(ns, source, sourceIndex, "human");

    if (pileType === "discard") ns.ai.discard.push({ ...card, faceUp: true });
    else if (pileType === "crapette") {
      ns.ai.crapette.push({ ...card, faceUp: true });
      ns.ai.crapette = revealCrapette(ns.ai.crapette);
    }

    const canUseCrapette = !ns.crapetteUsedThisTurn;
    ns.mandatoryMoves = calcMandatory(ns, "human", canUseCrapette);
    ns.statusMessage = "Carta al rival";
    update(ns, { type: pileType, card, source });
  }, [update]);

  // ── Voltear carta del talon ──────────────────────────────────────────────
  const flipTalon = useCallback(() => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;

    // El jugador puede voltear talon libremente — el rival puede declarar Stop si ignora obligatorias

    const ns = cloneState(s);

    if (ns.human.flippedCard) {
      const card = ns.human.flippedCard;
      ns.human.discard.push(card);
      ns.human.flippedCard = null;
      ns.phase = GAME_PHASES.AI_TURN;
      ns.currentPlayer = "ai";
      ns.crapetteUsedThisTurn = false;
      ns.mandatoryMoves = [];
      ns.statusMessage = "Turno de la IA";
      update(ns, { type: "discard", card });
      return;
    }

    if (ns.human.talon.length === 0) {
      const rebuilt = rebuildTalon(ns.human);
      ns.human.talon = rebuilt.talon;
      ns.human.discard = rebuilt.discard;
    }
    if (ns.human.talon.length === 0) return;

    const card = { ...ns.human.talon.pop(), faceUp: true };
    ns.human.flippedCard = card;
    ns.crapetteUsedThisTurn = true;

    const fKey = canPlayToFoundation(card, ns.foundations);
    ns.mandatoryMoves = fKey
      ? [{ type: "foundation", card, source: "flipped", target: fKey, reason: card.rank + " debe ir a la fundacion" }]
      : [];
    ns.statusMessage = fKey ? "Carta del talon — debe ir a la fundacion!" : "Carta volteada — jugala o descartala";
    update(ns, { type: "flip", card });
  }, [update]);

  // ── Descartar carta volteada ─────────────────────────────────────────────
  const discardFlipped = useCallback(() => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;
    if (!s.human.flippedCard) return;

    const ns = cloneState(s);
    const card = ns.human.flippedCard;
    ns.human.discard.push({ ...card, faceUp: true });
    ns.human.flippedCard = null;
    ns.phase = GAME_PHASES.AI_TURN;
    ns.currentPlayer = "ai";
    ns.crapetteUsedThisTurn = false;
    ns.mandatoryMoves = [];

    // Verificar si habia obligatorios pendientes al pasar el turno
    if (ns.humanHasPlayed) {
      const pending = getMandatoryMoves(ns.human, ns.houses, ns.foundations, false);
      if (pending.length > 0) {
        ns.stopDeclared = true;
        ns.stopValid = true;
        ns.stopMessage = "Stop de la IA — pasaste turno con jugadas obligatorias pendientes";
        ns.statusMessage = "Stop — la IA toma el turno";
        update(ns, { type: "discard", card });
        return;
      }
    }

    ns.stopDeclared = false;
    ns.stopValid = null;
    ns.stopMessage = "";
    ns.statusMessage = "Turno de la IA";
    update(ns, { type: "discard", card });
  }, [update]);

  // ── Turno de la IA ───────────────────────────────────────────────────────
  const runAITurn = useCallback(() => {
    const s = stateRef.current;
    if (!AI_PHASES.includes(s.phase) && s.phase !== GAME_PHASES.AI_TURN) return;

    // ── Detectar si el humano ignoró jugadas obligatorias ─────────────────
    // Obligatorios se verifican en discardFlipped al pasar el turno

    const ns = cloneState(s);
    const move = getAIMove(ns.ai, ns.human, ns.houses, ns.foundations, ns.aiLevel);

    if (move) {
      setAnnouncedMove(move);
      setState(prev => ({
        ...prev,
        statusMessage: "IA: " + move.card.rank + " de " + move.card.suit,
      }));

      setTimeout(() => {
        const currentState = stateRef.current;
        const ns2 = cloneState(currentState);
        const newState = applyAIMove(ns2, move);
        if (!newState) return;
        setAnnouncedMove(null);
        setFlyingCard({ ...move });
        setTimeout(() => setFlyingCard(null), 650);
        const winner = checkVictory(newState);
        if (winner) { update({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, move); return; }
        update({ ...newState, statusMessage: "IA jugando..." }, move);
      }, 2000);
      return;
    }

    // Sin jugadas — voltear talon o pasar turno
    if (ns.ai.flippedCard) {
      const card = ns.ai.flippedCard;
      ns.ai.discard.push(card);
      ns.ai.flippedCard = null;
      ns.phase = GAME_PHASES.HUMAN_TURN;
      ns.currentPlayer = "human";
      ns.crapetteUsedThisTurn = false;
      ns.mandatoryMoves = calcMandatory(ns, "human", true);
      ns.stopDeclared = false;
      ns.stopValid = null;
      ns.stopMessage = "";
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
      ns.crapetteUsedThisTurn = false;
      ns.mandatoryMoves = calcMandatory(ns, "human", true);
      ns.stopDeclared = false;
      ns.stopValid = null;
      ns.stopMessage = "";
      ns.statusMessage = "Tu turno";
      update(ns, { type: "pass" });
      return;
    }

    const card = { ...ns.ai.talon.pop(), faceUp: true };
    ns.ai.flippedCard = card;
    update({ ...ns, statusMessage: "IA jugando..." }, { type: "flip", card, player: "ai" });
  }, [update]);

  // ── Declarar Stop (humano presiona tecla durante turno IA) ───────────────
  const declareStop = useCallback(() => {
    const s = stateRef.current;
    if (!AI_PHASES.includes(s.phase) && s.phase !== GAME_PHASES.AI_TURN) return;

    const aiMandatory = getMandatoryMoves(s.ai, s.houses, s.foundations, !s.crapetteUsedThisTurn);

    if (aiMandatory.length > 0) {
      setState(prev => ({
        ...prev,
        phase: GAME_PHASES.HUMAN_TURN,
        currentPlayer: "human",
        stopValid: true,
        stopDeclared: true,
        stopMessage: "Stop valido — haz la jugada obligatoria",
        crapetteUsedThisTurn: false,
        mandatoryMoves: getMandatoryMoves(prev.human, prev.houses, prev.foundations, true),
        statusMessage: "Stop valido — tu turno",
      }));
    } else {
      setState(prev => {
        const newHuman = applyStopPenalty(prev.human);
        return {
          ...prev,
          human: newHuman,
          stopValid: false,
          stopDeclared: false,
          stopMessage: "Stop invalido — 3 cartas de castigo",
          statusMessage: "Stop invalido — continua la IA",
        };
      });
    }
  }, []);

  // ── Stop automatico (IA detecta que humano toco carta incorrecta) ─────────
  const triggerAutoStop = useCallback(() => {
    // Mostrar mensaje de stop primero, luego pasar a la IA despues de 2 segundos
    setState(prev => ({
      ...prev,
      phase: GAME_PHASES.HUMAN_TURN, // mantener fase humano para mostrar mensaje
      stopValid: true,
      stopDeclared: true,
      stopMessage: "Stop! Tocaste carta incorrecta — la IA toma el turno",
      statusMessage: "Stop automatico — la IA continua en 2 segundos",
      crapetteUsedThisTurn: false,
    }));
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        phase: GAME_PHASES.AI_TURN,
        currentPlayer: "ai",
        stopMessage: "",
        statusMessage: "Turno de la IA",
      }));
    }, 2000);
  }, []);

  // ── Reiniciar ────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    setState(createInitialState(config));
    setHistory(createHistory());
    setLastMove(null);
    setAnnouncedMove(null);
    setFlyingCard(null);
  }, [config]);

  return {
    state, history, lastMove, announcedMove, flyingCard, triggerAutoStop,
    playToFoundation, playToHouse, playToRivalPile,
    flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  };
}
