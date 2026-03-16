// House.jsx — Casas (tableau) de cada jugador

import { Card } from "./Card.jsx";
import "../styles/House.css";

export function House({ houses, onCardClick, onCardDragStart, onDrop, onDragOver, selectedCard, owner }) {
  return (
    <div className="houses">
      {houses.map((pile, houseIndex) => (
        <div
          key={houseIndex}
          className="house__slot"
          onDrop={(e) => onDrop && onDrop(e, houseIndex)}
          onDragOver={(e) => { e.preventDefault(); onDragOver && onDragOver(e, houseIndex); }}
        >
          {pile.length === 0 ? (
            <div className="house__empty" />
          ) : (
            <div className="house__stack">
              {pile.map((card, cardIndex) => {
                const isTop = cardIndex === pile.length - 1;
                const isSelected = selectedCard && selectedCard.card.id === card.id;
                return (
                  <div
                    key={card.id}
                    className="house__card-wrapper"
                    style={{ top: cardIndex * 22 + "px" }}
                  >
                    <Card
                      card={card}
                      selected={isSelected}
                      onClick={isTop && owner === "human" ? () => onCardClick && onCardClick(card, "house", houseIndex) : undefined}
                      draggable={isTop && owner === "human"}
                      onDragStart={isTop && owner === "human" ? (e) => onCardDragStart && onCardDragStart(e, card, "house", houseIndex) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
