// App.jsx - Entrada principal con pantalla de configuracion

import { useState } from "react";
import { Board } from "./components/Board.jsx";
import { SplashScreen } from "./components/SplashScreen.jsx";
import { CreditsScreen } from "./components/CreditsScreen.jsx";
import { InfoModal } from "./components/InfoModal.jsx";
import { DEFAULT_CONFIG, AI_LEVEL_OPTIONS, VICTORY_MODE_OPTIONS, AI_SPEED_OPTIONS } from "./config/gameConfig.js";
import "./App.css";

const DESCRIPCION = (
  <div>
    <p><strong>Banca Rusa</strong>, conocida internacionalmente como <em>Crapette</em>, es un juego de cartas de habilidad y estrategia para <strong>dos jugadores</strong>. A diferencia de otros juegos de cartas, no interviene el azar una vez repartidas las cartas — el resultado depende enteramente de la atención, la memoria y la capacidad estratégica de cada jugador.</p>
    <br/>
    <p><strong>Origen</strong></p>
    <p>El juego tiene sus raíces en Francia, donde se conoce como <em>Crapette</em>, y se popularizó ampliamente en América Latina bajo el nombre de <strong>Banca Rusa</strong>. Es considerado uno de los juegos de cartas de dos jugadores más completos e intelectualmente exigentes de la tradición occidental.</p>
    <br/>
    <p><strong>Finalidad del juego</strong></p>
    <p>Según la opción que se escoja, el objetivo es ser el primero en terminar las cartas, ya sea del <strong>Crapette</strong> (pila personal de 13 cartas a la derecha) o terminar todas las cartas de las pilas propias, enviando todas sus cartas a las fundaciones centrales del tablero.</p>
    <br/>
    <p><strong>¿Por qué es especial?</strong></p>
    <p>• <strong>Competitivo:</strong> ambos jugadores comparten el mismo tablero y pueden interferir mutuamente.</p>
    <p>• <strong>Estratégico:</strong> cada movimiento puede abrir o cerrar oportunidades para el rival.</p>
    <p>• <strong>Vigilante:</strong> el mecanismo del <em>Stop</em> obliga a estar atento a los errores del oponente.</p>
    <p>• <strong>Dinámico:</strong> el juego cambia rápidamente con cada turno, requiriendo adaptación constante.</p>
  </div>
);

const MECANICA = (
  <div>
    <p><strong>Preparación</strong></p>
    <p>Cada jugador utiliza un mazo completo de 52 cartas. Al inicio recibe: <strong>13 cartas de Crapette</strong> (última boca arriba), <strong>35 cartas de Talón</strong> (boca abajo) y <strong>4 cartas en las Casas Laterales</strong> de su lado derecho. El descarte inicia vacío.</p>
    <br/>
    <p><strong>Objetivo</strong></p>
    <p>Vaciar el <strong>Crapette</strong> o terminar todas las cartas (según el juego escogido) enviando cartas a las fundaciones. Las fundaciones se construyen por palo comenzando con el As: A, 2, 3... hasta el K.</p>
    <br/>
    <p><strong>Movimientos Obligatorios</strong></p>
    <p>Antes de cualquier jugada se deben cumplir:</p>
    <p>• <strong>Cartas a fundaciones:</strong> cualquier carta disponible que pueda ir a fundación <em>debe</em> enviarse de inmediato. Incluye cartas "enterradas" en casas si pueden extraerse.</p>
    <p>• <strong>Llenar casas vacías:</strong> si hay una casa vacía, debe llenarse antes de continuar.</p>
    <p>⚠️ Con cada jugada hay que volver a verificar si surgen nuevas jugadas obligatorias.</p>
    <p>👁 <strong>Aviso:</strong> antes de cualquier jugada de la IA se iluminará en un recuadro verde el sitio donde va a jugar la próxima carta — esto te da tiempo para declarar un Stop si ves que esa jugada no va a ser la obligatoria.</p>
    <br/>
    <p><strong>Jugadas Corrientes</strong></p>
    <p>Una vez cumplidos los obligatorios, el jugador puede:</p>
    <p>• <strong>Mover cartas entre casas:</strong> valor inmediatamente inferior y color contrario. Casa vacía acepta cualquier carta.</p>
    <p>• <strong>Jugar al rival:</strong> sobre el descarte o crapette del rival si es mismo palo y valor +/-1. El crapette vacío del rival no acepta cartas.</p>
    <p>• <strong>Voltear el Talón</strong> cuando ya no tenga más opciones con el Crapette.</p>
    <p>• <strong>Descartar y pasar el turno:</strong> descarta la carta volteada → pasa el turno al rival.</p>
    <br/>
    <p><strong>Nota sobre el Crapette</strong></p>
    <p>Una vez volteada la primera carta del talón, el crapette queda <strong>bloqueado</strong> para ese turno.</p>
    <br/>
    <p><strong>El Stop</strong></p>
    <p>Si el rival olvida jugadas obligatorias, declara <strong>✋ Stop</strong>. Si es válido, el rival pierde su turno y continúas tú, comenzando por la jugada omitida. Si declaras Stop válido pero no haces la jugada obligatoria primero, recibes <strong>3 cartas de penalización</strong> y pierdes el turno.</p>
    <br/>
    <p><strong>Consejos estratégicos</strong></p>
    <p>• Prioriza vaciar el crapette — es tu objetivo principal.</p>
    <p>• Vigila las jugadas del rival — el Stop es tu mejor herramienta.</p>
    <p>• Usa las casas vacías como espacio de maniobra para desenterrar cartas útiles.</p>
    <p>• No voltees el talón apresuradamente — una vez volteado, el crapette queda bloqueado.</p>
    <p>• Planifica varios movimientos — cada jugada puede abrir o cerrar oportunidades.</p>
  </div>
);

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showCredits, setShowCredits] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [modal, setModal] = useState(null);

  const handleSplashDone = () => { setShowSplash(false); setShowCredits(true); };
  const handleCreditsDone = () => setShowCredits(false);
  const handleStart = () => setGameStarted(true);
  const handleReset = () => setGameStarted(false);

  if (showSplash) return <SplashScreen onStart={handleSplashDone} />;
  if (showCredits) return <CreditsScreen onContinue={handleCreditsDone} />;
  if (gameStarted) return (
    <Board
      config={config}
      onReset={handleReset}
      onDashboard={() => setGameStarted(false)}
      onExit={() => { setGameStarted(false); setShowSplash(true); }}
    />
  );

  return (
    <div className="setup">
      {modal === 'descripcion' && (
        <InfoModal title="Descripción General" onClose={() => setModal(null)}>
          {DESCRIPCION}
        </InfoModal>
      )}
      {modal === 'mecanica' && (
        <InfoModal title="Mecánica de Juego" onClose={() => setModal(null)}>
          {MECANICA}
        </InfoModal>
      )}

      <div className="setup__card">
        <h1 className="setup__title">BANCA RUSA</h1>
        <p className="setup__subtitle">Crapette</p>
        <p style={{ textAlign: 'center', color: 'rgba(201,168,76,0.4)', fontSize: '0.65em', letterSpacing: '0.1em', marginTop: '-16px', marginBottom: '8px', fontFamily: 'monospace' }}>v2.8.10</p>

        <div className="setup__info-btns">
          <button className="setup__info-btn" onClick={() => setModal('descripcion')}>
            📖 Descripción del juego
          </button>
          <button className="setup__info-btn" onClick={() => setModal('mecanica')}>
            🎮 Mecánica de juego
          </button>
        </div>

        <div className="setup__options">
          <div className="setup__group">
            <label className="setup__label">Nivel de IA</label>
            <div className="setup__radio-group">
              {AI_LEVEL_OPTIONS.map(opt => (
                <label key={opt.value} className={["setup__radio", config.aiLevel === opt.value && "setup__radio--active"].filter(Boolean).join(" ")}>
                  <input type="radio" name="aiLevel" value={opt.value} checked={config.aiLevel === opt.value} onChange={() => setConfig(c => ({ ...c, aiLevel: opt.value }))} />
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
                  <input type="radio" name="victoryMode" value={opt.value} checked={config.victoryMode === opt.value} onChange={() => setConfig(c => ({ ...c, victoryMode: opt.value }))} />
                  <span className="setup__radio-label">{opt.label}</span>
                  <span className="setup__radio-desc">{opt.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="setup__group">
            <label className="setup__label">Velocidad IA</label>
            <select className="setup__select" value={config.aiSpeed} onChange={e => setConfig(c => ({ ...c, aiSpeed: Number(e.target.value) }))}>
              {AI_SPEED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="setup__group setup__group--row">
            <label className="setup__label">Penalizacion por Stop falso</label>
            <label className="setup__toggle">
              <input type="checkbox" checked={config.penaltyEnabled} onChange={e => setConfig(c => ({ ...c, penaltyEnabled: e.target.checked }))} />
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
