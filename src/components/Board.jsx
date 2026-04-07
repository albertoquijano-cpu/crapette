// Board.jsx — Tablero principal de Banca Rusa
// API nueva: pilas numeradas 1-27, posición relativa

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from './Card.jsx';
import { useGameLoop } from '../hooks/useGameLoop.js';
import { useAI } from '../hooks/useAI.js';
import { useStopDetection } from '../hooks/useStopDetection.js';

import {
  PILES, HOUSE_PILES, SUIT_FOUNDATIONS, SUIT_SYMBOL,
  cardLabel, rankDisplay,
} from '../engine/deck.js';
import {
  topCard, GAME_PHASES,
} from '../engine/gameState.js';
import {
  canPlayToFoundation, canPlayToHouse,
  canPlayToRivalDiscard, canPlayToRivalCrapette,
} from '../engine/rules.js';

import '../styles/Board.css';
import '../styles/Card.css';
import '../styles/PlayerZone.css';
import '../styles/Foundation.css';
import '../styles/House.css';

// Fundaciones agrupadas por palo para el render
const FOUNDATION_ROWS = [
  { suit: 'P', ids: [PILES.FOUND_SPADES_A,   PILES.FOUND_SPADES_B],   color: 'black' },
  { suit: 'C', ids: [PILES.FOUND_HEARTS_A,   PILES.FOUND_HEARTS_B],   color: 'red'   },
  { suit: 'D', ids: [PILES.FOUND_DIAMONDS_A, PILES.FOUND_DIAMONDS_B], color: 'red'   },
  { suit: 'T', ids: [PILES.FOUND_CLUBS_A,    PILES.FOUND_CLUBS_B],    color: 'black' },
];

export function Board({ config, onReset }) {
  const {
    state, lastMove, announcedMove, flyingCard,
    playToFoundation, playToHouse, playToRivalPile,
    flipTalon, discardFlipped,
    runAITurn, declareStop, resetGame,
  } = useGameLoop(config);

  useAI(state.phase, state.aiSpeed, runAITurn, state.aiLevel);
  useStopDetection(state.phase, declareStop);

  // ── Selección de carta ──────────────────────────────────────────────────
  // selected: { card, source, fromPile }
  // source: 'crapette' | 'flipped' | 'discard' | 'house'
  // fromPile: pile ID (para houses) o null
  const [selected, setSelected] = useState(null);

  // Limpiar selección cuando cambia el turno
  useEffect(() => { setSelected(null); }, [state.phase]);

  const isHumanTurn = state.phase === GAME_PHASES.HUMAN_TURN;

  // ── Stop explosión visual ───────────────────────────────────────────────
  const [showStopExplosion, setShowStopExplosion] = useState(false);
  const prevStopRef = useRef(false);
  useEffect(() => {
    if (state.stopValid && !prevStopRef.current) {
      setShowStopExplosion(true);
      setTimeout(() => setShowStopExplosion(false), 1200);
    }
    prevStopRef.current = state.stopValid || false;
  }, [state.stopValid]);

  // ── Highlight del destino anunciado por IA ──────────────────────────────
  const getHighlightedSlot = () => {
    if (!announcedMove) return null;
    return announcedMove.toPile;
  };
  const highlightedPile = getHighlightedSlot();

  // ── Seleccionar carta ───────────────────────────────────────────────────
  const select = (card, source, fromPile) => {
    if (!isHumanTurn) return;
    if (selected?.card?.id === card.id && selected?.fromPile === fromPile) {
      setSelected(null); // deselect
      return;
    }
    setSelected({ card, source, fromPile });
  };

  // ── Intentar jugar la carta seleccionada a un destino ─────────────────
  const tryPlayTo = useCallback((targetPile) => {
    if (!selected || !isHumanTurn) return;
    const { card, source, fromPile } = selected;

    // ¿Fundación?
    if (targetPile >= 9 && targetPile <= 16) {
      const fId = canPlayToFoundation(card, state.foundations);
      if (fId === targetPile) {
        playToFoundation(card, source, fromPile);
        setSelected(null);
      }
      return;
    }

    // ¿Casa?
    if (targetPile >= 1 && targetPile <= 8) {
      if (canPlayToHouse(card, state.houses[targetPile])) {
        playToHouse(card, source, fromPile, targetPile);
        setSelected(null);
      }
      return;
    }

    // ¿Descarte rival?
    if (targetPile === PILES.AI_DISCARD) {
      if (canPlayToRivalDiscard(card, state.ai.discard)) {
        playToRivalPile(card, source, fromPile, 'discard');
        setSelected(null);
      }
      return;
    }

    // ¿Crapette rival?
    if (targetPile === PILES.AI_CRAPETTE) {
      if (canPlayToRivalCrapette(card, state.ai.crapette)) {
        playToRivalPile(card, source, fromPile, 'crapette');
        setSelected(null);
      }
    }
  }, [selected, isHumanTurn, state, playToFoundation, playToHouse, playToRivalPile]);

  // ── Handlers de click en destinos ──────────────────────────────────────
  const handleHouseClick = (hId) => {
    if (!isHumanTurn) return;
    const top = topCard(state.houses[hId]);
    if (selected) {
      tryPlayTo(hId);
    } else if (top && top.pos === 0) {
      select(top, 'house', hId);
    }
  };

  const handleFoundationClick = (fId) => {
    if (!isHumanTurn || !selected) return;
    tryPlayTo(fId);
  };

  // ── Game Over ───────────────────────────────────────────────────────────
  if (state.phase === GAME_PHASES.GAME_OVER) {
    const winner = state.winner === 'human' ? '¡Ganaste!' : 'Ganó la IA';
    return (
      <div className="board">
        <div className="board__title">BANCA RUSA</div>
        <div className="board__status">
          <div className="board__gameover">{winner}</div>
          <button className="board__btn" onClick={() => { resetGame(); onReset?.(); }}>
            Nueva partida
          </button>
        </div>
      </div>
    );
  }

  // ── Render principal ────────────────────────────────────────────────────
  const aiTurn = state.phase === GAME_PHASES.AI_TURN;

  return (
    <div className="board">
      {/* Título */}
      <div className="board__title">BANCA RUSA</div>

      {/* Stop explosion */}
      {showStopExplosion && (
        <div className="board__stop-explosion">
          <div className="board__stop-comic">✋</div>
        </div>
      )}

      {/* Zona IA (arriba, volteada) */}
      <PlayerZone
        player="ai"
        playerState={state.ai}
        isHuman={false}
        isActive={aiTurn}
        selected={selected}
        onRivalPileClick={isHumanTurn ? tryPlayTo : null}
        highlightedPile={highlightedPile}
      />

      {/* Centro: casas izquierda + fundaciones + casas derecha */}
      <div className="board__center">
        {/* Casas IA: 1-4 (izquierda) */}
        <div className="board__houses board__houses--left">
          {[1, 2, 3, 4].map(hId => (
            <HouseSlot
              key={hId}
              hId={hId}
              pile={state.houses[hId]}
              selected={selected}
              highlighted={highlightedPile === hId}
              onClick={() => handleHouseClick(hId)}
            />
          ))}
        </div>

        {/* Fundaciones */}
        <div className="board__foundations">
          {FOUNDATION_ROWS.map(({ suit, ids, color }) => (
            <div className="foundation-row" key={suit}>
              {ids.map(fId => (
                <FoundationSlot
                  key={fId}
                  fId={fId}
                  suit={suit}
                  color={color}
                  pile={state.foundations[fId]}
                  highlighted={highlightedPile === fId}
                  onClick={() => handleFoundationClick(fId)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Casas humano: 5-8 (derecha) */}
        <div className="board__houses board__houses--right">
          {[5, 6, 7, 8].map(hId => (
            <HouseSlot
              key={hId}
              hId={hId}
              pile={state.houses[hId]}
              selected={selected}
              highlighted={highlightedPile === hId}
              onClick={() => handleHouseClick(hId)}
            />
          ))}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        state={state}
        isHumanTurn={isHumanTurn}
        aiTurn={aiTurn}
        onStop={declareStop}
        onReset={() => { resetGame(); onReset?.(); }}
      />

      {/* Zona humano (abajo) */}
      <PlayerZone
        player="human"
        playerState={state.human}
        isHuman={true}
        isActive={isHumanTurn}
        selected={selected}
        onSelect={select}
        onFlipTalon={flipTalon}
        onDiscardFlipped={discardFlipped}
        highlightedPile={highlightedPile}
      />

      {/* Turno badge (esquina derecha) */}
      <div className="board__turn-indicator">
        <div className={`board__turn-badge${aiTurn ? ' board__turn-badge--ai' : ''}`}>
          {aiTurn ? 'IA jugando…' : 'Tu turno'}
        </div>
        {state.stopMessage && (
          <div className={`board__stop-badge`}>{state.stopMessage}</div>
        )}
      </div>
    </div>
  );
}

// ── PlayerZone ────────────────────────────────────────────────────────────────
function PlayerZone({
  player, playerState, isHuman, isActive,
  selected, onSelect, onFlipTalon, onDiscardFlipped,
  onRivalPileClick, highlightedPile,
}) {
  const crapetteTop = topCard(playerState.crapette);
  const discardTop  = topCard(playerState.discard);
  const talonTop    = topCard(playerState.talon);

  const crapettePile = isHuman ? PILES.HUMAN_CRAPETTE : PILES.AI_CRAPETTE;
  const discardPile  = isHuman ? PILES.HUMAN_DISCARD  : PILES.AI_DISCARD;

  const isSelected = (card) =>
    selected && card && selected.card.id === card.id;

  const zoneClass = [
    'player-zone',
    isActive ? 'player-zone--active' : '',
    !isHuman ? 'player-zone--ai'     : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={zoneClass}>
      <div className="player-zone__header">
        <span className="player-zone__label">{isHuman ? 'Tus cartas' : 'IA'}</span>
        {isActive && <span className="player-zone__turn-badge">▶ jugando</span>}
      </div>
      <div className="player-zone__body">

        {/* Talon — siempre primero para el humano */}
        <div className="player-zone__pile">
          <span className="player-zone__pile-label">
            Talón ({playerState.talon.length})
          </span>
          {isHuman ? (
            // Talón del humano: clickeable para voltear si no hay carta volteada
            talonTop || playerState.discard.length > 0 ? (
              <Card
                card={talonTop
                  ? { ...talonTop, faceUp: false }
                  : { faceUp: false, suit: 'P', rank: 0, color: 'black', id: '__talon__' }}
                onClick={!playerState.flipped ? onFlipTalon : undefined}
              />
            ) : (
              <div className="player-zone__empty-pile">—</div>
            )
          ) : (
            // Talón de la IA: siempre boca abajo
            talonTop ? (
              <Card card={{ ...talonTop, faceUp: false }} />
            ) : (
              <div className="player-zone__empty-pile">—</div>
            )
          )}
        </div>

        {/* Carta volteada — aparece entre talón y descarte */}
        {isHuman && playerState.flipped && (
          <div className="player-zone__pile">
            <span className="player-zone__pile-label">Volteada</span>
            <Card
              card={playerState.flipped}
              selected={isSelected(playerState.flipped)}
              onClick={() => onSelect(playerState.flipped, 'flipped', PILES.HUMAN_FLIPPED)}
            />
            <div className="pile-zone__rebuild-small" onClick={onDiscardFlipped}>
              ↺ descartar
            </div>
          </div>
        )}

        {/* Descarte */}
        <div
          className={[
            'player-zone__pile',
            highlightedPile === discardPile ? 'pile-zone__item--highlighted' : '',
          ].join(' ')}
        >
          <span className="player-zone__pile-label">
            Descarte ({playerState.discard.length})
          </span>
          {discardTop ? (
            <Card
              card={discardTop}
              selected={isSelected(discardTop)}
              onClick={
                isHuman && onSelect && playerState.crapette.length === 0
                  ? () => onSelect(discardTop, 'discard', discardPile)
                  : (!isHuman && onRivalPileClick ? () => onRivalPileClick(discardPile) : undefined)
              }
            />
          ) : (
            <div className="player-zone__empty-pile">—</div>
          )}
        </div>

        {/* Crapette — siempre al final */}
        <div className="player-zone__pile">
          <span className="player-zone__pile-label">
            Crapette ({playerState.crapette.length})
          </span>
          {crapetteTop ? (
            <Card
              card={crapetteTop}
              selected={isSelected(crapetteTop)}
              onClick={isHuman && onSelect
                ? () => onSelect(crapetteTop, 'crapette', crapettePile)
                : (onRivalPileClick ? () => onRivalPileClick(crapettePile) : undefined)
              }
            />
          ) : (
            <div className="player-zone__empty-pile">♠</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HouseSlot ─────────────────────────────────────────────────────────────────
function HouseSlot({ hId, pile, selected, highlighted, onClick }) {
  const top = topCard(pile);
  const isSelected = selected && top && selected.card.id === top.id && selected.fromPile === hId;

  const slotClass = [
    'house-slot',
    highlighted ? 'house-slot--highlighted' : '',
  ].filter(Boolean).join(' ');

  if (pile.length === 0) {
    return (
      <div className={slotClass} onClick={onClick}>
        <div className={`house-slot__empty${highlighted ? ' house-slot__empty--active' : ''}`} />
      </div>
    );
  }

  // Offset vertical compacto para pilas largas
  const offset = Math.min(18, Math.floor(72 / pile.length));
  const stackHeight = 100 + (pile.length - 1) * offset;

  return (
    <div className={slotClass} onClick={onClick}>
      <div className="house-slot__stack" style={{ height: stackHeight, position: 'relative' }}>
        {pile.map((card, i) => (
          <div
            key={card.id}
            className="house-slot__card"
            style={{ top: i * offset, zIndex: i, position: 'absolute' }}
          >
            <Card
              card={card}
              selected={isSelected && i === pile.length - 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FoundationSlot ────────────────────────────────────────────────────────────
function FoundationSlot({ fId, suit, color, pile, highlighted, onClick }) {
  const top = topCard(pile);

  const slotClass = [
    'foundation-slot',
    `foundation-slot--${color}`,
    highlighted ? 'foundation-slot--highlighted' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={slotClass} onClick={onClick}>
      {top ? (
        <Card card={top} small />
      ) : (
        <div className="foundation-slot__empty">{SUIT_SYMBOL[suit]}</div>
      )}
    </div>
  );
}

// ── StatusBar ─────────────────────────────────────────────────────────────────
function StatusBar({ state, isHumanTurn, aiTurn, onStop, onReset }) {
  return (
    <div className="board__status">
      <div className={`board__status-msg board__status-msg--${isHumanTurn ? 'human' : 'ai'}`}>
        {state.statusMessage}
      </div>

      {state.mandatoryMoves?.length > 0 && isHumanTurn && (
        <div className="board__mandatory">
          ⚠ Jugada obligatoria pendiente
        </div>
      )}

      {state.stopMessage && (
        <div className={`board__stop-feedback board__stop-feedback--${state.stopValid ? 'valid' : 'invalid'}`}>
          {state.stopMessage}
        </div>
      )}

      <div className="board__controls-row">
        {aiTurn && (
          <button className="board__btn board__btn--stop-big" onClick={onStop}>
            ✋ STOP
            <span className="board__btn--stop-hint">la IA cometió un error</span>
          </button>
        )}
        <button className="board__btn board__btn--exit" onClick={onReset}>
          Salir
        </button>
      </div>
    </div>
  );
}
