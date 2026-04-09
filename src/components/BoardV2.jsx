import React, { useState, useRef, useEffect } from 'react';
import { Card } from './Card.jsx';
import { useGameLoop } from '../hooks/useGameLoopV2.js';
import { useAI } from '../hooks/useAI.js';
import { useStopDetection } from '../hooks/useStopDetection.js';
import { canPlayToFoundation, canPlayToRivalCrapette, canPlayToRivalDiscard } from '../engine/rules.js';
import { GAME_PHASES, topCard } from '../engine/gameState.js';
import { PILES, HOUSE_PILES, SUIT_FOUNDATIONS } from '../engine/deck.js';
import '../styles/Board.css';

const SUIT_SYMBOLS = { P: '\u2660', C: '\u2665', D: '\u2666', T: '\u2663' };
const SUIT_COLORS  = { P: 'black', C: 'red', D: 'red', T: 'black' };
const SUITS = ['P', 'C', 'D', 'T'];

export function Board({ config, onReset, onDashboard, onExit }) {
  const { state, announcedMove, playToFoundation, playToHouse, playToRivalPile, flipTalon, discardFlipped, runAITurn, declareStop, resetGame } = useGameLoop(config);
  const [aiSpeed, setAiSpeed] = useState(config.aiSpeed || 3000);
  const [selected, setSelected] = useState(null);
  const [showStop, setShowStop] = useState(false);
  const [showAIStop, setShowAIStop] = useState(false);

  useAI(state.phase, aiSpeed, runAITurn);
  useStopDetection(state.phase, declareStop);

  const prevStopRef = useRef(false);
  const prevStopMsgRef = useRef('');
  useEffect(() => {
    if (state.stopValid && !prevStopRef.current) { setShowStop(true); setTimeout(() => setShowStop(false), 2500); }
    prevStopRef.current = state.stopValid || false;
  }, [state.stopValid]);
  useEffect(() => {
    const msg = state.stopMessage || '';
    if (msg && msg !== prevStopMsgRef.current && state.currentPlayer === 'ai' && msg.includes('obligatoria')) {
      setShowAIStop(true); setTimeout(() => setShowAIStop(false), 2500);
    }
    prevStopMsgRef.current = msg;
  }, [state.stopMessage]);

  const isHumanTurn = state.currentPlayer === 'human';
  const announcedFromPile = announcedMove?.fromPile ?? null;
  const announcedToPile = announcedMove?.toPile ?? null;

  const select = (card, source, pileId) => {
    if (!isHumanTurn) return;
    if (source === 'crapette' && state.crapetteUsedThisTurn) return;
    if (selected?.card.id === card.id) setSelected(null);
    else setSelected({ card, source, pileId });
  };

  const moveToFoundation = () => {
    if (!selected || !isHumanTurn) return;
    playToFoundation(selected.card, selected.source, selected.pileId);
    setSelected(null);
  };

  const moveToHouse = (targetPileId) => {
    if (!selected || !isHumanTurn) return;
    playToHouse(selected.card, selected.source, selected.pileId, targetPileId);
    setSelected(null);
  };

  const moveToRivalPile = (pileType) => {
    if (!selected || !isHumanTurn) return;
    playToRivalPile(selected.card, selected.source, selected.pileId, pileType);
    setSelected(null);
  };

  const onHouseCardClick = (card, pileId) => {
    if (!isHumanTurn) return;
    if (selected) {
      if (selected.card.id === card.id) { setSelected(null); return; }
      playToHouse(selected.card, selected.source, selected.pileId, pileId);
      setSelected(null);
    } else { select(card, 'house', pileId); }
  };

  const renderHouse = (pileId, reverse = false) => {
    const pile = state.houses[pileId] || [];
    const top = topCard(pile);
    const isTopSelected = selected && top && selected.card.id === top.id;
    const isHighlighted = announcedToPile === pileId;
    const cardWidth = 18;
    const stackWidth = Math.max(63, (pile.length - 1) * cardWidth + 66);
    return (
      React.createElement('div', {
        key: pileId,
        'data-slot': 'house-' + pileId,
        className: 'house-slot' + (isHighlighted ? ' house-slot--highlighted' : ''),
        style: { width: stackWidth + 'px' },
        onClick: () => !top && moveToHouse(pileId)
      },
        pile.length === 0
          ? React.createElement('div', { className: 'house-slot__empty' + (selected ? ' house-slot__empty--active' : ''), onClick: () => moveToHouse(pileId) })
          : React.createElement('div', { className: 'house-slot__stack', style: { width: stackWidth + 'px', position: 'relative' } },
              pile.map((card, ci) => {
                const isTop = ci === pile.length - 1;
                const maxOff = (pile.length - 1) * cardWidth;
                const left = reverse ? maxOff - ci * cardWidth : ci * cardWidth;
                const isAISelected = isTop && announcedMove != null && announcedMove.card?.id === card.id;
                return React.createElement('div', { key: card.id, className: 'house-slot__card', style: { left: left + 'px', zIndex: ci + 1, position: 'absolute' } },
                  React.createElement(Card, { card, selected: isTopSelected && isTop, aiSelected: isAISelected, onClick: isTop ? () => onHouseCardClick(card, pileId) : undefined })
                );
              })
            )
      )
    );
  };

  const renderFoundation = (suit, fId) => {
    const pile = state.foundations[fId] || [];
    const top = topCard(pile);
    const isHighlighted = announcedToPile === fId;
    return (
      React.createElement('div', {
        key: fId,
        'data-slot': 'foundation-' + fId,
        className: 'foundation-slot foundation-slot--' + SUIT_COLORS[suit] + (isHighlighted ? ' foundation-slot--highlighted' : ''),
        onClick: moveToFoundation
      },
        top ? React.createElement(Card, { card: top }) : React.createElement('div', { className: 'foundation-slot__empty' }, SUIT_SYMBOLS[suit]),
        React.createElement('span', { className: 'foundation-slot__count' }, pile.length)
      )
    );
  };

  const renderPileZone = (owner) => {
    const ps = state[owner];
    const isHuman = owner === 'human';
    const crapetteTop = topCard(ps.crapette);
    const discardTop = topCard(ps.discard);
    const canUseDiscard = ps.crapette.length === 0;
    const isLiftedCrap = !isHuman && announcedMove != null && announcedMove.card?.id === crapetteTop?.id;
    const isLiftedFlip = !isHuman && announcedMove != null && announcedMove.card?.id === ps.flipped?.id;
    const isCrapHighlighted = isHuman && announcedToPile === PILES.HUMAN_CRAPETTE;
    const isDiscHighlighted = isHuman && announcedToPile === PILES.HUMAN_DISCARD;

    return React.createElement('div', { className: 'pile-zone pile-zone--' + owner },
      React.createElement('div', { className: 'pile-zone__item' },
        React.createElement('div', { className: 'pile-zone__label' }, 'Talon (' + ps.talon.length + ')'),
        ps.flipped
          ? React.createElement('div', { className: 'pile-zone__flipped', 'data-slot': 'flipped-' + owner },
              React.createElement(Card, { card: ps.flipped, selected: isHuman && selected?.source === 'flipped', aiSelected: isLiftedFlip, onClick: isHuman ? () => select(ps.flipped, 'flipped', PILES.HUMAN_FLIPPED) : undefined }),
              isHuman && React.createElement('div', { className: 'pile-zone__rebuild-small', onClick: discardFlipped }, '\u21ba descartar')
            )
          : ps.talon.length > 0
            ? React.createElement(Card, { card: { faceUp: false, id: 'talon_' + owner }, onClick: isHuman ? flipTalon : undefined })
            : ps.discard.length > 0
              ? React.createElement('div', { className: 'pile-zone__rebuild', onClick: isHuman ? flipTalon : undefined }, '\u21ba')
              : React.createElement('div', { className: 'pile-zone__empty' }, '\u2014')
      ),
      React.createElement('div', { className: 'pile-zone__item' + (isDiscHighlighted ? ' pile-zone__item--highlighted' : ''), 'data-slot': 'discard-' + owner, onClick: !isHuman && selected ? () => moveToRivalPile('discard') : undefined },
        React.createElement('div', { className: 'pile-zone__label' }, 'Descarte (' + ps.discard.length + ')'),
        discardTop
          ? React.createElement('div', { className: !canUseDiscard && isHuman ? 'pile-zone__locked' : '' },
              React.createElement(Card, { card: discardTop, selected: isHuman && selected?.source === 'discard', onClick: isHuman && canUseDiscard ? () => select(discardTop, 'discard', PILES.HUMAN_DISCARD) : undefined })
            )
          : React.createElement('div', { className: 'pile-zone__empty' + (!isHuman && selected ? ' pile-zone__empty--active' : '') }, '\u2014')
      ),
      React.createElement('div', { className: 'pile-zone__item' + (isHuman && state.crapetteUsedThisTurn ? ' pile-zone__locked' : '') + (isCrapHighlighted ? ' pile-zone__item--highlighted' : ''), 'data-slot': 'crapette-' + owner, onClick: !isHuman && selected ? () => moveToRivalPile('crapette') : undefined },
        React.createElement('div', { className: 'pile-zone__label' }, 'Crapette (' + ps.crapette.length + ')'),
        crapetteTop
          ? React.createElement(Card, { card: { ...crapetteTop, faceUp: true }, selected: isHuman && selected?.source === 'crapette', aiSelected: isLiftedCrap, onClick: isHuman ? () => select(crapetteTop, 'crapette', PILES.HUMAN_CRAPETTE) : selected ? () => moveToRivalPile('crapette') : undefined })
          : React.createElement('div', { className: 'pile-zone__empty' + (!isHuman && selected ? ' pile-zone__empty--active' : ''), onClick: !isHuman && selected ? () => moveToRivalPile('crapette') : undefined }, '\u2713')
      )
    );
  };

  return React.createElement('div', { className: 'board' },
    React.createElement('div', { className: 'board__title' }, 'BANCA RUSA'),
    renderPileZone('ai'),
    React.createElement('div', { className: 'board__center' },
      React.createElement('div', { className: 'board__houses board__houses--left' }, [4,3,2,1].map(id => renderHouse(id, true))),
      React.createElement('div', { className: 'board__foundations' },
        SUITS.map(suit => {
          const [idA, idB] = SUIT_FOUNDATIONS[suit];
          return React.createElement('div', { key: suit, className: 'foundation-row' },
            renderFoundation(suit, idA), renderFoundation(suit, idB)
          );
        })
      ),
      React.createElement('div', { className: 'board__houses board__houses--right' }, [5,6,7,8].map(id => renderHouse(id, false)))
    ),
    renderPileZone('human'),
    React.createElement('div', { className: 'board__turn-indicator' },
      React.createElement('div', { className: 'board__turn-badge' + (state.currentPlayer === 'ai' ? ' board__turn-badge--ai' : '') },
        state.currentPlayer === 'human' ? 'Tu turno' : 'IA jugando'
      ),
      state.phase === GAME_PHASES.AI_TURN && React.createElement('button', {
        onClick: declareStop,
        style: { background:'#c0392b', color:'white', border:'2px solid #ff6b6b', borderRadius:'8px', padding:'10px 20px', fontSize:'1.1em', fontFamily:'Cinzel,serif', fontWeight:'700', cursor:'pointer', marginTop:'8px' }
      }, '\u270b STOP'),
      state.phase === GAME_PHASES.GAME_OVER && React.createElement('div', { className: 'board__turn-badge', style: { color:'#f5d070', borderColor:'#f5d070' } },
        state.winner === 'human' ? '\u00a1Ganaste!' : 'Gan\u00f3 la IA'
      )
    ),
    showStop && React.createElement('div', { className: 'board__stop-explosion' }, React.createElement('div', { className: 'board__stop-comic' }, React.createElement('span', null, '\u00a1STOP!'))),
    showAIStop && React.createElement('div', { className: 'board__stop-explosion' }, React.createElement('div', { className: 'board__stop-comic board__stop-comic--ai' }, React.createElement('span', null, '\u00a1STOP!'))),
    React.createElement('div', { className: 'board__status' },
      React.createElement('span', { className: 'board__status-msg board__status-msg--' + state.currentPlayer }, state.statusMessage),
      state.stopMessage && React.createElement('div', { className: 'board__stop-feedback board__stop-feedback--' + (state.stopValid ? 'valid' : 'invalid') }, state.stopMessage),
      React.createElement('div', { className: 'board__controls-row' },
        React.createElement('div', { className: 'board__controls' },
          React.createElement('label', { className: 'board__ctrl-label' }, 'Velocidad IA'),
          React.createElement('select', { className: 'board__ctrl-select', value: aiSpeed, onChange: e => setAiSpeed(Number(e.target.value)) },
            React.createElement('option', { value: 8000 }, 'Muy lento'),
            React.createElement('option', { value: 5000 }, 'Lento'),
            React.createElement('option', { value: 3000 }, 'Normal'),
            React.createElement('option', { value: 1500 }, 'R\u00e1pido'),
            React.createElement('option', { value: 500 }, 'Muy r\u00e1pido')
          ),
          React.createElement('button', { className: 'board__btn', onClick: resetGame }, '\u21ba Nueva partida'),
          React.createElement('button', { className: 'board__btn board__btn--dashboard', onClick: onDashboard }, '\u2699 Dashboard'),
          React.createElement('button', { className: 'board__btn board__btn--exit', onClick: onExit }, '\u2715 Salir')
        )
      ),
      state.phase === GAME_PHASES.GAME_OVER && React.createElement('div', { className: 'board__gameover' }, state.winner === 'human' ? '\u00a1Ganaste!' : 'Gan\u00f3 la IA')
    )
  );
}
