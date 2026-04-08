// Board.jsx - Tablero con casas compartidas del tablero

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "./Card.jsx";
import { useGameLoop } from "../hooks/useGameLoop.js";
import { useStopDetection } from "../hooks/useStopDetection.js";
import { useAI } from "../hooks/useAI.js";
import { canPlayToFoundation, getMandatoryMoves, canPlayToRivalCrapette, canPlayToRivalDiscard } from "../engine/rules.js";
import { GAME_PHASES, topCard } from "../engine/gameState.js";
import { PILES, HOUSE_PILES, SUIT_FOUNDATIONS } from "../engine/deck.js";
import "../styles/Board.css";

// ── Adaptador: convierte estado nuevo (pilas numeradas) al formato que espera este Board ──
const SUIT_MAP = { P: 'spades', C: 'hearts', D: 'diamonds', T: 'clubs' };
const SUIT_MAP_REV = { spades: 'P', hearts: 'C', diamonds: 'D', clubs: 'T' };
const RANK_MAP_REV = { A: 1, J: 11, Q: 12, K: 13 };

// Convierte carta adaptada (suits en ingles, rank string) de vuelta al formato del engine
function unadaptCard(c) {
  if (!c) return null;
  const suit = SUIT_MAP_REV[c.suit] || c.suit;
  const rank = typeof c.rank === 'string'
    ? (RANK_MAP_REV[c.rank] || parseInt(c.rank))
    : c.rank;
  return { ...c, suit, rank };
}

const RANK_MAP = { 1:'A', 11:'J', 12:'Q', 13:'K' };

function adaptCard(c) {
  if (!c) return null;
  const suit = SUIT_MAP[c.suit] || c.suit;
  // Convertir rank numerico (1-13) a string que espera el Board viejo
  const rank = typeof c.rank === 'number'
    ? (RANK_MAP[c.rank] || String(c.rank))
    : c.rank;
  return {
    ...c,
    suit,
    rank,
    value: typeof c.rank === 'number' ? c.rank : c.value,
    color: ['hearts','diamonds'].includes(suit) ? 'red' : 'black',
    faceUp: c.faceUp ?? false,
    id: c.id || (rank + suit[0].toUpperCase()),
  };
}

function adaptPile(arr) {
  return (arr || []).map(adaptCard);
}

function adaptPlayer(p) {
  if (!p) return p;
  return {
    ...p,
    crapette: adaptPile(p.crapette),
    talon:    adaptPile(p.talon),
    discard:  adaptPile(p.discard),
    flippedCard: adaptCard(p.flipped ?? p.flippedCard ?? null),
  };
}

function adaptState(s) {
  if (!s || !s.houses) return s;
  // houses: objeto {1:[],..8:[]} → array de 8 elementos
  const housesArr = HOUSE_PILES.map(id => adaptPile(s.houses[id] || []));
  // foundations: {9:[],10:[],...} → {spades_human:[], spades_ai:[], ...}
  const foundations = {};
  Object.entries(SUIT_FOUNDATIONS).forEach(([suit, [idA, idB]]) => {
    const suitName = SUIT_MAP[suit];
    foundations[suitName + '_human'] = adaptPile(s.foundations[idA] || []);
    foundations[suitName + '_ai']    = adaptPile(s.foundations[idB] || []);
  });
  return {
    ...s,
    houses:      housesArr,
    foundations,
    human:       adaptPlayer(s.human),
    ai:          adaptPlayer(s.ai),
    crapetteUsedThisTurn: s.crapetteUsedThisTurn ?? false,
  };
}

const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLORS  = { spades: "black", hearts: "red", diamonds: "red", clubs: "black" };
const SUITS = ["spades", "hearts", "diamonds", "clubs"];

export function Board({ config, onReset, onDashboard, onExit }) {
  const {
    state: rawState, announcedMove, flyingCard: flyingCardMove, triggerAutoStop,
    playToFoundation, playToHouse, playToRivalPile, flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);
  const state = adaptState(rawState);

  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 3000);
  const [showStop, setShowStop] = useState(false);
  const [selected, setSelected] = useState(null);
  const flyFromRectRef = useRef(null);
  const [flyingCard, setFlyingCard] = useState(null);

  useAI(state.phase, aiSpeed, runAITurn, state.aiLevel);
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

  // Capturar posicion origen cuando IA anuncia jugada
  useEffect(() => {
    if (announcedMove) {
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

  // Animar vuelo cuando flyingCardMove se setea
  useEffect(() => {
    if (!flyingCardMove || !flyFromRectRef.current) return;
    const targetSlot = flyingCardMove.type === "foundation" ? "foundation-" + flyingCardMove.target
      : flyingCardMove.type === "rival_crapette" ? "crapette-human"
      : flyingCardMove.type === "rival_discard" ? "discard-human"
      : flyingCardMove.type === "house" ? "house-" + flyingCardMove.target
      : null;
    if (!targetSlot) return;
    const toEl = document.querySelector('[data-slot="' + targetSlot + '"]');
    if (!toEl) return;
    const toRect = toEl.getBoundingClientRect();
    setFlyingCard({ card: flyingCardMove.card, fromRect: flyFromRectRef.current, toRect });
    flyFromRectRef.current = null;
    setTimeout(() => setFlyingCard(null), 650);
  }, [flyingCardMove]);

  const isHumanTurn = state.currentPlayer === "human";

  // Slot destino iluminado cuando IA anuncia jugada
  const highlightedSlot = announcedMove ? (
    announcedMove.type === "foundation" && announcedMove.target ? "foundation-" + announcedMove.target
    : announcedMove.type === "rival_crapette" ? "crapette-human"
    : announcedMove.type === "rival_discard" ? "discard-human"
    : announcedMove.type === "house" && announcedMove.target !== undefined ? "house-" + announcedMove.target
    : null
  ) : null;

  // Detectar si carta esta levantada (anunciada por IA)
  const isLifted = (card, source, houseIndex) => {
    if (!announcedMove) return false;
    if (announcedMove.card.id !== card.id) return false;
    if (source && announcedMove.source !== source) return false;
    return true;
  };

  // Verificar jugada obligatoria en tiempo real
  const checkStopOnSelect = (card, source) => {
    const canUseCrapette = !state.crapetteUsedThisTurn;
    const mandatory = getMandatoryMoves(rawState.human, rawState.houses, rawState.foundations, rawState.aiLevel, true);
    if (!mandatory || mandatory.length === 0) return false;

    // Verificar si la carta seleccionada cumple ALGUNA jugada obligatoria
    // Convertir card a formato del engine para comparar con mandatory
    const rawCard = unadaptCard(card);
    const isFoundationMove = mandatory.some(m =>
      m.type === "foundation" && m.card &&
      m.card.rank === rawCard.rank && m.card.suit === rawCard.suit
    );
    const isFillMove = mandatory.some(m =>
      m.type === "fill_empty_casa" &&
      (source === "crapette" || source === "flipped" || source === "house")
    );

    // En Crapette el jugador puede seleccionar cualquier carta libremente
    // El stop solo aplica al PASAR el turno, no al seleccionar
    return false;
  };

  // Seleccionar carta
  const select = (card, source, houseIndex) => {
    if (!isHumanTurn) return;
    // Crapette bloqueado si ya se volteo el talon este turno
    if (source === "crapette" && state.crapetteUsedThisTurn) {
      return;
    }
    if (checkStopOnSelect(card, source)) {
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

  // Mover carta al rival
  const moveToRivalPile = (pileType, pile) => {
    if (!selected || !isHumanTurn) return;
    const card = selected.card;
    // Usar unadaptCard para que el engine reciba suits en formato P/C/D/T
    const rawCard = unadaptCard(card);
    const rawPile = pile.map(unadaptCard);
    const canPlay = pileType === "crapette"
      ? canPlayToRivalCrapette(rawCard, rawPile)
      : canPlayToRivalDiscard(rawCard, rawPile);
    if (canPlay) {
      playToRivalPile(unadaptCard(card), selected.source, selected.houseIndex, pileType);
      setSelected(null);
    }
  };

  // Mover carta a casa
  const moveToHouse = (targetIndex) => {
    if (!selected || !isHumanTurn) return;
    playToHouse(unadaptCard(selected.card), selected.source, selected.houseIndex, targetIndex);
    setSelected(null);
  };

  // Mover carta a fundacion
  const moveToFoundation = () => {
    if (!selected || !isHumanTurn) return;
    playToFoundation(unadaptCard(selected.card), selected.source, selected.houseIndex);
    setSelected(null);
  };

  // Click en carta de casa
  const onHouseCardClick = (card, houseIndex) => {
    if (!isHumanTurn) return;
    if (selected) {
      if (selected.card.id === card.id) { setSelected(null); return; }
      playToHouse(unadaptCard(selected.card), selected.source, selected.houseIndex, houseIndex);
      setSelected(null);
    } else {
      select(card, "house", houseIndex);
    }
  };

  // Render casa
  const renderHouse = (pile, houseIndex, reverse = false) => {
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isTopSelected = selected && top && selected.card.id === top.id;
    const cardWidth = 18;
    const stackWidth = Math.max(70, (pile.length - 1) * cardWidth + 70);
    const isHighlighted = highlightedSlot === "house-" + houseIndex;

    return (
      <div key={houseIndex}
        data-slot={"house-" + houseIndex}
        className={"house-slot" + (isHighlighted ? " house-slot--highlighted" : "")}
        style={{ width: stackWidth + "px" }}
        onClick={() => !top && moveToHouse(houseIndex)}>
        {pile.length === 0 ? (
          <div className={"house-slot__empty" + (selected ? " house-slot__empty--active" : "")}
            onClick={() => moveToHouse(houseIndex)} />
        ) : (
          <div className="house-slot__stack" style={{ width: stackWidth + "px", position: "relative" }}>
            {pile.map((card, ci) => {
              const isTop = ci === pile.length - 1;
              const maxOffset = (pile.length - 1) * cardWidth;
              const left = reverse ? maxOffset - ci * cardWidth : ci * cardWidth;
              return (
                <div key={card.id} className="house-slot__card" style={{ left: left + "px", zIndex: ci + 1 }}>
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

  // Render fundacion
  const renderFoundation = (suit, owner) => {
    const key = suit + "_" + owner;
    const pile = state.foundations[key];
    const top = pile.length > 0 ? pile[pile.length - 1] : null;
    const isHighlighted = highlightedSlot === "foundation-" + key;
    return (
      <div key={key}
        data-slot={"foundation-" + key}
        className={"foundation-slot foundation-slot--" + SUIT_COLORS[suit] + (isHighlighted ? " foundation-slot--highlighted" : "")}
        onClick={moveToFoundation}>
        {top
          ? <Card card={top} />
          : <div className="foundation-slot__empty">{SUIT_SYMBOLS[suit]}</div>}
        <span className="foundation-slot__count">{pile.length}</span>
      </div>
    );
  };

  // Render zona de pilas (crapette, descarte, talon)
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
                <div className="pile-zone__rebuild-small" onClick={discardFlipped}>↺ descartar</div>
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
        <div className={"pile-zone__item" + (isHuman && highlightedSlot === "discard-human" ? " pile-zone__item--highlighted" : "")}
          data-slot={"discard-" + owner}
          onClick={!isHuman && selected ? () => moveToRivalPile("discard", ps.discard) : undefined}>
          <div className="pile-zone__label">Descarte ({ps.discard.length})</div>
          {discardTop ? (
            <div className={!canUseDiscard && isHuman ? "pile-zone__locked" : ""}>
              <Card card={discardTop}
                selected={selected?.source === "discard" && isHuman}
                onClick={isHuman && canUseDiscard ? () => select(discardTop, "discard", null) : undefined} />
            </div>
          ) : (
            <div className={"pile-zone__empty" + (!isHuman && selected ? " pile-zone__empty--active" : "")}>—</div>
          )}
        </div>

        {/* Crapette */}
        <div className={"pile-zone__item" + (isHuman && state.crapetteUsedThisTurn ? " pile-zone__locked" : "") + (isHuman && highlightedSlot === "crapette-human" ? " pile-zone__item--highlighted" : "")}
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

  // Casas: 0-3 izquierda, 4-7 derecha
  const leftHouses  = state.houses.slice(0, 4);
  const rightHouses = state.houses.slice(4, 8);

  return (
    <div className="board">
      <div className="board__title">BANCA RUSA</div>
      {renderPileZone("ai")}
      <div className="board__center">
        <div className="board__houses board__houses--left">
          {[...leftHouses].reverse().map((pile, ri) => {
            const houseIndex = 3 - ri;
            return renderHouse(pile, houseIndex, true);
          })}
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
          {rightHouses.map((pile, ri) => renderHouse(pile, ri + 4))}
        </div>
      </div>
      {renderPileZone("human")}

      {/* Indicador de turno */}
      <div className="board__turn-indicator">
        <div className={"board__turn-badge" + (state.currentPlayer === "ai" ? " board__turn-badge--ai" : "")}>
          {state.currentPlayer === "human" ? "Tu turno" : "IA jugando"}
        </div>
        {(state.phase === "ai_turn" || state.phase === "ai_crapette" || state.phase === "ai_talon") && (
          <div style={{marginTop:"8px", textAlign:"center"}}>
            <button onClick={declareStop} style={{
              background:"#c0392b", color:"white", border:"2px solid #ff6b6b",
              borderRadius:"8px", padding:"10px 20px", fontSize:"1.1em",
              fontFamily:"Cinzel,serif", fontWeight:"700", cursor:"pointer",
              display:"block", width:"100%", marginBottom:"6px"
            }}>✋ STOP</button>

          </div>
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
          <div className="board__stop-comic"><span>¡STOP!</span></div>
        </div>
      )}

      <div className="board__status">
        <span className={"board__status-msg board__status-msg--" + state.currentPlayer}>
          {state.statusMessage}
        </span>
        {state.stopMessage && (
          <div className={"board__stop-feedback board__stop-feedback--" + (state.stopValid ? "valid" : "invalid")}>
            {state.stopMessage}
          </div>
        )}
        <div className="board__controls-row">
          {/* Boton stop movido al turn indicator */}
          <div className="board__controls">
            <label className="board__ctrl-label">Velocidad IA</label>
            <select className="board__ctrl-select" value={aiSpeed} onChange={e => setAiSpeed(Number(e.target.value))}>
              <option value={8000}>Muy lento</option>
              <option value={5000}>Lento</option>
              <option value={3000}>Normal</option>
              <option value={1500}>Rapido</option>
              <option value={500}>Muy rapido</option>
            </select>
            <button className="board__btn" onClick={resetGame}>↺ Nueva partida</button>
            <button className="board__btn board__btn--dashboard" onClick={onDashboard}>⚙ Dashboard</button>
            <button className="board__btn board__btn--exit" onClick={onExit}>✕ Salir</button>
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
