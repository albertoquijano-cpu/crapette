// useGameLoop.js - Motor principal con fases de turno

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
  const stateRef = useRef(state);
  const announcedMoveRef = useRef(null);
  stateRef.current = state;

  // Verificar si el humano esta violando una jugada obligatoria
  const checkMandatoryViolation = (s, card, source) => {
    const mandatory = s.mandatoryMoves;
    if (!mandatory || mandatory.length === 0) return false;
    // Si la carta que se quiere jugar NO es una de las obligatorias, es violacion
    const isObligation = mandatory.some(m =>
      m.card.id === card.id && m.source === source
    );
    return !isObligation;
  };

  const update = useCallback((newState, move) => {
    setHistory(h => recordMove(h, move, stateRef.current));
    setLastMove(move);
    setState(newState);
  }, []);

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

  const revealCrapette = (crapette) => {
    if (crapette.length === 0) return crapette;
    const arr = [...crapette];
    arr[arr.length - 1] = { ...arr[arr.length - 1], faceUp: true };
    return arr;
  };

  const getAllHouses = (ns) => [...ns.human.houses, ...ns.ai.houses];

  // Calcular jugadas obligatorias para el jugador activo
  const calcMandatory = (ns, player, canUseCrapette) => {
    const ps = ns[player];
    const allHouses = getAllHouses(ns);
    const result = getMandatoryMoves(ps, allHouses, ns.foundations, canUseCrapette);
    console.log("[calcMandatory]", player, "canUseCrapette:", canUseCrapette, "mandatory:", result.map(m => m.reason));
    return result;
  };

  // Quitar carta de su origen
  const removeFromSource = (ns, source, houseIndex) => {
    if (source === "crapette") {
      ns.human.crapette.pop();
      ns.human.crapette = revealCrapette(ns.human.crapette);
    } else if (source === "house") {
      if (houseIndex >= 4) ns.ai.houses[houseIndex - 4].pop();
      else ns.human.houses[houseIndex].pop();
    } else if (source === "discard") {
      ns.human.discard.pop();
    } else if (source === "flipped") {
      ns.human.flippedCard = null;
    }
  };

  // ── Mover carta a fundacion ──────────────────────────────────────────────
  const playToFoundation = useCallback((card, source, houseIndex) => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;
    // Verificar violacion de jugada obligatoria
    if (checkMandatoryViolation(s, card, source)) {
      // El movimiento a fundacion siempre es valido si encaja
      // pero si hay OTRA obligatoria pendiente, no es violacion ir a fundacion
    }
    const fKey = canPlayToFoundation(card, s.foundations);
    if (!fKey) return;

    const ns = cloneState(s);
    removeFromSource(ns, source, houseIndex);
    ns.foundations[fKey] = [...ns.foundations[fKey], { ...card, faceUp: true }];

    // Recalcular jugadas obligatorias
    const canUseCrapette = !ns.crapetteUsedThisTurn;
    ns.mandatoryMoves = calcMandatory(ns, "human", canUseCrapette);
    ns.statusMessage = card.rank + " a fundacion";

    const winner = checkVictory(ns);
    if (winner) { update({ ...ns, phase: GAME_PHASES.GAME_OVER, winner }, { type: "foundation", card }); return; }
    update(ns, { type: "foundation", card, source });
  }, [update]);

  // ── Mover carta a casa ───────────────────────────────────────────────────
  const playToHouse = useCallback((card, source, sourceIndex, targetIndex) => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;

    // Verificar si hay jugadas obligatorias pendientes (con nivel correcto)
    const hasObligation_house = hasObligatoryMoves(
      s.human, getAllHouses(s), s.foundations, !s.crapetteUsedThisTurn, s.aiLevel
    );
    console.log("[playToHouse] hasObligation:", hasObligation_house, "mandatoryMoves:", s.mandatoryMoves?.length, s.mandatoryMoves?.map(m => m.reason));
    if (hasObligation_house && s.mandatoryMoves && s.mandatoryMoves.length > 0) {
      const isObligation = s.mandatoryMoves.some(m =>
        m.card.id === card.id && m.source === source && m.type === "fill_empty_casa"
      );
      if (!isObligation) {
        setState(prev => ({
          ...prev,
          stopValid: true,
          stopMessage: "Stop: " + prev.mandatoryMoves[0].reason,
          phase: GAME_PHASES.AI_TURN,
          currentPlayer: "ai",
          crapetteUsedThisTurn: false,
          statusMessage: "Stop! La IA ejecutara las jugadas obligatorias",
        }));
        return;
      }
    }

    const isAITarget = targetIndex >= 4;
    const realTarget = isAITarget ? targetIndex - 4 : targetIndex;
    const targetPile = isAITarget ? s.ai.houses[realTarget] : s.human.houses[realTarget];
    if (!targetPile) return;
    if (!canPlayToHouse(card, targetPile)) return;

    const ns = cloneState(s);

    // Si viene del crapette, marcar que ya se uso
    if (source === "crapette") ns.crapetteUsedThisTurn = true;
    removeFromSource(ns, source, sourceIndex);

    if (isAITarget) ns.ai.houses[realTarget].push({ ...card, faceUp: true });
    else ns.human.houses[realTarget].push({ ...card, faceUp: true });

    const canUseCrapette = !ns.crapetteUsedThisTurn;
    ns.mandatoryMoves = calcMandatory(ns, "human", canUseCrapette);
    ns.statusMessage = "Carta movida";
    update(ns, { type: "house", card, source });
  }, [update]);

  // ── Mover carta al rival ─────────────────────────────────────────────────
  const playToRivalPile = useCallback((card, source, sourceIndex, pileType) => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;

    // Verificar jugadas obligatorias pendientes (con nivel correcto)
    const hasObligation_rival = hasObligatoryMoves(
      s.human, getAllHouses(s), s.foundations, !s.crapetteUsedThisTurn, s.aiLevel
    );
    if (hasObligation_rival && s.mandatoryMoves && s.mandatoryMoves.length > 0) {
      const isObligation = s.mandatoryMoves.some(m =>
        m.card.id === card.id && m.source === source
      );
      if (!isObligation) {
        setState(prev => ({
          ...prev,
          stopValid: true,
          stopMessage: "Stop: " + prev.mandatoryMoves[0].reason,
          phase: GAME_PHASES.AI_TURN,
          currentPlayer: "ai",
          crapetteUsedThisTurn: false,
          statusMessage: "Stop! La IA ejecutara las jugadas obligatorias",
        }));
        return;
      }
    }

    const ns = cloneState(s);

    if (source === "crapette") ns.crapetteUsedThisTurn = true;
    removeFromSource(ns, source, sourceIndex);

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

    // Verificar jugadas obligatorias antes de voltear talon (con nivel correcto)
    const hasObligation_flip = hasObligatoryMoves(
      s.human, getAllHouses(s), s.foundations, !s.crapetteUsedThisTurn, s.aiLevel
    );
    if (hasObligation_flip && s.mandatoryMoves && s.mandatoryMoves.length > 0 && !s.human.flippedCard) {
      setState(prev => ({
        ...prev,
        stopValid: true,
        stopMessage: "Stop: " + prev.mandatoryMoves[0].reason,
        phase: GAME_PHASES.AI_TURN,
        currentPlayer: "ai",
        crapetteUsedThisTurn: false,
        statusMessage: "Stop! Debes hacer las jugadas obligatorias primero",
      }));
      return;
    }

    const ns = cloneState(s);

    // Si hay carta volteada, descartarla y terminar turno
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

    // Reconstruir talon si esta vacio
    if (ns.human.talon.length === 0) {
      const rebuilt = rebuildTalon(ns.human);
      ns.human.talon = rebuilt.talon;
      ns.human.discard = rebuilt.discard;
    }
    if (ns.human.talon.length === 0) return;

    // Voltear carta - a partir de aqui no se puede usar el crapette
    const card = { ...ns.human.talon.pop(), faceUp: true };
    ns.human.flippedCard = card;
    ns.crapetteUsedThisTurn = true; // Ya no puede volver al crapette

    // Verificar si la carta debe ir a fundacion (jugada obligatoria)
    const fKey = canPlayToFoundation(card, ns.foundations);
    ns.mandatoryMoves = fKey
      ? [{ type: "foundation", card, source: "flipped", target: fKey, reason: card.rank + " debe ir a la fundacion" }]
      : [];
    ns.statusMessage = fKey
      ? "Carta del talon — debe ir a la fundacion!"
      : "Carta volteada — jugala o descartala";
    update(ns, { type: "flip", card });
  }, [update]);

  // ── Descartar carta volteada ─────────────────────────────────────────────
  const discardFlipped = useCallback(() => {
    const s = stateRef.current;
    if (!HUMAN_PHASES.includes(s.phase)) return;
    if (!s.human.flippedCard) return;

    // Verificar que no haya jugadas obligatorias pendientes
    if (s.mandatoryMoves && s.mandatoryMoves.length > 0) {
      setState(prev => ({ ...prev, statusMessage: "Debes hacer las jugadas obligatorias primero!" }));
      return;
    }

    const ns = cloneState(s);
    const card = ns.human.flippedCard;
    ns.human.discard.push({ ...card, faceUp: true });
    ns.human.flippedCard = null;
    ns.phase = GAME_PHASES.AI_TURN;
    ns.currentPlayer = "ai";
    ns.crapetteUsedThisTurn = false;
    ns.mandatoryMoves = [];
    ns.statusMessage = "Turno de la IA";
    update(ns, { type: "discard", card });
  }, [update]);

  // ── Turno de la IA ───────────────────────────────────────────────────────
  const runAITurn = useCallback(() => {
    const s = stateRef.current;
    if (!AI_PHASES.includes(s.phase) && s.phase !== GAME_PHASES.AI_TURN) return;

    const ns = cloneState(s);

    // Si hay jugadas obligatorias del humano pendientes (por Stop),
    // la IA las ejecuta en nombre del humano, luego continua su turno
    const pendingMandatory = s.stopValid
      ? s.mandatoryMoves
      : calcMandatory(ns, "human", true);

    if (s.stopValid && pendingMandatory && pendingMandatory.length > 0) {
      const obligatoryMove = pendingMandatory[0];
      let newState = cloneState(ns);

      if (obligatoryMove.type === "foundation") {
        const fKey = canPlayToFoundation(obligatoryMove.card, newState.foundations);
        if (fKey) {
          // Quitar carta de su origen en el humano
          if (obligatoryMove.source === "crapette") {
            newState.human.crapette.pop();
            if (newState.human.crapette.length > 0)
              newState.human.crapette[newState.human.crapette.length-1] = { ...newState.human.crapette[newState.human.crapette.length-1], faceUp: true };
          } else if (obligatoryMove.source === "house") {
            if (obligatoryMove.houseIndex >= 4) newState.ai.houses[obligatoryMove.houseIndex-4].pop();
            else newState.human.houses[obligatoryMove.houseIndex].pop();
          } else if (obligatoryMove.source === "flipped") {
            newState.human.flippedCard = null;
          }
          newState.foundations[fKey] = [...newState.foundations[fKey], { ...obligatoryMove.card, faceUp: true }];
        }
      }

      // Recalcular jugadas obligatorias restantes
      const remaining = getMandatoryMoves(
        newState.human, getAllHouses(newState), newState.foundations, true
      );
      newState.mandatoryMoves = remaining;

      if (remaining.length > 0) {
        // Aun hay jugadas obligatorias - seguir ejecutandolas
        newState.stopValid = true;
        newState.stopMessage = "IA ejecutando jugadas obligatorias...";
        newState.statusMessage = "IA ejecutando jugadas obligatorias...";
      } else {
        // Todas ejecutadas - IA continua su turno normal
        newState.stopValid = false;
        newState.stopMessage = "Stop ejecutado - IA continua";
        newState.statusMessage = "IA jugando...";
        newState.phase = GAME_PHASES.AI_TURN;
        newState.currentPlayer = "ai";
      }

      const winner = checkVictory(newState);
      if (winner) { update({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, obligatoryMove); return; }
      update(newState, { type: "stop_execution", card: obligatoryMove.card });
      return;
    }

    const move = getAIMove(ns.ai, ns.human, ns.foundations, ns.aiLevel);

    if (move) {
      // Paso 1: Anunciar jugada por 2 segundos
      announcedMoveRef.current = move;
      setAnnouncedMove(move);
      setState(prev => ({
        ...prev,
        statusMessage: "IA va a jugar: " + move.card.rank + " de " + move.card.suit,
      }));

      // Paso 2: Ejecutar despues de 2 segundos
      setTimeout(() => {
        const currentState = stateRef.current;
        const ns2 = cloneState(currentState);
        const newState = applyAIMove(ns2, move);
        if (!newState) return;
        announcedMoveRef.current = null;
        setAnnouncedMove(null);
        const winner = checkVictory(newState);
        if (winner) { update({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, move); return; }
        update({ ...newState, statusMessage: "IA jugando..." }, move);
      }, 2000);
      return;
    }

    // Sin jugadas - voltear talon o descartar flipped
    if (ns.ai.flippedCard) {
      const card = ns.ai.flippedCard;
      ns.ai.discard.push(card);
      ns.ai.flippedCard = null;
      ns.phase = GAME_PHASES.HUMAN_TURN;
      ns.currentPlayer = "human";
      ns.crapetteUsedThisTurn = false;
      ns.mandatoryMoves = calcMandatory(ns, "human", true);
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
    if (!AI_PHASES.includes(s.phase) && s.phase !== GAME_PHASES.AI_TURN) return;

    // Verificar si hay jugadas obligatorias que la IA omitio
    const aiMandatory = getMandatoryMoves(
      s.ai,
      getAllHouses(s),
      s.foundations,
      !s.crapetteUsedThisTurn,
      "ai"
    );

    if (aiMandatory.length > 0) {
      // Stop valido
      setState(prev => ({
        ...prev,
        phase: GAME_PHASES.HUMAN_TURN,
        currentPlayer: "human",
        stopValid: true,
        stopMessage: "Stop valido: " + aiMandatory[0].reason,
        mandatoryMoves: getMandatoryMoves(prev.human, getAllHouses(prev), prev.foundations, true),
        statusMessage: "Stop valido — tu turno",
      }));
    } else {
      // Stop invalido — penalizacion al humano
      setState(prev => {
        const human = applyStopPenalty(prev.human);
        return {
          ...prev,
          human,
          stopValid: false,
          stopMessage: "Stop invalido — penalizacion aplicada",
          statusMessage: "Stop invalido — continua la IA",
        };
      });
    }
  }, []);

  // ── Reiniciar ────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    setState(createInitialState(config));
    setHistory(createHistory());
    setLastMove(null);
  }, [config]);

  return {
    state, history, lastMove, announcedMove,
    playToFoundation, playToHouse, playToRivalPile,
    flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  };
}
