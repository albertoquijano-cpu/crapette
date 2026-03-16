// Foundation.jsx — Las 8 fundaciones centrales compartidas

import { Card } from "./Card.jsx";
import "../styles/Foundation.css";

const SUIT_SYMBOLS = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};

const SUIT_COLORS = {
  spades: "black", hearts: "red", diamonds: "red", clubs: "black",
};

export function Foundation({ foundations }) {
  // Agrupar fundaciones por palo (2 pilas por palo: human y ai)
  const suits = ["spades", "hearts", "diamonds", "clubs"];

  return (
    <div className="foundations">
      <div className="foundations__label">FUNDACIONES</div>
      <div className="foundations__grid">
        {suits.map(suit => (
          <div key={suit} className="foundations__pair">
            {["human", "ai"].map(owner => {
              const key = suit + "_" + owner;
              const pile = foundations[key];
              const topCard = pile.length > 0 ? pile[pile.length - 1] : null;
              return (
                <div key={key} className="foundation__slot">
                  {topCard ? (
                    <Card card={topCard} small />
                  ) : (
                    <div className={"foundation__empty foundation__empty--" + SUIT_COLORS[suit]}>
                      {SUIT_SYMBOLS[suit]}
                    </div>
                  )}
                  <span className="foundation__count">{pile.length}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
