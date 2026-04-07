// Card.jsx — Componente de carta puro (solo display)
import { SUIT_SYMBOL, rankDisplay } from '../engine/deck.js';

export function Card({ card, selected, lifted, small, onClick }) {
  if (!card) return null;

  const isBack = !card.faceUp;
  const cls = [
    'card',
    isBack        ? 'card--back'     : '',
    card.color === 'red' ? 'card--red' : 'card--black',
    selected      ? 'card--selected' : '',
    lifted        ? 'card--lifted'   : '',
    small         ? 'card--small'    : '',
  ].filter(Boolean).join(' ');

  if (isBack) {
    return (
      <div className={cls} onClick={onClick}>
        <div className="card__back-pattern" />
      </div>
    );
  }

  const rankStr = rankDisplay(card.rank);
  const suitStr = SUIT_SYMBOL[card.suit];

  return (
    <div className={cls} onClick={onClick}>
      <div className="card__corner card__corner--top-left">
        <span className="card__rank">{rankStr}</span>
        <span className="card__suit">{suitStr}</span>
      </div>
      <div className="card__center">{suitStr}</div>
      <div className="card__corner card__corner--bottom-right">
        <span className="card__rank">{rankStr}</span>
        <span className="card__suit">{suitStr}</span>
      </div>
    </div>
  );
}
