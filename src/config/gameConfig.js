// gameConfig.js — Configuracion general del juego

export const DEFAULT_CONFIG = {
  victoryMode: "crapette",   // "crapette" o "all"
  aiLevel: "medium",         // "basic", "medium", "expert"
  aiSpeed: 1000,              // milisegundos entre jugadas de la IA
  penaltyEnabled: true,       // penalizacion por Stop invalido
};

export const AI_SPEED_OPTIONS = [
  { label: "Muy lento",  value: 2500 },
  { label: "Lento",      value: 1500 },
  { label: "Normal",     value: 1000 },
  { label: "Rapido",     value: 500  },
  { label: "Muy rapido", value: 150  },
];

export const AI_LEVEL_OPTIONS = [
  { label: "Basico",   value: "basic",  description: "Solo juega cartas evidentes a las fundaciones" },
  { label: "Medio",   value: "medium", description: "Mezcla jugadas simples y profundas al azar" },
  { label: "Experto", value: "expert", description: "Evalua todas las jugadas posibles" },
];

export const VICTORY_MODE_OPTIONS = [
  { label: "Vaciar Crapette", value: "crapette", description: "Gana quien vacie su Crapette primero" },
  { label: "Vaciar todo",     value: "all",      description: "Gana quien termine todas sus cartas" },
];
