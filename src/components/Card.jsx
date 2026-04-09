import "../styles/Card.css";
const SUIT_SYMBOLS = { P: '♠', C: '♥', D: '♦', T: '♣' };
const RANK_DISPLAY = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
function rankLabel(rank) { return RANK_DISPLAY[rank] ?? String(rank); }
export function Card({ card, onClick, selected = false, small = false, lifted = false, aiSelected = false }) {
  if (!card) return <div className="card card--empty" />;
  const isRed = card.color === 'red';
  const symbol = SUIT_SYMBOLS[card.suit] ?? card.suit;
  const rank = rankLabel(card.rank);
  if (!card.faceUp) {
    return (
      <div className={['card','card--back',small&&'card--small',lifted&&'card--lifted'].filter(Boolean).join(' ')} onClick={onClick}>
        <div className="card__back-pattern" />
      </div>
    );
  }
  return (
    <div className={['card',isRed?'card--red':'card--black',selected&&'card--selected',small&&'card--small',lifted&&'card--lifted',(lifted||selected)&&'card--no-appear'].filter(Boolean).join(' ')} onClick={onClick}>
      <div className="card__corner card__corner--top-left"><span className="card__rank">{rank}</span><span className="card__suit">{symbol}</span></div>
      <div className="card__corner card__corner--bottom-right"><span className="card__rank">{rank}</span><span className="card__suit">{symbol}</span></div>
      <div className="card__center">{symbol}</div>
    </div>
  );
}
