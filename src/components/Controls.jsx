// Controls.jsx — Controles del juego

import "../styles/Controls.css";
import { AI_SPEED_OPTIONS } from "../config/gameConfig.js";
import { GAME_PHASES } from "../engine/gameState.js";

export function Controls({ state, onSpeedChange, onReset, onReplay, onDashboard, onExit }) {
  const isAITurn = state.phase === GAME_PHASES.AI_TURN;
  const isHumanTurn = state.phase === GAME_PHASES.HUMAN_TURN;
  const isGameOver = state.phase === GAME_PHASES.GAME_OVER;

  return (
    <div className="controls">

      {/* Mensaje de estado */}
      <div className={["controls__status", isAITurn && "controls__status--ai", isHumanTurn && "controls__status--human"].filter(Boolean).join(" ")}>
        {state.statusMessage}
      </div>

      {/* Stop feedback */}
      {state.stopDeclared && (
        <div className={["controls__stop-feedback", state.stopValid ? "controls__stop-feedback--valid" : "controls__stop-feedback--invalid"].join(" ")}>
          {state.stopValid ? "✓ Stop válido" : "✗ Stop inválido"} — {state.stopMessage}
        </div>
      )}

      {/* Indicador turno IA */}
      {isAITurn && (
        <div className="controls__ai-hint">
          Usa el botón <strong>✋ STOP</strong> en el tablero para declarar Stop
        </div>
      )}

      <div className="controls__row">

        {/* Velocidad IA */}
        <div className="controls__speed">
          <label className="controls__label">Velocidad IA</label>
          <select
            className="controls__select"
            value={state.aiSpeed}
            onChange={e => onSpeedChange(Number(e.target.value))}
          >
            {AI_SPEED_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Botones */}
        <div className="controls__buttons">
          {isGameOver && (
            <button className="controls__btn controls__btn--replay" onClick={onReplay}>
              ▶ Replay
            </button>
          )}
          <button className="controls__btn controls__btn--reset" onClick={onReset}>
            ↺ Nueva partida
          </button>
          <button className="controls__btn controls__btn--dashboard" onClick={onDashboard}>
            ⚙ Dashboard
          </button>
          <button className="controls__btn controls__btn--exit" onClick={onExit}>
            ✕ Salir
          </button>
        </div>

      </div>

      {/* Game Over */}
      {isGameOver && (
        <div className="controls__gameover">
          {state.winner === "human" ? "🏆 ¡Ganaste!" : "💀 Ganó la IA"}
        </div>
      )}

    </div>
  );
}
