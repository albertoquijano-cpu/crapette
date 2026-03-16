// Board.jsx - Tablero principal

import { useState, useCallback } from "react";
import { PlayerZone } from "./PlayerZone.jsx";
import { Foundation } from "./Foundation.jsx";
import { Controls } from "./Controls.jsx";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { useStopDetection } from "../hooks/useStopDetection.js";
import { useAI } from "../hooks/useAI.js";
import { canPlayToFoundation, canPlayToHouse } from "../engine/rules.js";
import "../styles/Board.css";

export function Board({ config }) {
  const {
    state, history, lastMove,
    playToFoundation, playToHouse, flipTalon,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);

  const [selectedCard, setSelectedCard] = useState(null);
  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 1000);

  useAI(state.phase, aiSpeed, runAITurn);
  useStopDetection(state.phase, declareStop);

  const handleCardClick = useCallback((card, source, houseIndex = null) => {
    if (!selectedCard) {
      setSelectedCard({ card, source, houseIndex });
      return;
    }
    if (selectedCard.card.id === card.id) {
      setSelectedCard(null);
      return;
    }
    setSelectedCard({ card, source, houseIndex });
  }, [selectedCard]);

  const handleHouseDrop = useCallback((e, targetIndex) => {
    e.preventDefault();
    if (!selectedCard) return;
    playToHouse(selectedCard.card, selectedCard.source, selectedCard.houseIndex, targetIndex);
    setSelectedCard(null);
  }, [selectedCard, playToHouse]);

  const handleHouseCardClick = useCallback((card, source, houseIndex) => {
    if (selectedCard) {
      playToHouse(selectedCard.card, selectedCard.source, selectedCard.houseIndex, houseIndex);
      setSelectedCard(null);
    } else {
      const fKey = canPlayToFoundation(card, state.foundations);
      if (fKey) {
        playToFoundation(card, source, houseIndex);
        return;
      }
      setSelectedCard({ card, source, houseIndex });
    }
  }, [selectedCard, state.foundations, playToFoundation, playToHouse]);

  const handleCrapetteClick = useCallback((card) => {
    if (selectedCard) { setSelectedCard(null); return; }
    const fKey = canPlayToFoundation(card, state.foundations);
    if (fKey) { playToFoundation(card, "crapette", null); return; }
    setSelectedCard({ card, source: "crapette", houseIndex: null });
  }, [selectedCard, state.foundations, playToFoundation]);

  const handleDiscardClick = useCallback((card) => {
    if (selectedCard) { setSelectedCard(null); return; }
    const fKey = canPlayToFoundation(card, state.foundations);
    if (fKey) { playToFoundation(card, "discard", null); return; }
    setSelectedCard({ card, source: "discard", houseIndex: null });
  }, [selectedCard, state.foundations, playToFoundation]);

  const handleDragStart = useCallback((e, card, source, houseIndex) => {
    setSelectedCard({ card, source, houseIndex });
  }, []);

  return (
    <div className="board">
      <div className="board__title">CRAPETTE</div>

      <PlayerZone
        playerState={state.ai}
        owner="ai"
        isActive={state.currentPlayer === "ai"}
        label="IA"
      />

      <div className="board__center">
        <Foundation foundations={state.foundations} />
        <Controls
          state={{ ...state, aiSpeed }}
          onSpeedChange={setAiSpeed}
          onReset={resetGame}
          onReplay={() => {}}
        />
      </div>

      <PlayerZone
        playerState={state.human}
        owner="human"
        isActive={state.currentPlayer === "human"}
        label="Tu"
        selectedCard={selectedCard}
        onCrapetteClick={handleCrapetteClick}
        onTalonClick={flipTalon}
        onDiscardClick={handleDiscardClick}
        onHouseCardClick={handleHouseCardClick}
        onCardDragStart={handleDragStart}
        onHouseDrop={handleHouseDrop}
        onHouseDragOver={(e) => e.preventDefault()}
      />
    </div>
  );
}
