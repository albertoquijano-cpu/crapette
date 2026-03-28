// useAI.js - Orquesta turnos de IA con velocidad configurable

import { useEffect, useRef } from "react";
import { GAME_PHASES } from "../engine/gameState.js";

export function useAI(phase, aiSpeed, runAITurn, aiLevel) {
  const timerRef = useRef(null);
  const runAITurnRef = useRef(runAITurn);

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

    // Experto: delay minimo entre movimientos para agotar todas las jugadas
    const delay = aiLevel === "expert" ? Math.min(aiSpeed, 800) : aiSpeed;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      runAITurnRef.current();
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  });
}
