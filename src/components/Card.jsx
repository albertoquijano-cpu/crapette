// Card.jsx — Carta individual con animaciones

import { useState } from "react";
import "../styles/Card.css";

const SUIT_SYMBOLS = {
  spades:   "♠",
  hearts:   "♥",
  diamonds: "♦",
  clubs:    "♣",
};

export function Card({ card, onClick, draggable = false, onDragStart, selected = false, small = false }) {
  const [flipped, setFlipped] = useState(false);

  if (!card) return <div className={"card card--empty"}></div>;

  const isRed = card.color === "red";
  const symbol = SUIT_SYMBOLS[card.suit];

  if (!card.faceUp) {
    return (
      <div
        className={["card", "card--back", small && "card--small"].filter(Boolean).join(" ")}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <div className="card__back-pattern" />
      </div>
    );
  }

  return (
    <div
      className={[
        "card",
        isRed ? "card--red" : "card--black",
        selected && "card--selected",
        small && "card--small",
      ].filter(Boolean).join(" ")}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="card__corner card__corner--top-left">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{symbol}</span>
      </div>
      <div className="card__corner card__corner--top-right">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{symbol}</span>
      </div>
      <div className="card__center">{symbol}</div>
      <div className="card__corner card__corner--bottom-left">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{symbol}</span>
      </div>
      <div className="card__corner card__corner--bottom-right">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{symbol}</span>
      </div>
    </div>
  );
}
