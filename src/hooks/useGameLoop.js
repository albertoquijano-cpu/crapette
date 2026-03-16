// useGameLoop.js — Ciclo principal del juego

import { useState, useCallback, useRef } from "react";
import { createInitialState, checkVictory, GAME_PHASES } from "../engine/gameState.js";
import { canPlayToFoundation, canPlayToHouse, canPlayToRivalDiscard, evaluateStop, applyStopPenalty, rebuildTalon, isTurnOver } from "../engine/rules.js";
import { getAIMove, applyAIMove } from "../engine/ai.js";
import { createHistory, recordMove } from "../engine/moveHistory.js";

export function useGameLoop(config) {
  const [state, setState] = useState(() => createInitialState(config));
  const [history, setHistory] = useState(createHistory());
  const [lastMove, setLastMove] = useState(null);
  const aiTimerRef = useRef(null);

  // ─── Registrar jugada en historial ──────────────────────────────────────
  const recordAndUpdate = useCallback((newState, move) => {
    setHistory(h => recordMove(h, move, state));
    setLastMove(move);
    setState(newState);
  }, [state]);

  // ─── Jugada humana: mover carta a fundacion ──────────────────────────────
  const playToFoundation = useCallback((card, source, houseIndex) => {
    if (state.phase !== GAME_PHASES.HUMAN_TURN) return;
    const foundationKey = canPlayToFoundation(card, state.foundations);
    if (!foundationKey) return;

    const human = { ...state.human };
    const foundations = { ...state.foundations };

    if (source === "crapette") human.crapette = human.crapette.slice(0, -1);
    else if (source === "house") human.houses[houseIndex] = human.houses[houseIndex].slice(0, -1);
    else if (source === "discard") human.discard = human.discard.slice(0, -1);
    foundations[foundationKey] = [...foundations[foundationKey], { ...card, faceUp: true }];

    const newState = { ...state, human, foundations };
    const winner = checkVictory(newState);
    if (winner) {
      recordAndUpdate({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, { type: "foundation", card, source });
      return;
    }
    recordAndUpdate({ ...newState, statusMessage: "Carta enviada a fundacion" }, { type: "foundation", card, source });
  }, [state, recordAndUpdate]);

  // ─── Jugada humana: mover carta a casa ──────────────────────────────────
  const playToHouse = useCallback((card, source, sourceIndex, targetIndex) => {
    if (state.phase !== GAME_PHASES.HUMAN_TURN) return;
    if (!canPlayToHouse(card, state.human.houses[targetIndex])) return;

    const human = { ...state.human };
    if (source === "crapette") human.crapette = human.crapette.slice(0, -1);
    else if (source === "house") human.houses[sourceIndex] = human.houses[sourceIndex].slice(0, -1);
    else if (source === "discard") human.discard = human.discard.slice(0, -1);
    human.houses[targetIndex] = [...human.houses[targetIndex], { ...card, faceUp: true }];

    recordAndUpdate({ ...state, human, statusMessage: "Carta movida a casa" }, { type: "house", card, source });
  }, [state, recordAndUpdate]);

  // ─── Jugada humana: voltear carta del Talon ──────────────────────────────
  const flipTalon = useCallback(() => {
    if (state.phase !== GAME_PHASES.HUMAN_TURN) return;
    let human = { ...state.human };

    if (human.talon.length === 0) {
      human = rebuildTalon(human);
      if (human.talon.length === 0) return;
    }

    const card = { ...human.talon[human.talon.length - 1], faceUp: true };
    human.talon = human.talon.slice(0, -1);

    const foundationKey = canPlayToFoundation(card, state.foundations);
    if (foundationKey) {
      const foundations = { ...state.foundations };
      foundations[foundationKey] = [...foundations[foundationKey], card];
      const newState = { ...state, human, foundations, statusMessage: "Carta del talon a fundacion" };
      const winner = checkVictory(newState);
      if (winner) { recordAndUpdate({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, { type: "foundation", card }); return; }
      recordAndUpdate(newState, { type: "talon", card });
      return;
    }

    // No juega — va al descarte, fin de turno
    human.discard = [...human.discard, card];
    recordAndUpdate(
      { ...state, human, phase: GAME_PHASES.AI_TURN, currentPlayer: "ai", statusMessage: "Turno de la IA" },
      { type: "discard", card }
    );
  }, [state, recordAndUpdate]);

  // ─── Turno de la IA ──────────────────────────────────────────────────────
  const runAITurn = useCallback(() => {
    if (state.phase !== GAME_PHASES.AI_TURN) return;

    const move = getAIMove(state.ai, state.human, state.foundations, state.aiLevel);
    if (!move) {
      // IA sin jugadas — voltea Talon
      let ai = { ...state.ai };
      if (ai.talon.length === 0) ai = rebuildTalon(ai);
      if (ai.talon.length === 0) {
        // Sin cartas en talon ni descarte — pasa turno
        recordAndUpdate({ ...state, phase: GAME_PHASES.HUMAN_TURN, currentPlayer: "human", statusMessage: "Tu turno" }, { type: "pass" });
        return;
      }
      const card = { ...ai.talon[ai.talon.length - 1], faceUp: true };
      ai.talon = ai.talon.slice(0, -1);
      ai.discard = [...ai.discard, card];
      recordAndUpdate(
        { ...state, ai, phase: GAME_PHASES.HUMAN_TURN, currentPlayer: "human", statusMessage: "Tu turno" },
        { type: "discard", card, player: "ai" }
      );
      return;
    }

    const newState = applyAIMove(state, move);
    if (!newState) return;
    const winner = checkVictory(newState);
    if (winner) { recordAndUpdate({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, move); return; }
    recordAndUpdate({ ...newState, statusMessage: "IA jugando..." }, move);
  }, [state, recordAndUpdate]);

  // ─── Declarar Stop ───────────────────────────────────────────────────────
  const declareStop = useCallback(() => {
    if (state.phase !== GAME_PHASES.AI_TURN) return;
    const result = evaluateStop(state, lastMove);
    if (result.valid) {
      setState(s => ({
        ...s,
        phase: GAME_PHASES.HUMAN_TURN,
        currentPlayer: "human",
        stopDeclared: true,
        stopValid: true,
        stopMessage: result.reason,
        statusMessage: "Stop valido — es tu turno",
      }));
    } else {
      if (state.penaltyEnabled) {
        const human = applyStopPenalty(state.human);
        setState(s => ({
          ...s,
          human,
          stopDeclared: true,
          stopValid: false,
          stopMessage: result.reason,
          statusMessage: "Stop invalido — penalizacion aplicada",
        }));
      } else {
        setState(s => ({
          ...s,
          stopDeclared: true,
          stopValid: false,
          stopMessage: result.reason,
          statusMessage: "Stop invalido — el juego continua",
        }));
      }
    }
  }, [state, lastMove]);

  // ─── Reiniciar juego ─────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
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
    flipTalon,
    runAITurn,
    declareStop,
    resetGame,
  };
}
