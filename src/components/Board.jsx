// Board.jsx - Sistema click-to-select universal (Safari + Mobile compatible)

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
    playToFoundation, playToHouse, flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);

  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 1000);
  const [selected, setSelected] = useState(null); // { card, source, houseIndex }

  useAI(state.phase, aiSpeed, runAITurn);
  useStopDetection(state.phase, declareStop);

  const isHumanTurn = state.currentPlayer === "human";

  // Seleccionar carta
  const selectCard = useCallback((card, source, houseIndex) => {
    if (!isHumanTurn) return;
    // Si ya hay seleccionada, deseleccionar
    if (selected && selected.card.id === card.id) {
      setSelected(null);
      return;
    }
    setSelected({ card, source, houseIndex });
  }, [isHumanTurn, selected]);





  // Click en casa vacia
  const handleEmptyHouseClick = useCallback((houseIndex, owner) => {
    if (!selected) return;
    if (owner === "ai") return; // No se puede dejar carta en casa vacia de la IA
    playToHouse(selected.card, selected.source, selected.houseIndex, houseIndex);
    setSelected(null);
  }, [selected, playToHouse]);

  // Click en Crapette
  const handleCrapetteClick = useCallback(() => {
    if (!isHumanTurn) return;
    const top = state.human.crapette[state.human.crapette.length - 1];
    if (!top) return;
    if (selected) { setSelected(null); return; }
    selectCard(top, "crapette", null);
  }, [isHumanTurn, state.human.crapette, selected, selectCard]);

  // Click en Descarte propio
  const handleDiscardClick = useCallback(() => {
    if (!isHumanTurn || state.human.crapette.length > 0) return;
    const top = state.human.discard[state.human.discard.length - 1];
    if (!top) return;
    if (selected) { setSelected(null); return; }
    selectCard(top, "discard", null);
  }, [isHumanTurn, state.human, selected, selectCard]);

  // Click en carta volteada del talon
  const handleFlippedClick = useCallback(() => {
    if (!isHumanTurn) return;
    const card = state.human.flippedCard;
    if (!card) return;
    if (selected) { setSelected(null); return; }
    selectCard(card, "flipped", null);
  }, [isHumanTurn, state.human.flippedCard, selected, selectCard]);

  // Renders
  const handleCardClick = (card, source, houseIndex) => {
    if (!isHumanTurn) return;

    // Si la carta ya esta seleccionada — deseleccionar
    if (selected && selected.card.id === card.id) {
      setSelected(null);
      return;
    }

    // Si hay carta seleccionada y click en casa destino — mover
    if (selected && (source === "house" || source === "rival_house")) {
      // Las casas son neutrales — cualquiera puede poner cartas ahi
      playToHouse(selected.card, selected.source, selected.houseIndex, houseIndex);
      setSelected(null);
      return;
    }

    // Seleccionar esta carta
    setSelected({ card, source, houseIndex });
  };

  const renderHouse = (pile, houseIndex, owner) => {
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isHumanOwner = owner === "human";
    const isTopSelected = selected && top && selected.card.id === top.id;

    return (
      <div key={owner + houseIndex} className="house-slot"
        onClick={!top && isHumanOwner ? () => handleEmptyHouseClick(houseIndex) : undefined}>
        {pile.length === 0 ? (
          <div className={"house-slot__empty" + (selected ? " house-slot__empty--active" : "")}
            onClick={() => selected && handleEmptyHouseClick(houseIndex, owner)} />
        ) : (
          <div className="house-slot__stack">
            {pile.map((card, ci) => {
              const isTop = ci === pile.length - 1;
              return (
                <div key={card.id} className="house-slot__card"
                  style={{ left: ci * 18 + "px" }}>
                  <Card
                    card={card}
                    selected={isTopSelected && isTop}
                    onClick={isTop ? () => handleCardClick(card, isHumanOwner ? "house" : "rival_house", houseIndex) : undefined}
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
    const isActive = selected && canPlayToFoundation(selected.card, state.foundations) === key;
    return (
      <div key={key}
        className={"foundation-slot foundation-slot--" + SUIT_COLORS[suit] + (isActive ? " foundation-slot--active" : "")}
        onClick={() => {
          if (!selected) return;
          const fKey = canPlayToFoundation(selected.card, state.foundations);
          if (fKey) {
            playToFoundation(selected.card, selected.source, selected.houseIndex);
            setSelected(null);
          }
        }}>
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
              <Card card={ps.flippedCard}
                selected={selected?.source === "flipped"}
                onClick={isHuman ? handleFlippedClick : undefined} />
              {isHuman && <div className="pile-zone__flipped-hint">Jugar o click Talon↺</div>}
            </div>
          ) : ps.talon.length > 0 ? (
            <Card card={{ faceUp: false, id: "talon_" + owner }}
              onClick={isHuman ? flipTalon : undefined} />
          ) : ps.discard.length > 0 ? (
            <div className="pile-zone__rebuild"
              onClick={isHuman ? flipTalon : undefined}>↺</div>
          ) : (
            <div className="pile-zone__empty">—</div>
          )}
          {ps.flippedCard && isHuman && (
            <div className="pile-zone__rebuild-small"
              onClick={discardFlipped}>↺ descartar</div>
          )}
        </div>

        {/* Descarte */}
        <div className="pile-zone__item"
          onClick={!isHuman && selected ? () => {
            const top = ps.discard[ps.discard.length - 1];
            if (top && selected.card.suit === top.suit && selected.card.value === top.value + 1) {
              playToHouse(selected.card, selected.source, selected.houseIndex, "rival_discard");
              setSelected(null);
            }
          } : undefined}>
          <div className="pile-zone__label">Descarte ({ps.discard.length})</div>
          {discardTop ? (
            <div className={!canDiscard && isHuman ? "pile-zone__locked" : ""}>
              <Card card={discardTop}
                selected={selected?.source === "discard" && isHuman}
                onClick={isHuman && canDiscard ? handleDiscardClick : undefined} />
            </div>
          ) : (
            <div className="pile-zone__empty">—</div>
          )}
        </div>

        {/* Crapette */}
        <div className="pile-zone__item">
          <div className="pile-zone__label">Crapette ({ps.crapette.length})</div>
          {crapetteTop ? (
            <Card card={crapetteTop}
              selected={selected?.source === "crapette" && isHuman}
              onClick={isHuman ? handleCrapetteClick : undefined} />
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
          {state.ai.houses.map((pile, i) => renderHouse(pile, i, "ai"))}
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
          {state.human.houses.map((pile, i) => renderHouse(pile, i, "human"))}
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
