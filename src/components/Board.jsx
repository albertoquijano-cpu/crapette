// Board.jsx - Logica simplificada, casas neutrales

import { useState, useCallback } from "react";
import { Card } from "./Card.jsx";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { useStopDetection } from "../hooks/useStopDetection.js";
import { useAI } from "../hooks/useAI.js";
import { canPlayToFoundation } from "../engine/rules.js";
import "../styles/Board.css";

const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLORS  = { spades: "black", hearts: "red", diamonds: "red", clubs: "black" };
const SUITS = ["spades", "hearts", "diamonds", "clubs"];

export function Board({ config }) {
  const {
    state,
    playToFoundation, playToHouse, playToRivalPile, flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);

  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 1000);
  const [selected, setSelected] = useState(null);

  useAI(state.phase, aiSpeed, runAITurn);
  useStopDetection(state.phase, declareStop);

  const isHumanTurn = state.currentPlayer === "human";

  // Seleccionar o deseleccionar carta
  const select = (card, source, houseIndex) => {
    if (!isHumanTurn) return;
    if (selected && selected.card.id === card.id) {
      setSelected(null);
    } else {
      setSelected({ card, source, houseIndex });
    }
  };

  // Mover carta seleccionada al crapette o descarte del rival
  const moveToRivalPile = (pileType, pile) => {
    if (!selected || !isHumanTurn) return;
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const card = selected.card;
    console.log('moveToRivalPile', pileType, 'top:', top?.rank, top?.suit, 'card:', card.rank, card.suit, 'check:', top ? (card.suit === top.suit && (card.value === top.value + 1 || card.value === top.value - 1)) : 'empty pile');
    if (top) {
      if (card.suit === top.suit && (card.value === top.value + 1 || card.value === top.value - 1)) {
        playToRivalPile(card, selected.source, selected.houseIndex, pileType);
        setSelected(null);
      }
    } else {
      playToRivalPile(card, selected.source, selected.houseIndex, pileType);
      setSelected(null);
    }
  };

  // Intentar mover carta seleccionada a casa con indice dado
  const moveToHouse = (targetIndex) => {
    if (!selected || !isHumanTurn) return;
    playToHouse(selected.card, selected.source, selected.houseIndex, targetIndex);
    setSelected(null);
  };

  // Intentar mover carta seleccionada a fundacion
  const moveToFoundation = () => {
    if (!selected || !isHumanTurn) return;
    playToFoundation(selected.card, selected.source, selected.houseIndex);
    setSelected(null);
  };

  // Click en carta de casa — seleccionar o mover seleccionada aqui
  const onHouseCardClick = (card, houseIndex) => {
    if (!isHumanTurn) return;
    if (selected) {
      if (selected.card.id === card.id) {
        setSelected(null);
        return;
      }
      // Intentar mover seleccionada encima de esta carta
      playToHouse(selected.card, selected.source, selected.houseIndex, houseIndex);
      setSelected(null);
    } else {
      select(card, "house", houseIndex);
    }
  };

  // Render de una casa
  const renderHouse = (pile, houseIndex) => {
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isTopSelected = selected && top && selected.card.id === top.id;

    return (
      <div key={houseIndex} className="house-slot"
        onClick={() => !top && moveToHouse(houseIndex)}>
        {pile.length === 0 ? (
          <div className={"house-slot__empty" + (selected ? " house-slot__empty--active" : "")}
            onClick={() => moveToHouse(houseIndex)} />
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
                    onClick={isTop ? () => onHouseCardClick(card, houseIndex) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render de fundacion
  const renderFoundation = (suit, owner) => {
    const key = suit + "_" + owner;
    const pile = state.foundations[key];
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isActive = selected && canPlayToFoundation(selected.card, state.foundations) === key;
    return (
      <div key={key}
        className={"foundation-slot foundation-slot--" + SUIT_COLORS[suit] + (isActive ? " foundation-slot--active" : "")}
        onClick={moveToFoundation}>
        {top
          ? <Card card={top} small />
          : <div className="foundation-slot__empty">{SUIT_SYMBOLS[suit]}</div>}
        <span className="foundation-slot__count">{pile.length}</span>
      </div>
    );
  };

  // Render zona de pilas
  const renderPileZone = (owner) => {
    const ps = state[owner];
    const isHuman = owner === "human";
    const crapetteTop = ps.crapette.length > 0 ? ps.crapette[ps.crapette.length - 1] : null;
    const discardTop  = ps.discard.length > 0  ? ps.discard[ps.discard.length - 1]   : null;
    const canUseDiscard = ps.crapette.length === 0;

    return (
      <div className={"pile-zone pile-zone--" + owner}>
        {/* Talon */}
        <div className="pile-zone__item">
          <div className="pile-zone__label">Talon ({ps.talon.length})</div>
          {ps.flippedCard ? (
            <div className="pile-zone__flipped">
              <Card card={ps.flippedCard}
                selected={selected?.source === "flipped" && isHuman}
                onClick={isHuman ? () => select(ps.flippedCard, "flipped", null) : undefined} />
              {isHuman && (
                <div className="pile-zone__rebuild-small" onClick={discardFlipped}>
                  ↺ descartar
                </div>
              )}
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
          onClick={!isHuman && selected ? () => moveToRivalPile("discard", ps.discard) : undefined}>
          <div className="pile-zone__label">Descarte ({ps.discard.length})</div>
          {discardTop ? (
            <div className={!canUseDiscard && isHuman ? "pile-zone__locked" : ""}>
              <Card card={discardTop}
                selected={selected?.source === "discard" && isHuman}
                onClick={isHuman && canUseDiscard
                  ? () => select(discardTop, "discard", null)
                  : undefined} />
            </div>
          ) : (
            <div className={"pile-zone__empty" + (!isHuman && selected ? " pile-zone__empty--active" : "")}>—</div>
          )}
        </div>

        {/* Crapette */}
        <div className="pile-zone__item"
          onClick={!isHuman && selected ? () => moveToRivalPile("crapette", ps.crapette) : undefined}>
          <div className="pile-zone__label">Crapette ({ps.crapette.length})</div>
          {crapetteTop ? (
            <Card card={{ ...crapetteTop, faceUp: true }}
              selected={selected?.source === "crapette" && isHuman}
              onClick={isHuman
                ? () => select(crapetteTop, "crapette", null)
                : selected ? () => moveToRivalPile("crapette", ps.crapette) : undefined} />
          ) : (
            <div className={"pile-zone__empty" + (!isHuman && selected ? " pile-zone__empty--active" : "")}
              onClick={!isHuman && selected ? () => moveToRivalPile("crapette", ps.crapette) : undefined}>✓</div>
          )}
        </div>
      </div>
    );
  };

  // Indice global: human.houses = 0-3, ai.houses = 4-7
  const allHouses = [
    ...state.human.houses.map((pile, i) => ({ pile, index: i })),
    ...state.ai.houses.map((pile, i) => ({ pile, index: i + 4 })),
  ];

  return (
    <div className="board">
      <div className="board__title">BANCA RUSA</div>
      {renderPileZone("ai")}
      <div className="board__center">
        <div className="board__houses board__houses--left">
          {allHouses.slice(4, 8).map(({ pile, index }) => renderHouse(pile, index))}
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
          {allHouses.slice(0, 4).map(({ pile, index }) => renderHouse(pile, index))}
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
