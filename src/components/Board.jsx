// Board.jsx - Con drag and drop completo

import { useState, useCallback, useRef } from "react";
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
    playToFoundation, playToHouse, flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);

  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 1000);
  const dragRef = useRef(null);

  useAI(state.phase, aiSpeed, runAITurn);
  useStopDetection(state.phase, declareStop);

  const isHumanTurn = state.currentPlayer === "human";

  // ─── Drag handlers ───────────────────────────────────────────────────────

  const handleDragStart = useCallback((e, card, source, houseIndex) => {
    dragRef.current = { card, source, houseIndex };
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropToFoundation = useCallback((e, foundationKey) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const { card, source, houseIndex } = dragRef.current;
    const fKey = canPlayToFoundation(card, state.foundations);
    if (fKey === foundationKey) {
      playToFoundation(card, source, houseIndex);
    }
    dragRef.current = null;
  }, [state.foundations, playToFoundation]);

  const handleDropToHouse = useCallback((e, targetIndex) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const { card, source, houseIndex } = dragRef.current;
    playToHouse(card, source, houseIndex, targetIndex);
    dragRef.current = null;
  }, [playToHouse]);

  const handleDropToDiscard = useCallback((e) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const { card } = dragRef.current;
    if (card.id === state.human.flippedCard?.id) {
      discardFlipped();
    }
    dragRef.current = null;
  }, [state.human.flippedCard, discardFlipped]);

  // Click en carta — jugar directo a fundacion si es posible
  const handleCardClick = useCallback((card, source, houseIndex) => {
    if (!isHumanTurn) return;
    const fKey = canPlayToFoundation(card, state.foundations);
    if (fKey) {
      playToFoundation(card, source, houseIndex);
    }
  }, [isHumanTurn, state.foundations, playToFoundation]);

  // ─── Renders ─────────────────────────────────────────────────────────────

  const renderHouse = (pile, houseIndex, owner) => {
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isHumanOwner = owner === "human";
    return (
      <div key={houseIndex} className="house-slot"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDropToHouse(e, houseIndex)}>
        {pile.length === 0 ? (
          <div className="house-slot__empty" />
        ) : (
          <div className="house-slot__stack">
            {pile.map((card, ci) => {
              const isTop = ci === pile.length - 1;
              return (
                <div key={card.id} className="house-slot__card" style={{ top: ci * 20 + "px" }}>
                  <Card
                    card={card}
                    draggable={isTop && isHumanOwner}
                    onDragStart={isTop && isHumanOwner
                      ? (e) => handleDragStart(e, card, "house", houseIndex)
                      : undefined}
                    onClick={isTop && isHumanOwner
                      ? () => handleCardClick(card, "house", houseIndex)
                      : undefined}
                  />
                </div>
              );
            })}
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
        onDragOver={handleDragOver}
        onDrop={(e) => handleDropToFoundation(e, key)}>
        {top
          ? <Card card={top} small />
          : <div className="foundation-slot__empty">{SUIT_SYMBOLS[suit]}</div>}
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
        {/* Talon */}
        <div className="pile-zone__item">
          <div className="pile-zone__label">Talon ({ps.talon.length})</div>
          {ps.flippedCard ? (
            <div className="pile-zone__flipped">
              <Card
                card={ps.flippedCard}
                draggable={isHuman}
                onDragStart={isHuman ? (e) => handleDragStart(e, ps.flippedCard, "flipped", null) : undefined}
                onClick={isHuman ? discardFlipped : undefined}
              />
              {isHuman && <div className="pile-zone__flipped-hint">Arrastra o click para descartar</div>}
            </div>
          ) : ps.talon.length > 0 ? (
            <Card card={{ faceUp: false, id: "talon_" + owner }}
              onClick={isHuman ? flipTalon : undefined} />
          ) : ps.discard.length > 0 ? (
            <div className="pile-zone__rebuild" onClick={isHuman ? flipTalon : undefined}>↺</div>
          ) : (
            <div className="pile-zone__empty">—</div>
          )}
        </div>

        {/* Descarte */}
        <div className="pile-zone__item"
          onDragOver={isHuman ? handleDragOver : undefined}
          onDrop={isHuman ? (e) => handleDropToDiscard(e) : undefined}>
          <div className="pile-zone__label">Descarte ({ps.discard.length})</div>
          {discardTop ? (
            <div className={!canDiscard && isHuman ? "pile-zone__locked" : ""}>
              <Card
                card={discardTop}
                draggable={isHuman && canDiscard}
                onDragStart={isHuman && canDiscard
                  ? (e) => handleDragStart(e, discardTop, "discard", null)
                  : undefined}
                onClick={isHuman && canDiscard
                  ? () => handleCardClick(discardTop, "discard", null)
                  : undefined}
              />
            </div>
          ) : (
            <div className="pile-zone__empty"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToDiscard(e)}>—</div>
          )}
        </div>

        {/* Crapette */}
        <div className="pile-zone__item">
          <div className="pile-zone__label">Crapette ({ps.crapette.length})</div>
          {crapetteTop ? (
            <Card
              card={isHuman ? crapetteTop : { ...crapetteTop, faceUp: false }}
              draggable={isHuman}
              onDragStart={isHuman ? (e) => handleDragStart(e, crapetteTop, "crapette", null) : undefined}
              onClick={isHuman ? () => handleCardClick(crapetteTop, "crapette", null) : undefined}
            />
          ) : (
            <div className="pile-zone__empty">✓</div>
          )}
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
