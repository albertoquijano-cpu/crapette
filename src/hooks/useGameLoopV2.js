// useGameLoop.js — Motor principal del juego
// Arquitectura nueva: pilas numeradas, posición relativa, propósitos 1 y 2

import { useState, useCallback, useRef } from 'react';

import {
  createInitialState, cloneState, checkVictory,
  moveTopCard, topCard, rebuildTalon, applyStopPenalty,
  GAME_PHASES,
} from '../engine/gameState.js';

import {
  canPlayToFoundation, canPlayToHouse,
  canPlayToRivalDiscard, canPlayToRivalCrapette,
  getMandatoryMoves,
} from '../engine/rules.js';

import {
  getAIMove, applyAIMove, resetAITurnSession,
} from '../engine/ai.js';

import {
  PILES, HOUSE_PILES, verifyStateIntegrity,
} from '../engine/deck.js';

// ── Hook principal ────────────────────────────────────────────────────────────
// Convertir ID de fundacion numerica al key string que usa Board viejo
function adaptFoundationKey(pileId) {
  const map = {
    9: 'spades_human', 10: 'spades_ai',
    11: 'hearts_human', 12: 'hearts_ai',
    13: 'diamonds_human', 14: 'diamonds_ai',
    15: 'clubs_human', 16: 'clubs_ai',
  };
  return map[pileId] || null;
}

export function useGameLoop(config) {
  const [state, setState]             = useState(() => createInitialState(config));
  const [lastMove, setLastMove]       = useState(null);
  const [announcedMove, setAnnouncedMove] = useState(null);  // para animación visual
  const [flyingCard, setFlyingCard]   = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Actualizar estado con verificación ──────────────────────────────────────
  const update = useCallback((newState, move) => {
    if (process.env.NODE_ENV !== 'production') {
      verifyStateIntegrity(newState);
    }
    setLastMove(move);
    setState(newState);
  }, []);

  // ── Calcular jugadas obligatorias del humano ──────────────────────────────
  const calcMandatory = (ns) =>
    getMandatoryMoves(ns.human, ns.houses, ns.foundations, ns.aiLevel, true);

  // ── Helpers de pila personal ─────────────────────────────────────────────
  // Quita la carta superior de la pila personal del humano (crapette, flipped, discard)
  // y revela la siguiente si aplica.
  const removeHumanCard = (ns, source) => {
    switch (source) {
      case 'crapette': {
        const arr = [...ns.human.crapette];
        arr.pop();
        if (arr.length > 0) arr[arr.length - 1] = { ...arr[arr.length - 1], faceUp: true };
        ns.human = { ...ns.human, crapette: arr };
        break;
      }
      case 'flipped':
        ns.human = { ...ns.human, flipped: null };
        break;
      case 'discard': {
        const arr = [...ns.human.discard];
        arr.pop();
        ns.human = { ...ns.human, discard: arr };
        break;
      }
      // source 'house' se maneja vía moveTopCard
    }
  };

  // ── MOVER A FUNDACIÓN ─────────────────────────────────────────────────────
  const playToFoundation = useCallback((card, source, houseIndex) => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;

    const fId = canPlayToFoundation(card, s.foundations);
    if (!fId) return;

    // Stop pendiente: verificar que esta jugada es la obligatoria
    if (!checkStopCompliance(s, card, 'foundation')) return;

    const ns = cloneState(s);

    if (source === 'house') {
      // Usar moveTopCard para mover de casa a fundación
      const moved = moveTopCard(ns, houseIndex, fId);
      Object.assign(ns, moved);
    } else {
      // Carta personal → fundación
      removeHumanCard(ns, source);
      const pile = [...ns.foundations[fId], { ...card, faceUp: true, pile: fId, pos: 0 }];
      ns.foundations = { ...ns.foundations, [fId]: pile };
    }

    ns.mandatoryMoves = calcMandatory(ns);
    ns.statusMessage = `${card.rank} a fundación`;

    const winner = checkVictory(ns);
    if (winner) {
      update({ ...ns, phase: GAME_PHASES.GAME_OVER, winner }, { type: 'foundation', card });
      return;
    }
    update(ns, { type: 'foundation', card, source });
  }, [update]);

  // ── MOVER A CASA ──────────────────────────────────────────────────────────
  const playToHouse = useCallback((card, source, sourceIndex, targetIndex) => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;
    if (!canPlayToHouse(card, s.houses[targetIndex])) return;

    if (!checkStopCompliance(s, card, 'house')) return;

    const ns = cloneState(s);

    if (source === 'house') {
      const moved = moveTopCard(ns, sourceIndex, targetIndex);
      Object.assign(ns, moved);
    } else {
      removeHumanCard(ns, source);
      const arr = [...ns.houses[targetIndex], { ...card, faceUp: true, pile: targetIndex, pos: 0 }];
      // Recalc posiciones de la casa destino
      const n = arr.length;
      ns.houses = {
        ...ns.houses,
        [targetIndex]: arr.map((c, i) => ({ ...c, pos: (n - 1) - i })),
      };
    }

    ns.mandatoryMoves = calcMandatory(ns);
    ns.statusMessage = 'Carta movida';

    const winner = checkVictory(ns);
    if (winner) {
      update({ ...ns, phase: GAME_PHASES.GAME_OVER, winner }, { type: 'house', card });
      return;
    }
    update(ns, { type: 'house', card, source });
  }, [update]);

  // ── MOVER AL RIVAL ────────────────────────────────────────────────────────
  const playToRivalPile = useCallback((card, source, sourceIndex, pileType) => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;

    const valid = pileType === 'discard'
      ? canPlayToRivalDiscard(card, s.ai.discard)
      : canPlayToRivalCrapette(card, s.ai.crapette);
    if (!valid) return;

    if (!checkStopCompliance(s, card, 'rival')) return;

    const ns = cloneState(s);
    removeHumanCard(ns, source);

    if (pileType === 'discard') {
      ns.ai = { ...ns.ai, discard: [...ns.ai.discard, { ...card, faceUp: true }] };
    } else {
      const arr = [...ns.ai.crapette, { ...card, faceUp: true }];
      if (arr.length > 0) arr[arr.length - 1] = { ...arr[arr.length - 1], faceUp: true };
      ns.ai = { ...ns.ai, crapette: arr };
    }

    ns.mandatoryMoves = calcMandatory(ns);
    ns.statusMessage = 'Carta al rival';

    const winner = checkVictory(ns);
    if (winner) {
      update({ ...ns, phase: GAME_PHASES.GAME_OVER, winner }, { type: pileType, card });
      return;
    }
    update(ns, { type: pileType, card, source });
  }, [update]);

  // ── VOLTEAR TALON ─────────────────────────────────────────────────────────
  const flipTalon = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;

    const ns = cloneState(s);

    // Si ya hay carta volteada: descartarla y pasar turno
    if (ns.human.flipped) {
      const card = ns.human.flipped;
      ns.human = {
        ...ns.human,
        discard: [...ns.human.discard, { ...card, faceUp: true }],
        flipped: null,
      };
      ns.phase         = GAME_PHASES.AI_TURN;
      ns.currentPlayer = 'ai';
      ns.mandatoryMoves = [];
      ns.statusMessage  = 'Turno de la IA';
      update(ns, { type: 'discard', card });
      return;
    }

    // Reconstruir talon desde descarte si está vacío
    if (ns.human.talon.length === 0) {
      const rebuilt = rebuildTalon(ns.human, PILES.HUMAN_TALON);
      ns.human = rebuilt;
    }
    if (ns.human.talon.length === 0) return; // no hay cartas

    // Voltear carta superior del talon
    const talonArr  = [...ns.human.talon];
    const rawCard   = talonArr.pop();
    const card      = { ...rawCard, faceUp: true, pile: PILES.HUMAN_FLIPPED, pos: 0 };
    ns.human = { ...ns.human, talon: talonArr, flipped: card };

    // Una vez volteado el talon, el crapette queda bloqueado este turno
    ns.crapetteUsedThisTurn = true;

    // Solo es obligatorio si la carta va directamente a fundación
    const fId = canPlayToFoundation(card, ns.foundations);
    ns.mandatoryMoves = fId
      ? [{ type: 'foundation', card, fromPile: PILES.HUMAN_FLIPPED, toPile: fId }]
      : [];
    ns.statusMessage = fId
      ? `${card.rank} del talón — debe ir a fundación!`
      : 'Carta volteada — jugala o descártala';

    update(ns, { type: 'flip', card });
  }, [update]);

  // ── DESCARTAR CARTA VOLTEADA (pasar turno explícito) ─────────────────────
  const discardFlipped = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.HUMAN_TURN) return;
    if (!s.human.flipped) return;

    const ns = cloneState(s);
    const card = ns.human.flipped;
    ns.human = {
      ...ns.human,
      discard: [...ns.human.discard, { ...card, faceUp: true }],
      flipped: null,
    };

    // Verificar si el humano dejó jugadas obligatorias sin hacer
    const pending = getMandatoryMoves(ns.human, ns.houses, ns.foundations, ns.aiLevel, true);

    if (pending.some(m => m.type === 'foundation')) {
      ns.stopDeclared  = true;
      ns.stopValid     = true;
      ns.stopMessage   = '✋ Stop — No enviaste una carta a su fundación';
      ns.statusMessage = 'Stop — la IA toma el turno';
      ns.phase         = GAME_PHASES.AI_TURN;
      ns.currentPlayer = 'ai';
      ns.mandatoryMoves = [];
      update(ns, { type: 'discard', card });
      return;
    }

    if (pending.some(m => m.type === 'fill_empty') && ns.human.crapette.length > 0) {
      ns.stopDeclared  = true;
      ns.stopValid     = true;
      ns.stopMessage   = '✋ Stop — No llenaste la casa vacía';
      ns.statusMessage = 'Stop — la IA toma el turno';
      ns.phase         = GAME_PHASES.AI_TURN;
      ns.currentPlayer = 'ai';
      ns.mandatoryMoves = [];
      update(ns, { type: 'discard', card });
      return;
    }

    ns.stopDeclared  = false;
    ns.stopValid     = null;
    ns.stopMessage   = '';
    ns.phase         = GAME_PHASES.AI_TURN;
    ns.currentPlayer = 'ai';
    ns.mandatoryMoves = [];
    ns.statusMessage  = 'Turno de la IA';
    ns.crapetteUsedThisTurn = false;
    update(ns, { type: 'discard', card });
  }, [update]);

  // ── TURNO DE LA IA ────────────────────────────────────────────────────────
  const runAITurn = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.AI_TURN) return;

    const move = getAIMove(s);

    if (move) {
      const newState = applyAIMove(s, move);
      if (!newState) {
        // Fallo al aplicar — reiniciar sesión e intentar una vez más
        resetAITurnSession();
        const move2 = getAIMove(s);
        if (!move2) { passAITurn(s); return; }
        const ns2 = applyAIMove(s, move2);
        if (!ns2) { passAITurn(s); return; }
        finishAIMove(ns2, move2);
        return;
      }
      finishAIMove(newState, move);
      return;
    }

    // Sin jugadas — voltear talon o pasar
    passAITurn(s);
  }, [update]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Aplicar resultado de jugada IA al estado y animar
  const finishAIMove = (newState, move) => {
    const winner = checkVictory(newState);
    if (winner) {
      update({ ...newState, phase: GAME_PHASES.GAME_OVER, winner }, move);
      return;
    }
    update(
      { ...newState, statusMessage: (() => {
        const suitNames = { P: 'picas', C: 'corazones', D: 'diamantes', T: 'treboles' };
        const rankNames = { 1: 'As', 11: 'J', 12: 'Q', 13: 'K' };
        const r = rankNames[move.card.rank] || move.card.rank;
        const s = suitNames[move.card.suit] || move.card.suit;
        return `IA: ${r} de ${s}`;
      })() },
      move,
    );
    // Animación visual — adaptar al formato que espera Board.jsx original
    // Board viejo usa: source, houseIndex, target (en vez de fromPile, toPile)
    const adaptedMove = {
      ...move,
      // source: donde viene la carta
      source: move.fromPile >= 1 && move.fromPile <= 8 ? 'house'
             : move.fromPile === 24 ? 'crapette'
             : move.fromPile === 27 ? 'flipped'
             : move.fromPile === 26 ? 'discard'
             : 'crapette',
      // houseIndex: indice de la casa origen (0-7) si viene de casa
      houseIndex: (move.fromPile >= 1 && move.fromPile <= 8) ? move.fromPile - 1 : undefined,
      // target: destino en formato viejo
      target: move.toPile >= 1 && move.toPile <= 8 ? move.toPile - 1  // house index 0-7
             : move.toPile >= 9 && move.toPile <= 16 ? adaptFoundationKey(move.toPile)  // foundation key
             : move.toPile === 20 ? 'crapette-human'
             : move.toPile === 22 ? 'discard-human'
             : undefined,
    };
    setAnnouncedMove(adaptedMove);
    setFlyingCard({ ...adaptedMove });
    setTimeout(() => {
      setAnnouncedMove(null);
      setFlyingCard(null);
    }, stateRef.current.aiSpeed ?? 1000);
  };

  // Pasar turno de la IA (sin jugadas)
  const passAITurn = (s) => {
    const ns = cloneState(s);

    // Si hay carta volteada: descartarla
    if (ns.ai.flipped) {
      const card = ns.ai.flipped;
      ns.ai = { ...ns.ai, flipped: null, discard: [...ns.ai.discard, { ...card, faceUp: true }] };
      ns.phase         = GAME_PHASES.HUMAN_TURN;
      ns.currentPlayer = 'human';
      ns.crapetteUsedThisTurn = false;
      ns.mandatoryMoves = calcMandatory(ns);
      ns.stopDeclared  = false;
      ns.stopValid     = null;
      ns.stopMessage   = '';
      ns.statusMessage = 'Tu turno';
      resetAITurnSession();
      update(ns, { type: 'discard', card, player: 'ai' });
      return;
    }

    // Voltear talon de la IA
    if (ns.ai.talon.length === 0) {
      const rebuilt = rebuildTalon(ns.ai, PILES.AI_TALON);
      ns.ai = rebuilt;
    }

    if (ns.ai.talon.length === 0) {
      // IA sin cartas: pasar directamente
      ns.phase         = GAME_PHASES.HUMAN_TURN;
      ns.currentPlayer = 'human';
      ns.crapetteUsedThisTurn = false;
      ns.mandatoryMoves = calcMandatory(ns);
      ns.stopDeclared  = false;
      ns.stopValid     = null;
      ns.stopMessage   = '';
      ns.statusMessage = 'Tu turno';
      resetAITurnSession();
      update(ns, { type: 'pass' });
      return;
    }

    const talonArr = [...ns.ai.talon];
    const rawCard  = talonArr.pop();
    const card     = { ...rawCard, faceUp: true, pile: PILES.AI_FLIPPED, pos: 0 };
    ns.ai = { ...ns.ai, talon: talonArr, flipped: card };
    update({ ...ns, statusMessage: 'IA jugando...' }, { type: 'flip', card, player: 'ai' });
  };

  // ── DECLARAR STOP (humano durante turno IA) ───────────────────────────────
  const declareStop = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== GAME_PHASES.AI_TURN) return;

    const aiMandatory = getMandatoryMoves(s.ai, s.houses, s.foundations, s.aiLevel, false);

    if (aiMandatory.length > 0) {
      setState(prev => ({
        ...prev,
        phase:         GAME_PHASES.HUMAN_TURN,
        currentPlayer: 'human',
        stopValid:     true,
        stopDeclared:  true,
        stopMessage:   'Stop válido — haz la jugada obligatoria',
        crapetteUsedThisTurn: false,
        mandatoryMoves: getMandatoryMoves(prev.human, prev.houses, prev.foundations, prev.aiLevel, true),
        statusMessage: 'Stop válido — tu turno',
      }));
    } else {
      setState(prev => {
        const penalized = applyStopPenalty(prev.human, PILES.HUMAN_CRAPETTE);
        return {
          ...prev,
          human:        penalized,
          stopValid:    false,
          stopDeclared: false,
          stopMessage:  '✋ Stop inválido — no había jugada obligatoria — 3 cartas de castigo',
          statusMessage: 'Stop inválido — continúa la IA',
        };
      });
    }
  }, []);

  // ── REINICIAR ─────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    resetAITurnSession();
    setState(createInitialState(config));
    setLastMove(null);
    setAnnouncedMove(null);
    setFlyingCard(null);
  }, [config]);

  // ── Verificar cumplimiento de stop ───────────────────────────────────────
  // Retorna false y aplica penalidad si hay stop válido y el movimiento no lo cumple.
  function checkStopCompliance(s, card, moveType) {
    if (!s.stopDeclared || !s.stopValid) return true;
    if (!s.mandatoryMoves || s.mandatoryMoves.length === 0) return true;

    const isObligatory = s.mandatoryMoves.some(
      m => m.card?.id === card.id && m.type === moveType
    );
    if (isObligatory) return true;

    // Penalidad: 3 cartas de talon al crapette, pasar turno a IA
    setState(prev => {
      const ns = cloneState(prev);
      for (let i = 0; i < 3 && ns.human.talon.length > 0; i++) {
        const c = ns.human.talon.pop();
        ns.human.crapette.push({ ...c, faceUp: false, pile: PILES.HUMAN_CRAPETTE });
      }
      return {
        ...ns,
        phase:         GAME_PHASES.AI_TURN,
        currentPlayer: 'ai',
        stopDeclared:  false,
        stopValid:     null,
        stopMessage:   'Stop fallido — no hiciste la jugada obligatoria — 3 cartas de castigo',
        statusMessage: 'Stop fallido — turno de la IA',
        crapetteUsedThisTurn: false,
        mandatoryMoves: [],
      };
    });
    return false;
  }

  return {
    state,
    lastMove,
    announcedMove,
    flyingCard,
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
