// moveHistory.js — Historial de jugadas para replay

export function createHistory() {
  return {
    moves: [],
    snapshots: [],
  };
}

export function recordMove(history, move, stateBefore) {
  return {
    moves: [...history.moves, {
      ...move,
      timestamp: Date.now(),
    }],
    snapshots: [...history.snapshots, JSON.parse(JSON.stringify(stateBefore))],
  };
}

export function getSnapshot(history, index) {
  if (index < 0 || index >= history.snapshots.length) return null;
  return history.snapshots[index];
}

export function getTotalMoves(history) {
  return history.moves.length;
}

export function getMoveAt(history, index) {
  if (index < 0 || index >= history.moves.length) return null;
  return history.moves[index];
}

export function summarizeHistory(history) {
  const total = history.moves.length;
  const foundations = history.moves.filter(m => m.type === "foundation").length;
  const stops = history.moves.filter(m => m.type === "stop").length;
  const penalties = history.moves.filter(m => m.type === "penalty").length;
  return { total, foundations, stops, penalties };
}
