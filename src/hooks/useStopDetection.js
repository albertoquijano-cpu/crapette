// useStopDetection.js — Escucha de teclado para declarar Stop

import { useEffect, useCallback } from "react";
import { GAME_PHASES } from "../engine/gameState.js";

export function useStopDetection(phase, onStop) {
  const handleKeyDown = useCallback((e) => {
    // Solo activo durante el turno de la IA
    if (phase !== GAME_PHASES.AI_TURN) return;
    // Ignorar teclas de sistema
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    onStop();
  }, [phase, onStop]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
