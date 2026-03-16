// PlayerZone.jsx — Zona de cada jugador

import { Card } from "./Card.jsx";
import { House } from "./House.jsx";
import "../styles/PlayerZone.css";

export function PlayerZone({
  playerState, owner, isActive, label,
  onCrapetteClick, onTalonClick, onDiscardClick,
  onHouseCardClick, onCardDragStart, onHouseDrop, onHouseDragOver,
  selectedCard,
}) {
  const crapetteTop = playerState.crapette.length > 0
    ? playerState.crapette[playerState.crapette.length - 1] : null;
  const discardTop = playerState.discard.length > 0
    ? playerState.discard[playerState.discard.length - 1] : null;
  const canUseDiscard = playerState.crapette.length === 0;

  return (
    <div className={["player-zone", isActive && "player-zone--active", "player-zone--" + owner].filter(Boolean).join(" ")}>

      <div className="player-zone__header">
        <span className="player-zone__label">{label}</span>
        {isActive && <span className="player-zone__turn-badge">● Tu turno</span>}
      </div>

      <div className="player-zone__body">

        {/* Crapette */}
        <div className="player-zone__pile">
          <div className="player-zone__pile-label">
            Crapette ({playerState.crapette.length})
          </div>
          <div onClick={owner === "human" ? onCrapetteClick : undefined}>
            {crapetteTop ? (
              <Card
                card={crapetteTop}
                selected={selectedCard?.source === "crapette"}
                onClick={owner === "human" ? () => onCrapetteClick && onCrapetteClick(crapetteTop) : undefined}
                draggable={owner === "human"}
                onDragStart={owner === "human" ? (e) => onCardDragStart && onCardDragStart(e, crapetteTop, "crapette", null) : undefined}
              />
            ) : (
              <div className="player-zone__empty-pile">✓</div>
            )}
          </div>
        </div>

        {/* Casas */}
        <House
          houses={playerState.houses}
          owner={owner}
          selectedCard={selectedCard}
          onCardClick={onHouseCardClick}
          onCardDragStart={onCardDragStart}
          onDrop={onHouseDrop}
          onDragOver={onHouseDragOver}
        />

        {/* Talon */}
        <div className="player-zone__pile">
          <div className="player-zone__pile-label">
            Talón ({playerState.talon.length})
          </div>
          {playerState.talon.length > 0 ? (
            <Card
              card={{ faceUp: false, id: "talon_" + owner }}
              onClick={owner === "human" ? onTalonClick : undefined}
            />
          ) : playerState.discard.length > 0 ? (
            <div
              className="player-zone__rebuild"
              onClick={owner === "human" ? onTalonClick : undefined}
            >↺</div>
          ) : (
            <div className="player-zone__empty-pile">—</div>
          )}
        </div>

        {/* Descarte */}
        <div className="player-zone__pile">
          <div className="player-zone__pile-label">
            Descarte ({playerState.discard.length})
          </div>
          {discardTop ? (
            <div className={canUseDiscard ? "" : "player-zone__discard--locked"}>
              <Card
                card={discardTop}
                selected={selectedCard?.source === "discard"}
                onClick={owner === "human" && canUseDiscard ? () => onDiscardClick && onDiscardClick(discardTop) : undefined}
                draggable={owner === "human" && canUseDiscard}
                onDragStart={owner === "human" && canUseDiscard ? (e) => onCardDragStart && onCardDragStart(e, discardTop, "discard", null) : undefined}
              />
            </div>
          ) : (
            <div className="player-zone__empty-pile">—</div>
          )}
        </div>

      </div>
    </div>
  );
}
