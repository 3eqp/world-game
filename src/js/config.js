window.WorldGame = window.WorldGame || {};

window.WorldGame.Config = Object.freeze({
  WORLD: { width: 1600, height: 1000 },
  HOUSE_CAPACITY: 3,
  STORAGE_KEY: "world-game-save-v1",
  ZOOM: {
    min: 0.7,
    max: 3.2,
    step: 1.15
  },
  BUILDINGS: {
    market: { x: 780, y: 470, w: 110, h: 80, name: "Market" },
    farm: { x: 235, y: 610, w: 120, h: 90, name: "Farm" },
    sawmill: { x: 1090, y: 250, w: 130, h: 90, name: "Sawmill" },
    workshop: { x: 1210, y: 510, w: 120, h: 90, name: "Workshop" },
    clinic: { x: 910, y: 705, w: 120, h: 80, name: "Clinic" },
    townhall: { x: 665, y: 300, w: 120, h: 90, name: "Town Hall" }
  },
  ROLE_COLORS: {
    forager: "#d0d95c",
    farmer: "#63b35d",
    woodcutter: "#5f8f53",
    sawmill_worker: "#5fa3d1",
    carpenter: "#9d88d8",
    medic: "#db7070",
    unemployed: "#9f9f9f"
  },
  GOODS: ["food", "logs", "planks", "furniture", "herbs", "medkits"],
  BASE_PRICES: {
    food: 8,
    logs: 6,
    planks: 14,
    furniture: 32,
    herbs: 7,
    medkits: 22
  },
  NAMES: [
    "Arin", "Mila", "Nora", "Pavel", "Tara", "Ilya", "Romi", "Kian", "Vera", "Lana",
    "Oleg", "Dina", "Sava", "Mika", "Niko", "Yara", "Lio", "Soren", "Ada", "Kira"
  ]
});
