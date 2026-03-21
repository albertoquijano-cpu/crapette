// gameConfig.js - Configuracion general del juego

export const DEFAULT_CONFIG = {
  victoryMode: "crapette",
  aiLevel: "medium",
  aiSpeed: 3000,
  penaltyEnabled: true,
};

export const AI_SPEED_OPTIONS = [
  { label: "Muy lento",  value: 8000 },
  { label: "Lento",      value: 5000 },
  { label: "Normal",     value: 3000 },
  { label: "Rapido",     value: 1500 },
  { label: "Muy rapido", value: 500  },
];

export const AI_LEVEL_OPTIONS = [
  { label: "Basico",   value: "basic",  description: "Solo juega cartas evidentes a las fundaciones" },
  { label: "Medio",    value: "medium", description: "Mezcla jugadas simples y profundas al azar" },
  { label: "Experto",  value: "expert", description: "Evalua todas las jugadas posibles" },
];

export const VICTORY_MODE_OPTIONS = [
  { label: "Vaciar Crapette", value: "crapette", description: "Gana quien vacie su Crapette primero" },
  { label: "Vaciar todo",     value: "all",      description: "Gana quien termine todas sus cartas" },
];
