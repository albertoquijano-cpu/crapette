// useAI.js — Orquesta los turnos de la IA con velocidad configurable

import { useEffect, useRef } from "react";
import { GAME_PHASES } from "../engine/gameState.js";

export function useAI(phase, aiSpeed, runAITurn) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase !== GAME_PHASES.AI_TURN) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => {
      runAITurn();
    }, aiSpeed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, aiSpeed, runAITurn]);
}
