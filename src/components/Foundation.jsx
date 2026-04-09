import { Card } from "./Card.jsx";
import "../styles/Foundation.css";
const SUIT_SYMBOLS = { P: "♠", C: "♥", D: "♦", T: "♣" };
const SUIT_COLORS  = { P: "black", C: "red", D: "red", T: "black" };
export function Foundation({ foundations, onFoundationClick }) {
  const suits = ["P", "C", "D", "T"];
  return (
    <div className="foundations">
      <div className="foundations__label">FUNDACIONES</div>
      <div className="foundations__grid">
        {suits.map(suit => {
          const base = { P: 9, C: 11, D: 13, T: 15 }[suit];
          return (
            <div key={suit} className="foundations__pair">
              {[base, base + 1].map(fId => {
                const pile = foundations[fId] || [];
                const top  = pile.length > 0 ? pile[pile.length - 1] : null;
                return (
                  <div key={fId} className="foundation__slot" onClick={onFoundationClick}>
                    {top ? <Card card={top} small /> : <div className={`foundation__empty foundation__empty--${SUIT_COLORS[suit]}`}>{SUIT_SYMBOLS[suit]}</div>}
                    <span className="foundation__count">{pile.length}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
