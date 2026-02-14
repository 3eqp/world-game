window.WorldGame = window.WorldGame || {};

window.WorldGame.Config = Object.freeze({
  WORLD: { width: 2800, height: 2600 },
  HOUSE_CAPACITY: 3,
  STORAGE_KEY: "world-game-save-v1",
  ZOOM: {
    min: 1,
    max: 3.2,
    step: 1.1,
    smoothness: 14,
    wheelStrength: 0.0009
  },
  PAN: {
    keyboardSpeed: 520
  },
  CAMERA: {
    lockScaleOnResize: true
  },
  ASSETS: {
    background: "assets/cute/grass.png",
    pathTile: "assets/cute/path.png",
    personSheet: "assets/cute/player.png",
    house: "assets/cute/house.png",
    market: "assets/cute/chest.png",
    farm: "assets/cute/farmland.png",
    townhall: "assets/cute/bridge.png",
    sawmill: "assets/cute/oak_tree_small.png",
    workshop: "assets/cute/decor_sheet.png",
    clinic: "assets/cute/cow.png",
    forest: "assets/cute/oak_tree.png",
    wild: "assets/cute/chicken.png",
    iconMarket: "assets/cute/chest.png",
    iconFarm: "assets/cute/farmland.png",
    iconTownhall: "assets/cute/sheep.png",
    iconSawmill: "assets/cute/oak_tree_small.png",
    iconWorkshop: "assets/cute/pig.png",
    iconClinic: "assets/cute/cow.png"
  },
  BUILDINGS: {
    market: { x: 1360, y: 860, w: 132, h: 94, name: "Market" },
    farm: { x: 510, y: 1120, w: 135, h: 98, name: "Farm" },
    townhall: { x: 1180, y: 590, w: 142, h: 98, name: "Town Hall" }
  },
  ROLE_COLORS: {
    forager: "#d0d95c",
    farmer: "#63b35d",
    woodcutter: "#5f8f53",
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
