// Board.jsx - Logica simplificada, casas neutrales

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "./Card.jsx";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { GAME_PHASES } from "../engine/gameState.js";
import { useStopDetection } from "../hooks/useStopDetection.js";
import { useAI } from "../hooks/useAI.js";
import { canPlayToFoundation, hasObligatoryMoves, getMandatoryMoves, isMoveContributingToObligation } from "../engine/rules.js";
import "../styles/Board.css";

const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLORS  = { spades: "black", hearts: "red", diamonds: "red", clubs: "black" };
const SUITS = ["spades", "hearts", "diamonds", "clubs"];

// Componente carta voladora — vuela de fromRect a toRect
function FlyingCard({ card, fromRect, toRect }) {
  const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
  const isRed = card.color === "red";
  const symbol = SUIT_SYMBOLS[card.suit] || "";
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top  - fromRect.top;

  return (
    <div style={{
      position: "fixed",
      left: fromRect.left + "px",
      top:  fromRect.top  + "px",
      width: "70px",
      height: "100px",
      zIndex: 9999,
      pointerEvents: "none",
      animation: "flyCard 0.45s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
      "--fly-dx": dx + "px",
      "--fly-dy": dy + "px",
    }}>
      <div style={{
        width: "70px", height: "100px",
        borderRadius: "7px",
        border: "1.5px solid rgba(0,0,0,0.2)",
        background: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.8em",
        color: isRed ? "#c0392b" : "#1a1a1a",
        boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
        fontFamily: "Crimson Text, Georgia, serif",
      }}>
        {card.rank}{symbol}
      </div>
    </div>
  );
}

export function Board({ config }) {
  const {
    state, announcedMove, flyingCard: flyingCardMove,
    playToFoundation, playToHouse, playToRivalPile, flipTalon, discardFlipped,
    runAITurn, declareStop, triggerAutoStop, resetGame,
  } = useGameLoop(config);

  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 3000);
  const [flyingCard, setFlyingCard] = useState(null); // { card, fromRect, toSlot }
  const prevAnnouncedRef = useRef(null);
  const [showStop, setShowStop] = useState(false);
  const [stopTriggered, setStopTriggered] = useState(false);
  const [selected, setSelected] = useState(null);

  useAI(state.phase, aiSpeed, runAITurn);

  // Ref para guardar fromRect cuando announcedMove se SETEA (antes de que el DOM cambie)
  const flyFromRectRef = useRef(null);

  // Detectar cuando announcedMove se SETEA → capturar posicion origen
  useEffect(() => {
    if (announcedMove) {
      // Carta anunciada — capturar posicion origen ahora (antes de que se mueva)
      const sourceSlot = announcedMove.source === "crapette" ? "crapette-ai"
        : announcedMove.source === "flipped" ? "flipped-ai"
        : announcedMove.source === "house" ? "house-" + announcedMove.houseIndex
        : null;
      if (sourceSlot) {
        const fromEl = document.querySelector('[data-slot="' + sourceSlot + '"]');
        if (fromEl) flyFromRectRef.current = fromEl.getBoundingClientRect();
      }
    }
  }, [announcedMove]);

  // Detectar cuando announcedMove se limpia → iniciar vuelo con fromRect guardado
  useEffect(() => {
    const prev = prevAnnouncedRef.current;
    prevAnnouncedRef.current = announcedMove;

    if (prev && !announcedMove && flyFromRectRef.current) {
      const targetSlot = prev.type === "foundation" ? "foundation-" + prev.target
        : prev.type === "rival_crapette" ? "crapette-human"
        : prev.type === "rival_discard" ? "discard-human"
        : prev.type === "house" ? "house-" + prev.target
        : null;

      if (targetSlot) {
        const toEl = document.querySelector('[data-slot="' + targetSlot + '"]');
        if (toEl) {
          const toRect = toEl.getBoundingClientRect();
          setFlyingCard({ card: prev.card, fromRect: flyFromRectRef.current, toRect });
          flyFromRectRef.current = null;
          setTimeout(() => setFlyingCard(null), 500);
        }
      }
    }
  }, [announcedMove]);
  useStopDetection(state.phase, declareStop);

  // Mostrar STOP cuando stopValid se activa
  const prevStopRef = React.useRef(false);
  React.useEffect(() => {
    if (state.stopValid && !prevStopRef.current) {
      setShowStop(true);
      setTimeout(() => setShowStop(false), 2500);
    }
    prevStopRef.current = state.stopValid || false;
  }, [state.stopValid]);

  // showStop se activa desde select() cuando el humano toca carta incorrecta

  const isHumanTurn = state.currentPlayer === "human";

  // Slot destino iluminado cuando la IA anuncia su jugada
  const highlightedSlot = announcedMove ? (
    announcedMove.type === "foundation" ? "foundation-" + announcedMove.target
    : announcedMove.type === "rival_crapette" ? "crapette-human"
    : announcedMove.type === "rival_discard" ? "discard-human"
    : announcedMove.type === "house" ? "house-" + announcedMove.target
    : null
  ) : null;

  // Detectar si una carta es la que la IA acaba de "levantar" (paso 1 animacion)
  const isLifted = (card, source, houseIndex) => {
    if (!announcedMove) return false;
    if (announcedMove.card.id !== card.id) return false;
    if (source && announcedMove.source !== source) return false;
    return true;
  };

  // Verificar si hay jugadas obligatorias y la carta seleccionada no es una de ellas
  const checkStopOnSelect = (card, source) => {
    // Calcular jugadas obligatorias en tiempo real para no depender del estado guardado
    const allHouses = [...state.human.houses, ...state.ai.houses];
    const canUseCrapette = !state.crapetteUsedThisTurn;
    const mandatory = getMandatoryMoves(state.human, allHouses, state.foundations, canUseCrapette);
    if (!mandatory || mandatory.length === 0) return false;

    // Si hay obligatoria de fundacion y esta carta no es la obligatoria
    const foundationObligation = mandatory.find(m => m.type === "foundation");
    if (foundationObligation) {
      const isSameCard = mandatory.some(m => m.type === "foundation" && m.card.id === card.id);
      if (!isSameCard) return true;
    }

    // Si hay obligatoria de llenar casa vacia y no viene del crapette
    const fillObligation = mandatory.find(m => m.type === "fill_empty_casa");
    if (fillObligation && source !== "crapette") return true;

    return false;
  };

  // Seleccionar o deseleccionar carta
  const select = (card, source, houseIndex) => {
    if (!isHumanTurn) return;
    // Si hay jugada obligatoria y esta carta no es la obligatoria:
    // la IA declara stop automatico — el humano pierde el turno
    if (checkStopOnSelect(card, source)) {
      // Stop automatico: humano toco carta incorrecta con jugada obligatoria pendiente
      // La IA declara stop — el humano pierde el turno
      triggerAutoStop();
      setSelected(null);
      return;
    }
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
  const renderHouse = (pile, houseIndex, reverse = false) => {
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isTopSelected = selected && top && selected.card.id === top.id;
    const cardWidth = 18;
    const totalWidth = Math.max(70, (pile.length - 1) * cardWidth + 70);

    const stackWidth = Math.max(70, (pile.length - 1) * cardWidth + 70);

    const isHighlighted = highlightedSlot === "house-" + houseIndex;
    return (
      <div key={houseIndex} className={"house-slot" + (isHighlighted ? " house-slot--highlighted" : "")}
        data-slot={"house-" + houseIndex}
        style={{ width: stackWidth + "px" }}
        onClick={() => !top && moveToHouse(houseIndex)}>
        {pile.length === 0 ? (
          <div className={"house-slot__empty" + (selected ? " house-slot__empty--active" : "")}
            onClick={() => moveToHouse(houseIndex)} />
        ) : (
          <div className="house-slot__stack" style={{ width: stackWidth + "px", position: "relative" }}>
            {pile.map((card, ci) => {
              const isTop = ci === pile.length - 1;
              // Normal (derecha): base a la izquierda, nuevas van a la derecha
              // Reverse (izquierda): base a la derecha (stackWidth-70), nuevas van a la izquierda
              // Normal: base izquierda, nuevas van a la derecha → left = ci * cardWidth
              // Reverse: base derecha FIJA, nuevas van a la izquierda → left = (maxCards-1-ci) * cardWidth
              const maxOffset = (pile.length - 1) * cardWidth;
              const left = reverse
                ? maxOffset - ci * cardWidth
                : ci * cardWidth;
              return (
                <div key={card.id} className="house-slot__card"
                  style={{ left: left + "px", zIndex: ci + 1 }}>
                  <Card
                    card={card}
                    selected={isTopSelected && isTop}
                    lifted={isTop && isLifted(card, "house", houseIndex)}
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
    const isFoundationHighlighted = highlightedSlot === "foundation-" + key;
    return (
      <div key={key}
        data-slot={"foundation-" + key}
        className={"foundation-slot foundation-slot--" + SUIT_COLORS[suit] + (isFoundationHighlighted ? " foundation-slot--highlighted" : "")}
        onClick={moveToFoundation}>
        {top
          ? <Card card={top} />
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
            <div className="pile-zone__flipped" data-slot={"flipped-" + owner}>
              <Card card={ps.flippedCard}
                selected={selected?.source === "flipped" && isHuman}
                lifted={!isHuman && isLifted(ps.flippedCard, "flipped")}
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
          data-slot={"discard-" + owner}
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
        <div className={"pile-zone__item" + (isHuman && state.crapetteUsedThisTurn ? " pile-zone__locked" : "") + (!isHuman && highlightedSlot === "crapette-human" ? " pile-zone__item--highlighted" : "")}
          data-slot={"crapette-" + owner}
          onClick={!isHuman && selected ? () => moveToRivalPile("crapette", ps.crapette) : undefined}>
          <div className="pile-zone__label">Crapette ({ps.crapette.length})</div>
          {crapetteTop ? (
            <Card card={{ ...crapetteTop, faceUp: true }}
              selected={selected?.source === "crapette" && isHuman}
              lifted={!isHuman && isLifted(crapetteTop, "crapette")}
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
          {allHouses.slice(4, 8).reverse().map(({ pile, index }) => renderHouse(pile, index, true))}
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
      {/* Indicador de turno fijo a la derecha */}
      <div className="board__turn-indicator">
        <div className={"board__turn-badge" + (state.currentPlayer === "ai" ? " board__turn-badge--ai" : "")}>
          {state.currentPlayer === "human" ? "Tu turno" : "IA jugando"}
        </div>
        {state.phase === "ai_turn" && (
          <div style={{fontSize:"0.65em", color:"rgba(255,255,255,0.5)", textAlign:"center", fontFamily:"Cinzel,serif"}}>
            Presiona tecla = Stop
          </div>
        )}
        {state.stopDeclared && (
          <div className="board__stop-badge">STOP!</div>
        )}
        {/* Carta voladora de la IA */}
      {flyingCard && (
        <FlyingCard card={flyingCard.card} fromRect={flyingCard.fromRect} toRect={flyingCard.toRect} />
      )}

      {state.phase === "game_over" && (
          <div className="board__turn-badge" style={{color:"#f5d070", borderColor:"#f5d070"}}>
            {state.winner === "human" ? "Ganaste!" : "Gano la IA"}
          </div>
        )}
      </div>

      {/* STOP explosivo */}
      {showStop && (
        <div className="board__stop-explosion">
          <div className="board__stop-comic">
            <span>¡STOP!</span>
          </div>
        </div>
      )}



      <div className="board__status">
        <span className={"board__status-msg board__status-msg--" + state.currentPlayer}>
          {state.statusMessage}
        </span>

        {/* Stop feedback */}
        {state.stopMessage && (
          <div className={"board__stop-feedback board__stop-feedback--" + (state.stopValid ? "valid" : "invalid")}>
            {state.stopMessage}
          </div>
        )}

        <div className="board__controls-row">
          {/* Boton Stop */}
          {(state.phase === "ai_turn" || state.phase === "ai_crapette" || state.phase === "ai_talon") && (
            <button className="board__btn board__btn--stop" onClick={declareStop}>
              ✋ STOP
            </button>
          )}

          <div className="board__controls">
            <label className="board__ctrl-label">Velocidad IA</label>
            <select className="board__ctrl-select" value={aiSpeed}
              onChange={e => setAiSpeed(Number(e.target.value))}>
              <option value={8000}>Muy lento</option>
              <option value={5000}>Lento</option>
              <option value={3000}>Normal</option>
              <option value={1500}>Rapido</option>
              <option value={500}>Muy rapido</option>
            </select>
            <button className="board__btn" onClick={resetGame}>Nueva partida</button>
          </div>
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
