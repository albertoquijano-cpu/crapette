// useAI.js - Orquesta turnos de IA con velocidad configurable

import { useEffect, useRef } from "react";
import { GAME_PHASES } from "../engine/gameState.js";

export function useAI(phase, aiSpeed, runAITurn) {
  const timerRef = useRef(null);
  const runAITurnRef = useRef(runAITurn);
  const moveCountRef = useRef(0);

  useEffect(() => {
    runAITurnRef.current = runAITurn;
  });

  useEffect(() => {
    if (phase !== GAME_PHASES.AI_TURN) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      runAITurnRef.current();
    }, aiSpeed);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  });
}
