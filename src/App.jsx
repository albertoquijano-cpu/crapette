// App.jsx - Entrada principal con pantalla de configuracion

import { useState } from "react";
import { Board } from "./components/Board.jsx";
import { DEFAULT_CONFIG, AI_LEVEL_OPTIONS, VICTORY_MODE_OPTIONS, AI_SPEED_OPTIONS } from "./config/gameConfig.js";
import "./App.css";

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const handleStart = () => setGameStarted(true);
  const handleReset = () => setGameStarted(false);

  if (gameStarted) {
    return <Board config={config} onReset={handleReset} />;
  }

  return (
    <div className="setup">
      <div className="setup__card">
        <h1 className="setup__title">CRAPETTE</h1>
        <p className="setup__subtitle">Banca Rusa</p>

        <div className="setup__options">

          <div className="setup__group">
            <label className="setup__label">Nivel de IA</label>
            <div className="setup__radio-group">
              {AI_LEVEL_OPTIONS.map(opt => (
                <label key={opt.value} className={["setup__radio", config.aiLevel === opt.value && "setup__radio--active"].filter(Boolean).join(" ")}>
                  <input
                    type="radio"
                    name="aiLevel"
                    value={opt.value}
                    checked={config.aiLevel === opt.value}
                    onChange={() => setConfig(c => ({ ...c, aiLevel: opt.value }))}
                  />
                  <span className="setup__radio-label">{opt.label}</span>
                  <span className="setup__radio-desc">{opt.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="setup__group">
            <label className="setup__label">Victoria</label>
            <div className="setup__radio-group">
              {VICTORY_MODE_OPTIONS.map(opt => (
                <label key={opt.value} className={["setup__radio", config.victoryMode === opt.value && "setup__radio--active"].filter(Boolean).join(" ")}>
                  <input
                    type="radio"
                    name="victoryMode"
                    value={opt.value}
                    checked={config.victoryMode === opt.value}
                    onChange={() => setConfig(c => ({ ...c, victoryMode: opt.value }))}
                  />
                  <span className="setup__radio-label">{opt.label}</span>
                  <span className="setup__radio-desc">{opt.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="setup__group">
            <label className="setup__label">Velocidad IA</label>
            <select
              className="setup__select"
              value={config.aiSpeed}
              onChange={e => setConfig(c => ({ ...c, aiSpeed: Number(e.target.value) }))}
            >
              {AI_SPEED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="setup__group setup__group--row">
            <label className="setup__label">Penalizacion por Stop falso</label>
            <label className="setup__toggle">
              <input
                type="checkbox"
                checked={config.penaltyEnabled}
                onChange={e => setConfig(c => ({ ...c, penaltyEnabled: e.target.checked }))}
              />
              <span className="setup__toggle-slider" />
            </label>
          </div>

        </div>

        <button className="setup__btn" onClick={handleStart}>
          Comenzar partida
        </button>
      </div>
    </div>
  );
}
