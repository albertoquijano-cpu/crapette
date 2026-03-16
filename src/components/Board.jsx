// Board.jsx - Layout correcto

import { useState, useCallback } from "react";
import { Card } from "./Card.jsx";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { useStopDetection } from "../hooks/useStopDetection.js";
import { useAI } from "../hooks/useAI.js";
import { canPlayToFoundation, canPlayToHouse } from "../engine/rules.js";
import "../styles/Board.css";

const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLORS  = { spades: "black", hearts: "red", diamonds: "red", clubs: "black" };
const SUITS = ["spades", "hearts", "diamonds", "clubs"];

export function Board({ config, onReset }) {
  const {
    state, lastMove,
    playToFoundation, playToHouse, flipTalon,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);

  const [selectedCard, setSelectedCard] = useState(null);
  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 1000);

  useAI(state.phase, aiSpeed, runAITurn);
  useStopDetection(state.phase, declareStop);

  const isHumanTurn = state.currentPlayer === "human";

  const selectCard = useCallback((card, source, houseIndex = null) => {
    if (!isHumanTurn) return;
    if (selectedCard && selectedCard.card.id === card.id) {
      setSelectedCard(null); return;
    }
    setSelectedCard({ card, source, houseIndex });
  }, [selectedCard, isHumanTurn]);

  const handleHouseClick = useCallback((card, source, houseIndex, owner) => {
    if (owner !== "human") return;
    if (selectedCard) {
      playToHouse(selectedCard.card, selectedCard.source, selectedCard.houseIndex, houseIndex);
      setSelectedCard(null);
    } else {
      const fKey = canPlayToFoundation(card, state.foundations);
      if (fKey) { playToFoundation(card, source, houseIndex); return; }
      selectCard(card, source, houseIndex);
    }
  }, [selectedCard, state.foundations, playToFoundation, playToHouse, selectCard]);

  const handleFoundationClick = useCallback((foundationKey) => {
    if (!selectedCard) return;
    const fKey = canPlayToFoundation(selectedCard.card, state.foundations);
    if (fKey === foundationKey) {
      playToFoundation(selectedCard.card, selectedCard.source, selectedCard.houseIndex);
      setSelectedCard(null);
    }
  }, [selectedCard, state.foundations, playToFoundation]);

  const handleCrapetteClick = useCallback(() => {
    if (!isHumanTurn) return;
    const top = state.human.crapette[state.human.crapette.length - 1];
    if (!top) return;
    if (selectedCard) { setSelectedCard(null); return; }
    const fKey = canPlayToFoundation(top, state.foundations);
    if (fKey) { playToFoundation(top, "crapette", null); return; }
    selectCard(top, "crapette", null);
  }, [isHumanTurn, state, selectedCard, playToFoundation, selectCard]);

  const handleDiscardClick = useCallback(() => {
    if (!isHumanTurn || state.human.crapette.length > 0) return;
    const top = state.human.discard[state.human.discard.length - 1];
    if (!top) return;
    if (selectedCard) { setSelectedCard(null); return; }
    const fKey = canPlayToFoundation(top, state.foundations);
    if (fKey) { playToFoundation(top, "discard", null); return; }
    selectCard(top, "discard", null);
  }, [isHumanTurn, state, selectedCard, playToFoundation, selectCard]);

  const renderHouse = (pile, houseIndex, owner) => {
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isSelected = selectedCard && top && selectedCard.card.id === top.id;
    return (
      <div key={houseIndex} className="house-slot"
        onClick={() => top && handleHouseClick(top, "house", houseIndex, owner)}>
        {pile.length === 0 ? (
          <div className="house-slot__empty" />
        ) : (
          <div className="house-slot__stack">
            {pile.map((card, ci) => (
              <div key={card.id} className="house-slot__card" style={{ top: ci * 20 + "px" }}>
                <Card card={card} selected={isSelected && ci === pile.length - 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFoundation = (suit, owner) => {
    const key = suit + "_" + owner;
    const pile = state.foundations[key];
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    return (
      <div key={key} className={"foundation-slot foundation-slot--" + SUIT_COLORS[suit]}
        onClick={() => handleFoundationClick(key)}>
        {top ? <Card card={top} small /> : (
          <div className="foundation-slot__empty">{SUIT_SYMBOLS[suit]}</div>
        )}
        <span className="foundation-slot__count">{pile.length}</span>
      </div>
    );
  };

  const renderPileZone = (owner) => {
    const ps = state[owner];
    const isHuman = owner === "human";
    const crapetteTop = ps.crapette.length > 0 ? ps.crapette[ps.crapette.length - 1] : null;
    const discardTop  = ps.discard.length > 0  ? ps.discard[ps.discard.length - 1]   : null;
    const canDiscard  = ps.crapette.length === 0;

    return (
      <div className={"pile-zone pile-zone--" + owner}>
        <div className="pile-zone__item">
          <div className="pile-zone__label">Crapette ({ps.crapette.length})</div>
          {crapetteTop
            ? <Card card={isHuman ? crapetteTop : { ...crapetteTop, faceUp: false }}
                selected={selectedCard?.source === "crapette" && isHuman}
                onClick={isHuman ? handleCrapetteClick : undefined} />
            : <div className="pile-zone__empty">✓</div>}
        </div>
        <div className="pile-zone__item">
          <div className="pile-zone__label">Descarte ({ps.discard.length})</div>
          {discardTop
            ? <div className={!canDiscard && isHuman ? "pile-zone__locked" : ""}>
                <Card card={discardTop}
                  selected={selectedCard?.source === "discard" && isHuman}
                  onClick={isHuman && canDiscard ? handleDiscardClick : undefined} />
              </div>
            : <div className="pile-zone__empty">—</div>}
        </div>
        <div className="pile-zone__item">
          <div className="pile-zone__label">Talon ({ps.talon.length})</div>
          {ps.talon.length > 0
            ? <Card card={{ faceUp: false, id: "talon_" + owner }}
                onClick={isHuman ? flipTalon : undefined} />
            : ps.discard.length > 0
              ? <div className="pile-zone__rebuild" onClick={isHuman ? flipTalon : undefined}>↺</div>
              : <div className="pile-zone__empty">—</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="board">
      <div className="board__title">BANCA RUSA</div>

      {renderPileZone("ai")}

      <div className="board__center">
        <div className="board__houses board__houses--left">
          {state.ai.houses.slice(0, 2).map((pile, i) => renderHouse(pile, i, "ai"))}
          {state.human.houses.slice(0, 2).map((pile, i) => renderHouse(pile, i, "human"))}
        </div>

        <div className="board__foundations">
          {SUITS.map(suit => (
            <div key={suit} className="foundation-row">
              {renderFoundation(suit, "ai")}
              {renderFoundation(suit, "human")}
            </div>
          ))}
        </div>

        <div className="board__houses board__houses--right">
          {state.ai.houses.slice(2, 4).map((pile, i) => renderHouse(pile, i + 2, "ai"))}
          {state.human.houses.slice(2, 4).map((pile, i) => renderHouse(pile, i + 2, "human"))}
        </div>
      </div>

      {renderPileZone("human")}

      <div className="board__status">
        <span className={"board__status-msg board__status-msg--" + state.currentPlayer}>
          {state.statusMessage}
        </span>
        {state.phase === "ai_turn" && (
          <span className="board__stop-hint">Presiona cualquier tecla para Stop</span>
        )}
        {state.stopDeclared && (
          <span className={"board__stop-result board__stop-result--" + (state.stopValid ? "valid" : "invalid")}>
            {state.stopValid ? "Stop valido" : "Stop invalido"} — {state.stopMessage}
          </span>
        )}
        <div className="board__controls">
          <label className="board__ctrl-label">Velocidad IA</label>
          <select className="board__ctrl-select" value={aiSpeed}
            onChange={e => setAiSpeed(Number(e.target.value))}>
            <option value={2500}>Muy lento</option>
            <option value={1500}>Lento</option>
            <option value={1000}>Normal</option>
            <option value={500}>Rapido</option>
            <option value={150}>Muy rapido</option>
          </select>
          <button className="board__btn" onClick={resetGame}>Nueva partida</button>
        </div>
        {state.phase === "game_over" && (
          <div className="board__gameover">
            {state.winner === "human" ? "Ganaste!" : "Gano la IA"}
          </div>
        )}
      </div>
    </div>
  );
}
