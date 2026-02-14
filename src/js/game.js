(() => {
    const WG = window.WorldGame || {};
    const { Config, Camera, Storage } = WG;
    if (!Config || !Camera || !Storage) {
      throw new Error("WorldGame modules are not loaded.");
    }

    const {
      WORLD,
      HOUSE_CAPACITY,
      BUILDINGS,
      ROLE_COLORS,
      GOODS,
      BASE_PRICES,
      NAMES,
      STORAGE_KEY,
      ZOOM,
      PAN,
      CAMERA,
      ASSETS
    } = Config;

    const canvas = document.getElementById("world");
    const ctx = canvas.getContext("2d");

    const ui = {
      addPersonBtn: document.getElementById("addPersonBtn"),
      removeSelectedBtn: document.getElementById("removeSelectedBtn"),
      removeRandomBtn: document.getElementById("removeRandomBtn"),
      newSimBtn: document.getElementById("newSimBtn"),
      saveBtn: document.getElementById("saveBtn"),
      loadBtn: document.getElementById("loadBtn"),
      pauseBtn: document.getElementById("pauseBtn"),
      speed1Btn: document.getElementById("speed1Btn"),
      speed3Btn: document.getElementById("speed3Btn"),
      speed6Btn: document.getElementById("speed6Btn"),
      zoomOutBtn: document.getElementById("zoomOutBtn"),
      zoomResetBtn: document.getElementById("zoomResetBtn"),
      zoomInBtn: document.getElementById("zoomInBtn"),
      zoomStat: document.getElementById("zoomStat"),
      toolsMenuBtn: document.getElementById("toolsMenuBtn"),
      worldSettingsBtn: document.getElementById("worldSettingsBtn"),
      toggleResourcesBtn: document.getElementById("toggleResourcesBtn"),
      toolsPanel: document.getElementById("toolsPanel"),
      resourceMapBtn: document.getElementById("resourceMapBtn"),
      resourceWorldBtn: document.getElementById("resourceWorldBtn"),
      resourceList: document.getElementById("resourceList"),
      worldSettingsModal: document.getElementById("worldSettingsModal"),
      worldSettingsCloseBtn: document.getElementById("worldSettingsCloseBtn"),
      worldSettingsApplyBtn: document.getElementById("worldSettingsApplyBtn"),
      worldSettingsApplySaveBtn: document.getElementById("worldSettingsApplySaveBtn"),
      wsAutosaveInput: document.getElementById("wsAutosaveInput"),
      wsRoadDecayInput: document.getElementById("wsRoadDecayInput"),
      wsRoadStepInput: document.getElementById("wsRoadStepInput"),
      wsRoadSegmentInput: document.getElementById("wsRoadSegmentInput"),
      wsRoadThresholdInput: document.getElementById("wsRoadThresholdInput"),
      wsRegenForestInput: document.getElementById("wsRegenForestInput"),
      wsRegenWildFoodInput: document.getElementById("wsRegenWildFoodInput"),
      wsRegenWildHerbsInput: document.getElementById("wsRegenWildHerbsInput"),
      wsRegenOrchardInput: document.getElementById("wsRegenOrchardInput"),
      wsRegenFarmCropInput: document.getElementById("wsRegenFarmCropInput"),
      wsRegenFarmFertilityInput: document.getElementById("wsRegenFarmFertilityInput"),
      wsCostTownhallLogsInput: document.getElementById("wsCostTownhallLogsInput"),
      wsCostTownhallFoodInput: document.getElementById("wsCostTownhallFoodInput"),
      wsCostTownhallCashInput: document.getElementById("wsCostTownhallCashInput"),
      wsCostMarketLogsInput: document.getElementById("wsCostMarketLogsInput"),
      wsCostMarketFoodInput: document.getElementById("wsCostMarketFoodInput"),
      wsCostMarketCashInput: document.getElementById("wsCostMarketCashInput"),
      wsCostFarmLogsInput: document.getElementById("wsCostFarmLogsInput"),
      wsCostFarmFoodInput: document.getElementById("wsCostFarmFoodInput"),
      wsCostFarmCashInput: document.getElementById("wsCostFarmCashInput"),
      wsCostHouseLogsInput: document.getElementById("wsCostHouseLogsInput"),
      wsCostHouseFoodInput: document.getElementById("wsCostHouseFoodInput"),
      wsCostHouseCashInput: document.getElementById("wsCostHouseCashInput"),
      sidebar: document.querySelector(".sidebar"),
      rightbar: document.querySelector(".rightbar"),
      popStat: document.getElementById("popStat"),
      stageStat: document.getElementById("stageStat"),
      dayStat: document.getElementById("dayStat"),
      marketCashStat: document.getElementById("marketCashStat"),
      overlayText: document.getElementById("overlayText"),
      professionLegend: document.getElementById("professionLegend"),
      personCard: document.getElementById("personCard"),
      buildingCard: document.getElementById("buildingCard"),
      marketTable: document.getElementById("marketTable"),
      eventLog: document.getElementById("eventLog")
    };

    let state = createInitialState(false);
    const uiState = {
      toolsOpen: false,
      resourceView: "map",
      worldSettingsOpen: false
    };
    const camera = Camera.createCamera(WORLD, ZOOM, CAMERA);
    const view = camera.view;
    let autosaveIntervalSec = 20;
    let autosaveTimer = 0;
    let saveInFlight = false;
    let loadInFlight = false;
    let suppressNextClick = false;
    let isDragging = false;
    let dragLastX = 0;
    let dragLastY = 0;
    const keyState = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false
    };
    const LIFE_SPAN_DAYS = 100;
    const PROFESSIONS = ["forager", "farmer", "woodcutter"];
    const ROAD = {
      cell: 24,
      clickRadius: 18,
      drawThreshold: 0.7,
      clickThreshold: 1.1,
      decayPerHour: 0.1,
      addPerStep: 0.42,
      addPerSegment: 0.95,
      maxHeat: 48,
      maxEdgeHeat: 80
    };
    const BUILD_COSTS = {
      townhall: { logs: 14, food: 8, cash: 90 },
      market: { logs: 12, food: 10, cash: 80 },
      farm: { logs: 10, food: 6, cash: 65 },
      house: { logs: 8, food: 4, cash: 45 }
    };
    const REGEN = {
      forest: 0.004,
      wildFood: 0.012,
      wildHerbs: 0.007,
      orchardFood: 0.028,
      farmCrop: 0.085,
      farmFertility: 0.03
    };
    const SHEET_ANIMS = Object.freeze({
      person: {
        cols: 3,
        rows: 5,
        walkFrames: 3,
        walkFps: 8.5,
        idleRow: 4,
        idleFrame: 1,
        rowByFacing: {
          down: 0,
          left: 1,
          right: 2,
          up: 3
        }
      },
      wild: {
        cols: 4,
        rows: 4,
        frames: 4,
        fps: 5
      }
    });

    function normalizeFacing(v) {
      return v === "up" || v === "down" || v === "left" || v === "right" ? v : "down";
    }

    function createExperienceProfile(seedRole) {
      const profile = {
        forager: 0,
        farmer: 0,
        woodcutter: 0
      };
      if (seedRole && Object.prototype.hasOwnProperty.call(profile, seedRole)) {
        profile[seedRole] = rand(16, 34);
      }
      return profile;
    }

    function createInitialState(randomized) {
      const resourceScale = randomized ? rand(0.72, 1.35) : 1;
      const moneyScale = randomized ? rand(0.65, 1.45) : 1;
      return {
        paused: false,
        speed: 1,
        absHours: 0,
        day: 1,
        selectedId: null,
        selectedBuilding: null,
        selectedObject: null,
        nextPersonId: 1,
        people: [],
        graves: [],
        eventLog: [],
        roadHeat: {},
        roadEdges: {},
        city: {
          stage: "Wilderness",
          treasury: Math.round(380 * moneyScale),
          houses: [],
          furnitureLevel: Math.round(5 * resourceScale),
          companies: {},
          built: {
            townhall: true,
            market: true,
            farm: true
          }
        },
        market: {
          treasury: Math.round(2400 * moneyScale),
          stocks: {
            food: Math.round(24 * resourceScale),
            logs: Math.round(8 * resourceScale),
            planks: 0,
            furniture: 0,
            herbs: Math.round(10 * resourceScale),
            medkits: 0
          },
          demand: {
            food: 20,
            logs: 10,
            planks: 0,
            furniture: 0,
            herbs: 10,
            medkits: 4
          },
          prices: { ...BASE_PRICES }
        },
        resources: {
          forests: [
            { x: 2200, y: 430, wood: Math.round(170 * resourceScale), maxWood: Math.round(170 * resourceScale) },
            { x: 2440, y: 560, wood: Math.round(130 * resourceScale), maxWood: Math.round(130 * resourceScale) },
            { x: 2060, y: 350, wood: Math.round(95 * resourceScale), maxWood: Math.round(95 * resourceScale) },
            { x: 2320, y: 760, wood: Math.round(150 * resourceScale), maxWood: Math.round(150 * resourceScale) }
          ],
          orchards: [
            { x: 690, y: 1040, food: Math.round(120 * resourceScale), maxFood: Math.round(120 * resourceScale) },
            { x: 860, y: 1220, food: Math.round(95 * resourceScale), maxFood: Math.round(95 * resourceScale) },
            { x: 1020, y: 980, food: Math.round(110 * resourceScale), maxFood: Math.round(110 * resourceScale) }
          ],
          wild: [
            { x: 420, y: 560, food: Math.round(90 * resourceScale), herbs: Math.round(55 * resourceScale), maxFood: Math.round(90 * resourceScale), maxHerbs: Math.round(55 * resourceScale) },
            { x: 620, y: 450, food: Math.round(70 * resourceScale), herbs: Math.round(45 * resourceScale), maxFood: Math.round(70 * resourceScale), maxHerbs: Math.round(45 * resourceScale) },
            { x: 320, y: 760, food: Math.round(85 * resourceScale), herbs: Math.round(35 * resourceScale), maxFood: Math.round(85 * resourceScale), maxHerbs: Math.round(35 * resourceScale) },
            { x: 890, y: 620, food: Math.round(100 * resourceScale), herbs: Math.round(48 * resourceScale), maxFood: Math.round(100 * resourceScale), maxHerbs: Math.round(48 * resourceScale) }
          ],
          farm: {
            crop: Math.round(45 * resourceScale),
            maxCrop: Math.round(120 * resourceScale),
            fertility: Math.round(90 * resourceScale),
            maxFertility: Math.round(110 * resourceScale)
          }
        },
        worldSettings: defaultWorldSettings()
      };
    }

    function defaultWorldSettings() {
      return {
        autosaveIntervalSec: 20,
        road: {
          decayPerHour: 0.1,
          addPerStep: 0.42,
          addPerSegment: 0.95,
          drawThreshold: 0.7
        },
        regen: {
          forest: 0.004,
          wildFood: 0.012,
          wildHerbs: 0.007,
          orchardFood: 0.028,
          farmCrop: 0.085,
          farmFertility: 0.03
        },
        buildCosts: {
          townhall: { logs: 14, food: 8, cash: 90 },
          market: { logs: 12, food: 10, cash: 80 },
          farm: { logs: 10, food: 6, cash: 65 },
          house: { logs: 8, food: 4, cash: 45 }
        }
      };
    }

    function cloneWorldSettings(settings) {
      return {
        autosaveIntervalSec: settings.autosaveIntervalSec,
        road: { ...settings.road },
        regen: { ...settings.regen },
        buildCosts: {
          townhall: { ...settings.buildCosts.townhall },
          market: { ...settings.buildCosts.market },
          farm: { ...settings.buildCosts.farm },
          house: { ...settings.buildCosts.house }
        }
      };
    }

    function sanitizeNumber(rawValue, fallback, min, max, roundToInt = false) {
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) {
        return fallback;
      }
      const clamped = clamp(numeric, min, max);
      return roundToInt ? Math.round(clamped) : clamped;
    }

    function sanitizeCostBlock(rawCost, fallbackCost) {
      const source = rawCost && typeof rawCost === "object" ? rawCost : {};
      return {
        logs: sanitizeNumber(source.logs, fallbackCost.logs, 0, 999, true),
        food: sanitizeNumber(source.food, fallbackCost.food, 0, 999, true),
        cash: sanitizeNumber(source.cash, fallbackCost.cash, 0, 99999, true)
      };
    }

    function sanitizeWorldSettings(rawSettings) {
      const defaults = defaultWorldSettings();
      const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
      const rawRoad = source.road && typeof source.road === "object" ? source.road : {};
      const rawRegen = source.regen && typeof source.regen === "object" ? source.regen : {};
      const rawCosts = source.buildCosts && typeof source.buildCosts === "object" ? source.buildCosts : {};
      return {
        autosaveIntervalSec: sanitizeNumber(source.autosaveIntervalSec, defaults.autosaveIntervalSec, 5, 600, true),
        road: {
          decayPerHour: sanitizeNumber(rawRoad.decayPerHour, defaults.road.decayPerHour, 0.001, 2),
          addPerStep: sanitizeNumber(rawRoad.addPerStep, defaults.road.addPerStep, 0.05, 5),
          addPerSegment: sanitizeNumber(rawRoad.addPerSegment, defaults.road.addPerSegment, 0.1, 8),
          drawThreshold: sanitizeNumber(rawRoad.drawThreshold, defaults.road.drawThreshold, 0.1, 10)
        },
        regen: {
          forest: sanitizeNumber(rawRegen.forest, defaults.regen.forest, 0, 1),
          wildFood: sanitizeNumber(rawRegen.wildFood, defaults.regen.wildFood, 0, 1),
          wildHerbs: sanitizeNumber(rawRegen.wildHerbs, defaults.regen.wildHerbs, 0, 1),
          orchardFood: sanitizeNumber(rawRegen.orchardFood, defaults.regen.orchardFood, 0, 1),
          farmCrop: sanitizeNumber(rawRegen.farmCrop, defaults.regen.farmCrop, 0, 1),
          farmFertility: sanitizeNumber(rawRegen.farmFertility, defaults.regen.farmFertility, 0, 1)
        },
        buildCosts: {
          townhall: sanitizeCostBlock(rawCosts.townhall, defaults.buildCosts.townhall),
          market: sanitizeCostBlock(rawCosts.market, defaults.buildCosts.market),
          farm: sanitizeCostBlock(rawCosts.farm, defaults.buildCosts.farm),
          house: sanitizeCostBlock(rawCosts.house, defaults.buildCosts.house)
        }
      };
    }

    function applyWorldSettings(rawSettings) {
      const next = sanitizeWorldSettings(rawSettings);
      autosaveIntervalSec = next.autosaveIntervalSec;
      ROAD.decayPerHour = next.road.decayPerHour;
      ROAD.addPerStep = next.road.addPerStep;
      ROAD.addPerSegment = next.road.addPerSegment;
      ROAD.drawThreshold = next.road.drawThreshold;

      REGEN.forest = next.regen.forest;
      REGEN.wildFood = next.regen.wildFood;
      REGEN.wildHerbs = next.regen.wildHerbs;
      REGEN.orchardFood = next.regen.orchardFood;
      REGEN.farmCrop = next.regen.farmCrop;
      REGEN.farmFertility = next.regen.farmFertility;

      BUILD_COSTS.townhall = { ...next.buildCosts.townhall };
      BUILD_COSTS.market = { ...next.buildCosts.market };
      BUILD_COSTS.farm = { ...next.buildCosts.farm };
      BUILD_COSTS.house = { ...next.buildCosts.house };

      state.worldSettings = cloneWorldSettings(next);
      if (autosaveTimer > autosaveIntervalSec) {
        autosaveTimer = 0;
      }
      return next;
    }

    function clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }

    function rand(min, max) {
      return Math.random() * (max - min) + min;
    }

    function loadImage(url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      return img;
    }

    const sprites = {
      background: loadImage(ASSETS.background),
      pathTile: loadImage(ASSETS.pathTile),
      personSheet: loadImage(ASSETS.personSheet),
      house: loadImage(ASSETS.house),
      market: loadImage(ASSETS.market),
      farm: loadImage(ASSETS.farm),
      townhall: loadImage(ASSETS.townhall),
      sawmill: loadImage(ASSETS.sawmill),
      workshop: loadImage(ASSETS.workshop),
      clinic: loadImage(ASSETS.clinic),
      forest: loadImage(ASSETS.forest),
      wild: loadImage(ASSETS.wild),
      iconMarket: loadImage(ASSETS.iconMarket),
      iconFarm: loadImage(ASSETS.iconFarm),
      iconTownhall: loadImage(ASSETS.iconTownhall),
      iconSawmill: loadImage(ASSETS.iconSawmill),
      iconWorkshop: loadImage(ASSETS.iconWorkshop),
      iconClinic: loadImage(ASSETS.iconClinic)
    };
    const generatedBuildingSprites = {
      market: null,
      farm: null,
      townhall: null
    };

    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function addEvent(text) {
      state.eventLog.unshift(`[D${state.day} ${formatHour(currentHour())}] ${text}`);
      state.eventLog = state.eventLog.slice(0, 28);
    }

    function currentHour() {
      return state.absHours % 24;
    }

    function formatHour(h) {
      const hh = Math.floor(h);
      const mm = Math.floor((h - hh) * 60);
      return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
    }

    function createHouse(x, y) {
      return {
        x,
        y,
        w: 64,
        h: 48
      };
    }

    function hydrateState(rawState) {
      const base = createInitialState();
      const incoming = rawState && typeof rawState === "object" ? rawState : {};
      const incomingCity = incoming.city && typeof incoming.city === "object" ? incoming.city : {};
      const incomingMarket = incoming.market && typeof incoming.market === "object" ? incoming.market : {};
      const incomingResources = incoming.resources && typeof incoming.resources === "object" ? incoming.resources : {};

      state = { ...base, ...incoming };
      state.city = { ...base.city, ...incomingCity };
      state.city.companies = {};
      const incomingBuilt = incomingCity.built && typeof incomingCity.built === "object" ? incomingCity.built : null;
      if (incomingBuilt) {
        state.city.built = {
          townhall: Boolean(incomingBuilt.townhall),
          market: Boolean(incomingBuilt.market),
          farm: Boolean(incomingBuilt.farm)
        };
      } else {
        const legacyBuilt = true;
        state.city.built = {
          townhall: legacyBuilt,
          market: legacyBuilt,
          farm: legacyBuilt
        };
      }

      state.market = { ...base.market, ...incomingMarket };
      state.market.stocks = { ...base.market.stocks, ...(incomingMarket.stocks || {}) };
      state.market.demand = { ...base.market.demand, ...(incomingMarket.demand || {}) };
      state.market.prices = { ...base.market.prices, ...(incomingMarket.prices || {}) };

      state.resources = { ...base.resources, ...incomingResources };
      state.resources.farm = { ...base.resources.farm, ...(incomingResources.farm || {}) };
      state.resources.forests = Array.isArray(incomingResources.forests) ? incomingResources.forests : base.resources.forests;
      state.resources.orchards = Array.isArray(incomingResources.orchards) ? incomingResources.orchards : base.resources.orchards;
      state.resources.wild = Array.isArray(incomingResources.wild) ? incomingResources.wild : base.resources.wild;
      state.roadHeat = incoming.roadHeat && typeof incoming.roadHeat === "object" ? { ...incoming.roadHeat } : {};
      state.roadEdges = incoming.roadEdges && typeof incoming.roadEdges === "object" ? { ...incoming.roadEdges } : {};
      for (const k of Object.keys(state.roadHeat)) {
        const v = Number(state.roadHeat[k]);
        if (!Number.isFinite(v) || v <= 0.01) {
          delete state.roadHeat[k];
          continue;
        }
        state.roadHeat[k] = clamp(v, 0, ROAD.maxHeat);
      }
      for (const k of Object.keys(state.roadEdges)) {
        const v = Number(state.roadEdges[k]);
        if (!Number.isFinite(v) || v <= 0.01) {
          delete state.roadEdges[k];
          continue;
        }
        state.roadEdges[k] = clamp(v, 0, ROAD.maxEdgeHeat);
      }

      state.people = Array.isArray(incoming.people) ? incoming.people.map((p) => ({
        ...p,
        role: (typeof p.role === "string" && PROFESSIONS.includes(p.role)) ? p.role : "unemployed",
        baseProfession: (typeof p.baseProfession === "string" && PROFESSIONS.includes(p.baseProfession))
          ? p.baseProfession
          : ((typeof p.role === "string" && PROFESSIONS.includes(p.role)) ? p.role : pick(PROFESSIONS)),
        experience: {
          ...createExperienceProfile(),
          ...(p.experience && typeof p.experience === "object" ? p.experience : {})
        },
        switchPenaltyHours: Number.isFinite(p.switchPenaltyHours) ? Math.max(0, p.switchPenaltyHours) : 0,
        facing: normalizeFacing(p.facing),
        ageDays: Number.isFinite(p.ageDays)
          ? Math.max(0, p.ageDays)
          : (Number.isFinite(p.age)
            ? clamp((Math.max(0, p.age) / 80) * LIFE_SPAN_DAYS, 0, LIFE_SPAN_DAYS)
            : rand(18, 70)),
        hunger: Number.isFinite(p.hunger) ? clamp(p.hunger, 0, 100) : rand(20, 45),
        health: Number.isFinite(p.health) ? clamp(p.health, 0, 100) : rand(70, 95)
      })) : [];
      state.graves = Array.isArray(incoming.graves) ? incoming.graves : [];
      state.eventLog = Array.isArray(incoming.eventLog) ? incoming.eventLog.slice(0, 28) : [];
      state.city.houses = Array.isArray(incomingCity.houses) ? incomingCity.houses : [];

      const maxId = state.people.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
      state.nextPersonId = Math.max(Number(state.nextPersonId) || 1, maxId + 1);
      if (!state.people.some((p) => p.id === state.selectedId)) {
        state.selectedId = null;
      }
      if (typeof state.selectedBuilding !== "string" && state.selectedBuilding !== null) {
        state.selectedBuilding = null;
      }
      if (state.selectedBuilding && (
        state.selectedBuilding === "building:sawmill" ||
        state.selectedBuilding === "building:workshop" ||
        state.selectedBuilding === "building:clinic"
      )) {
        state.selectedBuilding = null;
      }
      if (state.selectedBuilding && state.selectedBuilding.startsWith("building:")) {
        const buildingKey = state.selectedBuilding.split(":")[1];
        if (!isBuildingBuilt(buildingKey)) {
          state.selectedBuilding = null;
        }
      }
      if (typeof state.selectedObject !== "string" && state.selectedObject !== null) {
        state.selectedObject = null;
      }
      if (![1, 3, 6].includes(state.speed)) {
        state.speed = 1;
      }
      if (typeof state.paused !== "boolean") {
        state.paused = false;
      }
      if (!Number.isFinite(state.absHours) || state.absHours < 0) {
        state.absHours = 0;
      }
      if (!Number.isFinite(state.day) || state.day < 1) {
        state.day = 1;
      }
      applyWorldSettings(incoming.worldSettings || state.worldSettings);
      computeDemandAndPrices();
      rebalanceJobs();
      syncUiToggles();
    }

    function syncUiToggles() {
      ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      if (state.speed === 6) {
        buttonSetActive(ui.speed6Btn);
      } else if (state.speed === 3) {
        buttonSetActive(ui.speed3Btn);
      } else {
        buttonSetActive(ui.speed1Btn);
      }
      updateZoomLabel();
      if (ui.toolsPanel) {
        ui.toolsPanel.classList.toggle("hidden", !uiState.toolsOpen);
      }
      if (ui.resourceMapBtn && ui.resourceWorldBtn) {
        ui.resourceMapBtn.classList.toggle("active", uiState.resourceView === "map");
        ui.resourceWorldBtn.classList.toggle("active", uiState.resourceView === "world");
      }
      if (ui.worldSettingsModal) {
        ui.worldSettingsModal.classList.toggle("hidden", !uiState.worldSettingsOpen);
      }
      document.body.classList.toggle("modal-open", uiState.worldSettingsOpen);
    }

    function updateZoomLabel() {
      if (!ui.zoomStat) {
        return;
      }
      ui.zoomStat.textContent = `Zoom: ${Math.round(view.zoom * 100)}%`;
    }

    function resetMovementKeys() {
      for (const code of Object.keys(keyState)) {
        keyState[code] = false;
      }
    }

    function isFormControlElement(target) {
      if (!target || typeof target !== "object") {
        return false;
      }
      const tagName = target.tagName;
      return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable === true;
    }

    function formatForInput(value, digits = 3) {
      if (Number.isInteger(value)) {
        return String(value);
      }
      return String(Number(value.toFixed(digits)));
    }

    function readWorldSettingsFromForm() {
      return {
        autosaveIntervalSec: ui.wsAutosaveInput ? ui.wsAutosaveInput.value : undefined,
        road: {
          decayPerHour: ui.wsRoadDecayInput ? ui.wsRoadDecayInput.value : undefined,
          addPerStep: ui.wsRoadStepInput ? ui.wsRoadStepInput.value : undefined,
          addPerSegment: ui.wsRoadSegmentInput ? ui.wsRoadSegmentInput.value : undefined,
          drawThreshold: ui.wsRoadThresholdInput ? ui.wsRoadThresholdInput.value : undefined
        },
        regen: {
          forest: ui.wsRegenForestInput ? ui.wsRegenForestInput.value : undefined,
          wildFood: ui.wsRegenWildFoodInput ? ui.wsRegenWildFoodInput.value : undefined,
          wildHerbs: ui.wsRegenWildHerbsInput ? ui.wsRegenWildHerbsInput.value : undefined,
          orchardFood: ui.wsRegenOrchardInput ? ui.wsRegenOrchardInput.value : undefined,
          farmCrop: ui.wsRegenFarmCropInput ? ui.wsRegenFarmCropInput.value : undefined,
          farmFertility: ui.wsRegenFarmFertilityInput ? ui.wsRegenFarmFertilityInput.value : undefined
        },
        buildCosts: {
          townhall: {
            logs: ui.wsCostTownhallLogsInput ? ui.wsCostTownhallLogsInput.value : undefined,
            food: ui.wsCostTownhallFoodInput ? ui.wsCostTownhallFoodInput.value : undefined,
            cash: ui.wsCostTownhallCashInput ? ui.wsCostTownhallCashInput.value : undefined
          },
          market: {
            logs: ui.wsCostMarketLogsInput ? ui.wsCostMarketLogsInput.value : undefined,
            food: ui.wsCostMarketFoodInput ? ui.wsCostMarketFoodInput.value : undefined,
            cash: ui.wsCostMarketCashInput ? ui.wsCostMarketCashInput.value : undefined
          },
          farm: {
            logs: ui.wsCostFarmLogsInput ? ui.wsCostFarmLogsInput.value : undefined,
            food: ui.wsCostFarmFoodInput ? ui.wsCostFarmFoodInput.value : undefined,
            cash: ui.wsCostFarmCashInput ? ui.wsCostFarmCashInput.value : undefined
          },
          house: {
            logs: ui.wsCostHouseLogsInput ? ui.wsCostHouseLogsInput.value : undefined,
            food: ui.wsCostHouseFoodInput ? ui.wsCostHouseFoodInput.value : undefined,
            cash: ui.wsCostHouseCashInput ? ui.wsCostHouseCashInput.value : undefined
          }
        }
      };
    }

    function fillWorldSettingsForm() {
      if (!ui.wsAutosaveInput) {
        return;
      }
      const settings = sanitizeWorldSettings(state.worldSettings);
      ui.wsAutosaveInput.value = formatForInput(settings.autosaveIntervalSec, 0);
      ui.wsRoadDecayInput.value = formatForInput(settings.road.decayPerHour);
      ui.wsRoadStepInput.value = formatForInput(settings.road.addPerStep);
      ui.wsRoadSegmentInput.value = formatForInput(settings.road.addPerSegment);
      ui.wsRoadThresholdInput.value = formatForInput(settings.road.drawThreshold);

      ui.wsRegenForestInput.value = formatForInput(settings.regen.forest);
      ui.wsRegenWildFoodInput.value = formatForInput(settings.regen.wildFood);
      ui.wsRegenWildHerbsInput.value = formatForInput(settings.regen.wildHerbs);
      ui.wsRegenOrchardInput.value = formatForInput(settings.regen.orchardFood);
      ui.wsRegenFarmCropInput.value = formatForInput(settings.regen.farmCrop);
      ui.wsRegenFarmFertilityInput.value = formatForInput(settings.regen.farmFertility);

      ui.wsCostTownhallLogsInput.value = formatForInput(settings.buildCosts.townhall.logs, 0);
      ui.wsCostTownhallFoodInput.value = formatForInput(settings.buildCosts.townhall.food, 0);
      ui.wsCostTownhallCashInput.value = formatForInput(settings.buildCosts.townhall.cash, 0);

      ui.wsCostMarketLogsInput.value = formatForInput(settings.buildCosts.market.logs, 0);
      ui.wsCostMarketFoodInput.value = formatForInput(settings.buildCosts.market.food, 0);
      ui.wsCostMarketCashInput.value = formatForInput(settings.buildCosts.market.cash, 0);

      ui.wsCostFarmLogsInput.value = formatForInput(settings.buildCosts.farm.logs, 0);
      ui.wsCostFarmFoodInput.value = formatForInput(settings.buildCosts.farm.food, 0);
      ui.wsCostFarmCashInput.value = formatForInput(settings.buildCosts.farm.cash, 0);

      ui.wsCostHouseLogsInput.value = formatForInput(settings.buildCosts.house.logs, 0);
      ui.wsCostHouseFoodInput.value = formatForInput(settings.buildCosts.house.food, 0);
      ui.wsCostHouseCashInput.value = formatForInput(settings.buildCosts.house.cash, 0);
    }

    function setWorldSettingsModalOpen(open) {
      uiState.worldSettingsOpen = Boolean(open);
      if (uiState.worldSettingsOpen) {
        fillWorldSettingsForm();
        resetMovementKeys();
      }
      syncUiToggles();
    }

    async function applyWorldSettingsFromForm(saveAfter) {
      applyWorldSettings(readWorldSettingsFromForm());
      fillWorldSettingsForm();
      addEvent("World settings applied.");
      if (saveAfter) {
        await saveToStorage(true);
      }
    }

    async function saveToStorage(manual) {
      if (saveInFlight) {
        return false;
      }
      saveInFlight = true;
      try {
        await Storage.saveGame(STORAGE_KEY, state, camera.getSnapshot());
        Storage.saveLocalBackup(STORAGE_KEY, state, camera.getSnapshot());
        if (manual) {
          addEvent("Game saved on server.");
        }
        return true;
      } catch (_err) {
        Storage.saveLocalBackup(STORAGE_KEY, state, camera.getSnapshot());
        if (manual) {
          addEvent("Server save failed. Local backup updated.");
        }
        return false;
      } finally {
        saveInFlight = false;
      }
    }

    async function loadFromStorage(manual) {
      if (loadInFlight) {
        return false;
      }
      loadInFlight = true;
      try {
        const payload = await Storage.loadGame(STORAGE_KEY);
        if (!payload) {
          const backup = Storage.loadLocalBackup(STORAGE_KEY);
          if (!backup) {
            if (manual) {
              addEvent("No saved game found.");
            }
            return false;
          }
          hydrateState(backup.state);
          resizeCanvas();
          camera.applySnapshot(backup.camera);
          syncUiToggles();
          if (manual) {
            addEvent("Server save not found. Local backup loaded.");
          }
          return true;
        }

        hydrateState(payload.state);
        resizeCanvas();
        camera.applySnapshot(payload.camera);
        syncUiToggles();
        Storage.saveLocalBackup(STORAGE_KEY, state, camera.getSnapshot());
        if (manual) {
          addEvent("Save loaded from server.");
        }
        return true;
      } catch (_err) {
        const backup = Storage.loadLocalBackup(STORAGE_KEY);
        if (backup) {
          hydrateState(backup.state);
          resizeCanvas();
          camera.applySnapshot(backup.camera);
          syncUiToggles();
          if (manual) {
            addEvent("Server load failed. Local backup loaded.");
          }
          return true;
        }
        if (manual) {
          addEvent("Load failed.");
        }
        return false;
      } finally {
        loadInFlight = false;
      }
    }

    function startNewSimulation() {
      const currentSettings = cloneWorldSettings(sanitizeWorldSettings(state.worldSettings));
      state = createInitialState(true);
      applyWorldSettings(currentSettings);
      initPopulation(Math.floor(rand(6, 11)));
      computeDemandAndPrices();
      camera.resetZoom();
      state.paused = false;
      autosaveTimer = 0;
      addEvent("New randomized simulation started.");
      syncUiToggles();
      resizeCanvas();
      saveToStorage(false);
    }

    function createPerson(opts = {}) {
      const id = state.nextPersonId++;
      const hasHomes = state.city.houses.length > 0;
      const homeIndex = hasHomes ? Math.floor(Math.random() * state.city.houses.length) : -1;
      const home = hasHomes ? state.city.houses[homeIndex] : null;
      const profession = pick(PROFESSIONS);
      const hub = BUILDINGS.townhall || { x: WORLD.width * 0.5 - 40, y: WORLD.height * 0.5 - 30, w: 80, h: 60 };
      const x = home ? home.x + rand(8, home.w - 8) : (hub.x + hub.w * 0.5 + rand(-65, 65));
      const y = home ? home.y + rand(8, home.h - 8) : (hub.y + hub.h * 0.5 + rand(-65, 65));
      const isBirth = opts.isBirth === true;
      const person = {
        id,
        name: isBirth ? `Newborn ${pick(NAMES)} #${id}` : `${pick(NAMES)} #${id}`,
        x,
        y,
        targetX: x,
        targetY: y,
        speed: rand(110, 145),
        ageDays: isBirth ? 0 : rand(18, 70),
        health: isBirth ? rand(82, 100) : rand(72, 100),
        hunger: isBirth ? rand(8, 22) : rand(18, 48),
        money: isBirth ? 0 : rand(16, 42),
        role: profession,
        baseProfession: profession,
        experience: createExperienceProfile(profession),
        switchPenaltyHours: 0,
        facing: "down",
        homeIndex,
        alive: true,
        task: null,
        inventory: {
          food: isBirth ? 0 : (Math.random() < 0.45 ? 1 : 0),
          logs: 0,
          planks: 0,
          furniture: 0,
          herbs: 0,
          medkits: 0
        }
      };
      state.people.push(person);
      return person;
    }

    function removePersonById(id, reason) {
      const idx = state.people.findIndex((p) => p.id === id);
      if (idx < 0) {
        return false;
      }
      const person = state.people[idx];
      state.people.splice(idx, 1);
      if (state.selectedId === id) {
        state.selectedId = null;
      }
      addEvent(`${person.name} removed (${reason}).`);
      return true;
    }

    function diePerson(person, reason) {
      person.alive = false;
      state.graves.push({ name: person.name, ageDays: person.ageDays, reason });
      removePersonById(person.id, reason);
      addEvent(`${person.name} died at day ${person.ageDays.toFixed(1)} (${reason}).`);
    }

    function initPopulation(count) {
      for (let i = 0; i < count; i++) {
        const p = createPerson();
        if (i === 0) {
          state.selectedId = p.id;
        }
      }
      rebalanceJobs();
    }

    function buttonSetActive(activeBtn) {
      [ui.speed1Btn, ui.speed3Btn, ui.speed6Btn].forEach((b) => b.classList.remove("active"));
      activeBtn.classList.add("active");
    }

    function setupUI() {
      ui.addPersonBtn.addEventListener("click", () => {
        const p = createPerson();
        state.selectedId = p.id;
        state.selectedBuilding = null;
        state.selectedObject = null;
        addEvent(`${p.name} joined the city.`);
        rebalanceJobs();
      });

      ui.removeSelectedBtn.addEventListener("click", () => {
        if (state.selectedId === null) {
          return;
        }
        removePersonById(state.selectedId, "player action");
        rebalanceJobs();
      });

      ui.removeRandomBtn.addEventListener("click", () => {
        if (state.people.length === 0) {
          return;
        }
        const p = pick(state.people);
        removePersonById(p.id, "random removal");
        rebalanceJobs();
      });

      ui.newSimBtn.addEventListener("click", () => {
        startNewSimulation();
      });

      ui.toolsMenuBtn.addEventListener("click", () => {
        uiState.toolsOpen = !uiState.toolsOpen;
        syncUiToggles();
      });

      if (ui.toggleResourcesBtn) {
        ui.toggleResourcesBtn.addEventListener("click", () => {
          uiState.resourceView = uiState.resourceView === "map" ? "world" : "map";
          syncUiToggles();
        });
      }

      if (ui.resourceMapBtn) {
        ui.resourceMapBtn.addEventListener("click", () => {
          uiState.resourceView = "map";
          syncUiToggles();
        });
      }

      if (ui.resourceWorldBtn) {
        ui.resourceWorldBtn.addEventListener("click", () => {
          uiState.resourceView = "world";
          syncUiToggles();
        });
      }

      ui.pauseBtn.addEventListener("click", () => {
        state.paused = !state.paused;
        ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      });

      ui.speed1Btn.addEventListener("click", () => {
        state.speed = 1;
        buttonSetActive(ui.speed1Btn);
      });

      ui.speed3Btn.addEventListener("click", () => {
        state.speed = 3;
        buttonSetActive(ui.speed3Btn);
      });

      ui.speed6Btn.addEventListener("click", () => {
        state.speed = 6;
        buttonSetActive(ui.speed6Btn);
      });

      ui.saveBtn.addEventListener("click", () => {
        saveToStorage(true);
      });

      ui.loadBtn.addEventListener("click", () => {
        loadFromStorage(true);
      });

      if (ui.worldSettingsBtn) {
        ui.worldSettingsBtn.addEventListener("click", () => {
          setWorldSettingsModalOpen(true);
        });
      }

      if (ui.worldSettingsCloseBtn) {
        ui.worldSettingsCloseBtn.addEventListener("click", () => {
          setWorldSettingsModalOpen(false);
        });
      }

      if (ui.worldSettingsModal) {
        ui.worldSettingsModal.addEventListener("click", (ev) => {
          if (ev.target === ui.worldSettingsModal) {
            setWorldSettingsModalOpen(false);
          }
        });
      }

      if (ui.worldSettingsApplyBtn) {
        ui.worldSettingsApplyBtn.addEventListener("click", async () => {
          await applyWorldSettingsFromForm(false);
        });
      }

      if (ui.worldSettingsApplySaveBtn) {
        ui.worldSettingsApplySaveBtn.addEventListener("click", async () => {
          await applyWorldSettingsFromForm(true);
          setWorldSettingsModalOpen(false);
        });
      }

      if (ui.zoomInBtn) {
        ui.zoomInBtn.addEventListener("click", () => {
          camera.zoomByFactor(ZOOM.step, canvas.width * 0.5, canvas.height * 0.5);
          updateZoomLabel();
        });
      }

      if (ui.zoomOutBtn) {
        ui.zoomOutBtn.addEventListener("click", () => {
          camera.zoomByFactor(1 / ZOOM.step, canvas.width * 0.5, canvas.height * 0.5);
          updateZoomLabel();
        });
      }

      if (ui.zoomResetBtn) {
        ui.zoomResetBtn.addEventListener("click", () => {
          camera.resetZoom();
          updateZoomLabel();
        });
      }

      canvas.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        const p = eventToCanvasPoint(ev);
        const sx = p.x;
        const sy = p.y;
        const wheelDelta = clamp(ev.deltaY, -240, 240);
        const factor = Math.exp(-wheelDelta * ZOOM.wheelStrength);
        camera.zoomByFactor(factor, sx, sy);
      }, { passive: false });

      canvas.addEventListener("mousedown", (ev) => {
        if (ev.button !== 0) {
          return;
        }
        const p = eventToCanvasPoint(ev);
        isDragging = true;
        dragLastX = p.x;
        dragLastY = p.y;
        canvas.classList.add("is-grabbing");
      });

      window.addEventListener("mousemove", (ev) => {
        if (!isDragging) {
          return;
        }
        const p = eventToCanvasPoint(ev);
        const dx = p.x - dragLastX;
        const dy = p.y - dragLastY;
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          suppressNextClick = true;
        }
        camera.panByPixels(dx, dy);
        dragLastX = p.x;
        dragLastY = p.y;
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
        canvas.classList.remove("is-grabbing");
      });

      window.addEventListener("keydown", (ev) => {
        if (ev.code === "Escape" && uiState.worldSettingsOpen) {
          setWorldSettingsModalOpen(false);
          ev.preventDefault();
          return;
        }
        if (uiState.worldSettingsOpen) {
          if (Object.prototype.hasOwnProperty.call(keyState, ev.code)) {
            keyState[ev.code] = false;
          }
          return;
        }
        if (isFormControlElement(ev.target)) {
          return;
        }
        if (Object.prototype.hasOwnProperty.call(keyState, ev.code)) {
          keyState[ev.code] = true;
          ev.preventDefault();
        }
      });

      window.addEventListener("keyup", (ev) => {
        if (uiState.worldSettingsOpen) {
          if (Object.prototype.hasOwnProperty.call(keyState, ev.code)) {
            keyState[ev.code] = false;
          }
          return;
        }
        if (isFormControlElement(ev.target)) {
          return;
        }
        if (Object.prototype.hasOwnProperty.call(keyState, ev.code)) {
          keyState[ev.code] = false;
          ev.preventDefault();
        }
      });

      canvas.addEventListener("click", (ev) => {
        if (suppressNextClick) {
          suppressNextClick = false;
          return;
        }
        const p = eventToCanvasPoint(ev);
        const sx = p.x;
        const sy = p.y;
        const worldPos = camera.screenToWorld(sx, sy);
        const wx = worldPos.x;
        const wy = worldPos.y;

        let chosen = null;
        let best = 999999;
        for (const p of state.people) {
          const d = Math.hypot(p.x - wx, p.y - wy);
          if (d < 12 && d < best) {
            best = d;
            chosen = p;
          }
        }

        if (chosen) {
          state.selectedId = chosen.id;
          state.selectedBuilding = null;
          state.selectedObject = null;
          return;
        }

        const objectId = findMapObjectAt(wx, wy);
        if (objectId) {
          state.selectedId = null;
          if (objectId.startsWith("building:") || objectId.startsWith("house:")) {
            state.selectedBuilding = objectId;
            state.selectedObject = null;
          } else {
            state.selectedBuilding = null;
            state.selectedObject = objectId;
          }
          return;
        }

        state.selectedId = null;
        state.selectedBuilding = null;
        state.selectedObject = null;
      });

      window.addEventListener("resize", resizeCanvas);
      syncUiToggles();
    }

    function eventToCanvasPoint(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      return { x, y };
    }

    function alivePeople() {
      return state.people;
    }

    function getPerson(id) {
      return state.people.find((p) => p.id === id) || null;
    }

    function isBuildingBuilt(key) {
      return Boolean(state.city && state.city.built && state.city.built[key]);
    }

    function hubPoint() {
      const h = BUILDINGS.townhall || { x: WORLD.width * 0.5 - 40, y: WORLD.height * 0.5 - 30, w: 80, h: 60 };
      return { x: h.x + h.w * 0.5, y: h.y + h.h * 0.5 };
    }

    function buildingTarget(key, fallbackOffsetX = 0, fallbackOffsetY = 0) {
      const b = BUILDINGS[key];
      if (b && isBuildingBuilt(key)) {
        return { x: b.x + b.w * 0.5, y: b.y + b.h * 0.5 };
      }
      const hub = hubPoint();
      return { x: hub.x + fallbackOffsetX, y: hub.y + fallbackOffsetY };
    }

    function buildingRole(key) {
      if (key === "farm") return "farmer";
      if (key === "townhall") return "unemployed";
      return null;
    }

    function workersForBuilding(key) {
      const role = buildingRole(key);
      if (!role) {
        return [];
      }
      return state.people.filter((p) => p.role === role);
    }

    function workersBusyAt(taskTypes) {
      const set = new Set(taskTypes);
      return state.people.filter((p) => p.task && set.has(p.task.type)).length;
    }

    function findBuildingAt(x, y) {
      for (let i = 0; i < state.city.houses.length; i++) {
        const h = state.city.houses[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
          return `house:${i}`;
        }
      }

      const order = ["market", "farm", "townhall"];
      for (const key of order) {
        const b = BUILDINGS[key];
        if (!b) {
          continue;
        }
        if (!isBuildingBuilt(key)) {
          continue;
        }
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          return `building:${key}`;
        }
      }
      return null;
    }

    function isSelectedBuilding(id) {
      return state.selectedBuilding === id;
    }

    function isSelectedObject(id) {
      return state.selectedObject === id;
    }

    function roadKey(gx, gy) {
      return `${gx}:${gy}`;
    }

    function roadEdgeKey(gx1, gy1, gx2, gy2) {
      const a = `${gx1}:${gy1}`;
      const b = `${gx2}:${gy2}`;
      return a <= b ? `${a}|${b}` : `${b}|${a}`;
    }

    function roadCellFromPos(x, y) {
      return {
        gx: Math.floor(x / ROAD.cell),
        gy: Math.floor(y / ROAD.cell)
      };
    }

    function addRoadHeatAt(gx, gy, amount) {
      if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(amount) || amount <= 0) {
        return;
      }
      const key = roadKey(gx, gy);
      const prev = Number(state.roadHeat[key]) || 0;
      state.roadHeat[key] = clamp(prev + amount, 0, ROAD.maxHeat);
    }

    function addRoadEdgeAt(gx1, gy1, gx2, gy2, amount) {
      if (!Number.isFinite(gx1) || !Number.isFinite(gy1) || !Number.isFinite(gx2) || !Number.isFinite(gy2) || !Number.isFinite(amount) || amount <= 0) {
        return;
      }
      if (gx1 === gx2 && gy1 === gy2) {
        return;
      }
      const key = roadEdgeKey(gx1, gy1, gx2, gy2);
      const prev = Number(state.roadEdges[key]) || 0;
      state.roadEdges[key] = clamp(prev + amount, 0, ROAD.maxEdgeHeat);
    }

    function addRoadSegment(x1, y1, x2, y2, amount = ROAD.addPerSegment) {
      const a = roadCellFromPos(x1, y1);
      const b = roadCellFromPos(x2, y2);
      const dx = b.gx - a.gx;
      const dy = b.gy - a.gy;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      if (steps === 0) {
        addRoadHeatAt(a.gx, a.gy, amount * 0.45);
        return;
      }
      let prevX = a.gx;
      let prevY = a.gy;
      addRoadHeatAt(prevX, prevY, amount * 0.25);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const gx = Math.round(a.gx + dx * t);
        const gy = Math.round(a.gy + dy * t);
        addRoadHeatAt(gx, gy, amount * 0.45);
        addRoadEdgeAt(prevX, prevY, gx, gy, amount);
        prevX = gx;
        prevY = gy;
      }
    }

    function addRoadFootstep(x, y, amount = ROAD.addPerStep) {
      const cell = roadCellFromPos(x, y);
      addRoadHeatAt(cell.gx, cell.gy, amount);
    }

    function decayRoadHeat(dtHours) {
      const loss = ROAD.decayPerHour * dtHours;
      if (loss <= 0) {
        return;
      }
      for (const key of Object.keys(state.roadHeat)) {
        const next = (Number(state.roadHeat[key]) || 0) - loss;
        if (next <= 0.01) {
          delete state.roadHeat[key];
        } else {
          state.roadHeat[key] = next;
        }
      }
      for (const key of Object.keys(state.roadEdges)) {
        const next = (Number(state.roadEdges[key]) || 0) - loss;
        if (next <= 0.01) {
          delete state.roadEdges[key];
        } else {
          state.roadEdges[key] = next;
        }
      }
    }

    function roadCells(minHeat = ROAD.drawThreshold) {
      const cells = [];
      for (const [key, raw] of Object.entries(state.roadHeat)) {
        const heat = Number(raw) || 0;
        if (heat < minHeat) {
          continue;
        }
        const parts = key.split(":");
        const gx = Number(parts[0]);
        const gy = Number(parts[1]);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
          continue;
        }
        cells.push({
          key,
          gx,
          gy,
          heat,
          cx: gx * ROAD.cell + ROAD.cell * 0.5,
          cy: gy * ROAD.cell + ROAD.cell * 0.5
        });
      }
      return cells;
    }

    function roadEdges(minHeat = ROAD.drawThreshold) {
      const edges = [];
      for (const [key, raw] of Object.entries(state.roadEdges)) {
        const heat = Number(raw) || 0;
        if (heat < minHeat) {
          continue;
        }
        const pair = key.split("|");
        if (pair.length !== 2) {
          continue;
        }
        const a = pair[0].split(":");
        const b = pair[1].split(":");
        const gx1 = Number(a[0]);
        const gy1 = Number(a[1]);
        const gx2 = Number(b[0]);
        const gy2 = Number(b[1]);
        if (!Number.isFinite(gx1) || !Number.isFinite(gy1) || !Number.isFinite(gx2) || !Number.isFinite(gy2)) {
          continue;
        }
        const x1 = gx1 * ROAD.cell + ROAD.cell * 0.5;
        const y1 = gy1 * ROAD.cell + ROAD.cell * 0.5;
        const x2 = gx2 * ROAD.cell + ROAD.cell * 0.5;
        const y2 = gy2 * ROAD.cell + ROAD.cell * 0.5;
        edges.push({ key, gx1, gy1, gx2, gy2, x1, y1, x2, y2, heat });
      }
      return edges;
    }

    function findRoadAt(x, y) {
      let bestId = null;
      let bestDist = Infinity;
      for (const c of roadCells(ROAD.clickThreshold * 0.6)) {
        const d = Math.hypot(c.cx - x, c.cy - y);
        if (d <= ROAD.clickRadius && d < bestDist) {
          bestDist = d;
          bestId = `road:${c.key}`;
        }
      }
      if (bestId) {
        return bestId;
      }
      for (const e of roadEdges(ROAD.clickThreshold)) {
        const vx = e.x2 - e.x1;
        const vy = e.y2 - e.y1;
        const lenSq = vx * vx + vy * vy || 1;
        const t = clamp(((x - e.x1) * vx + (y - e.y1) * vy) / lenSq, 0, 1);
        const px = e.x1 + vx * t;
        const py = e.y1 + vy * t;
        const d = Math.hypot(px - x, py - y);
        if (d <= ROAD.clickRadius && d < bestDist) {
          bestDist = d;
          bestId = `road:${roadKey(Math.round((px - ROAD.cell * 0.5) / ROAD.cell), Math.round((py - ROAD.cell * 0.5) / ROAD.cell))}`;
        }
      }
      return bestId;
    }

    function findMapObjectAt(x, y) {
      const buildingId = findBuildingAt(x, y);
      if (buildingId) {
        return buildingId;
      }
      for (let i = 0; i < state.resources.wild.length; i++) {
        const p = state.resources.wild[i];
        if (Math.hypot(p.x - x, p.y - y) <= 46) {
          return `wild:${i}`;
        }
      }
      for (let i = 0; i < state.resources.orchards.length; i++) {
        const o = state.resources.orchards[i];
        if (Math.hypot(o.x - x, o.y - y) <= 44) {
          return `orchard:${i}`;
        }
      }
      for (let i = 0; i < state.resources.forests.length; i++) {
        const f = state.resources.forests[i];
        if (Math.hypot(f.x - x, f.y - y) <= 50) {
          return `forest:${i}`;
        }
      }
      return findRoadAt(x, y);
    }

    function inventoryTotal(person) {
      return GOODS.reduce((sum, g) => sum + person.inventory[g], 0);
    }

    function sellableUnits(person) {
      let total = 0;
      for (const g of GOODS) {
        let reserve = 0;
        if (g === "food") {
          reserve = person.hunger > 30 ? 1 : 0;
        }
        if (g === "medkits") {
          reserve = person.health < 55 ? 1 : 0;
        }
        total += Math.max(0, person.inventory[g] - reserve);
      }
      return total;
    }

    function taskRole(taskType) {
      if (taskType === "gather_food" || taskType === "gather_herbs" || taskType === "gather_orchard_food") return "forager";
      if (taskType === "harvest_farm" || taskType === "tend_farm") return "farmer";
      if (taskType === "chop_wood") return "woodcutter";
      if (taskType === "make_planks") return "sawmill_worker";
      if (taskType === "make_furniture") return "carpenter";
      if (taskType === "make_medkit") return "medic";
      return null;
    }

    function getExperience(person, role) {
      if (!role || !person.experience) {
        return 0;
      }
      return clamp(Number(person.experience[role]) || 0, 0, 100);
    }

    function addExperience(person, role, amount) {
      if (!role || !person.experience || !Number.isFinite(amount) || amount <= 0) {
        return;
      }
      person.experience[role] = clamp((Number(person.experience[role]) || 0) + amount, 0, 100);
    }

    function roleEfficiency(person, role) {
      const exp = getExperience(person, role);
      const expFactor = 0.62 + exp * 0.0068;
      const penaltyFactor = person.switchPenaltyHours > 0 ? 0.42 : 1;
      const baseBonus = person.baseProfession === role ? 1.05 : 1;
      return expFactor * penaltyFactor * baseBonus;
    }

    function assignRole(person, newRole) {
      if (person.role === newRole) {
        return;
      }
      const oldRole = person.role;
      person.role = newRole;
      if (newRole !== "unemployed" && oldRole !== "unemployed") {
        person.switchPenaltyHours = 72;
        person.health = clamp(person.health - 8, 0, 100);
        person.hunger = clamp(person.hunger + 14, 0, 100);
        addEvent(`${person.name} switched profession ${roleLabel(oldRole)} -> ${roleLabel(newRole)} and is adapting.`);
      }
    }

    function moveToward(person, tx, ty, dtHours) {
      const dx = tx - person.x;
      const dy = ty - person.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        if (Math.abs(dx) > Math.abs(dy)) {
          person.facing = dx >= 0 ? "right" : "left";
        } else {
          person.facing = dy >= 0 ? "down" : "up";
        }
      }
      if (dist <= 0.001) {
        person.x = tx;
        person.y = ty;
        addRoadFootstep(person.x, person.y, ROAD.addPerStep * 0.35);
        return true;
      }
      const step = person.speed * dtHours;
      if (step >= dist) {
        person.x = tx;
        person.y = ty;
        addRoadFootstep(person.x, person.y, ROAD.addPerStep * 0.7);
        return true;
      }
      person.x += (dx / dist) * step;
      person.y += (dy / dist) * step;
      addRoadFootstep(person.x, person.y);
      return false;
    }

    function createTask(type, target, durationHours, meta = null) {
      const task = {
        type,
        phase: "act",
        targetX: target ? target.x : null,
        targetY: target ? target.y : null,
        remaining: durationHours,
        meta
      };
      if (target) {
        task.phase = "move";
      }
      return task;
    }

    function nearestPatchWith(type) {
      let best = null;
      let bestValue = -1;
      for (let i = 0; i < state.resources.wild.length; i++) {
        const patch = state.resources.wild[i];
        if (patch[type] > bestValue) {
          bestValue = patch[type];
          best = { patch, index: i };
        }
      }
      return best;
    }

    function richestOrchard() {
      let best = null;
      let bestValue = -1;
      for (let i = 0; i < state.resources.orchards.length; i++) {
        const orchard = state.resources.orchards[i];
        if (orchard.food > bestValue) {
          bestValue = orchard.food;
          best = { orchard, index: i };
        }
      }
      return best;
    }

    function richestForest() {
      let best = null;
      let bestValue = -1;
      for (let i = 0; i < state.resources.forests.length; i++) {
        const forest = state.resources.forests[i];
        if (forest.wood > bestValue) {
          bestValue = forest.wood;
          best = { forest, index: i };
        }
      }
      return best;
    }

    function pickWorkTask(person) {
      const demand = state.market.demand;
      const stocks = state.market.stocks;

      if (person.role === "forager") {
        const herbsShortage = demand.herbs - stocks.herbs;
        const foodShortage = demand.food - stocks.food;
        if (herbsShortage > foodShortage) {
          const best = nearestPatchWith("herbs");
          if (best && best.patch.herbs > 1) {
            return createTask("gather_herbs", { x: best.patch.x, y: best.patch.y }, 1.8, { patchIndex: best.index });
          }
        }
        const orchard = richestOrchard();
        const bestFood = nearestPatchWith("food");
        const orchardFood = orchard ? orchard.orchard.food : 0;
        const wildFood = bestFood ? bestFood.patch.food : 0;
        if (orchard && orchardFood >= wildFood && orchardFood > 1) {
          return createTask("gather_orchard_food", { x: orchard.orchard.x, y: orchard.orchard.y }, 1.6, { orchardIndex: orchard.index });
        }
        if (bestFood && wildFood > 1) {
          return createTask("gather_food", { x: bestFood.patch.x, y: bestFood.patch.y }, 1.7, { patchIndex: bestFood.index });
        }
        return createTask("idle", buildingTarget("townhall"), 1.5);
      }

      if (person.role === "woodcutter") {
        const logsGap = demand.logs - stocks.logs;
        const forest = richestForest();
        if (logsGap > 0 && forest && forest.forest.wood > 1.5) {
          return createTask("chop_wood", { x: forest.forest.x, y: forest.forest.y }, 2.2, { forestIndex: forest.index });
        }
        return createTask("idle", buildingTarget("townhall"), 1.4);
      }

      if (person.role === "farmer") {
        if (!isBuildingBuilt("farm")) {
          const orchard = richestOrchard();
          const bestFood = nearestPatchWith("food");
          const orchardFood = orchard ? orchard.orchard.food : 0;
          const wildFood = bestFood ? bestFood.patch.food : 0;
          if (orchard && orchardFood >= wildFood && orchardFood > 1) {
            return createTask("gather_orchard_food", { x: orchard.orchard.x, y: orchard.orchard.y }, 1.6, { orchardIndex: orchard.index });
          }
          if (bestFood && wildFood > 1) {
            return createTask("gather_food", { x: bestFood.patch.x, y: bestFood.patch.y }, 1.7, { patchIndex: bestFood.index });
          }
          return createTask("idle", buildingTarget("townhall"), 1.4);
        }
        if (state.resources.farm.crop > 1.2) {
          return createTask("harvest_farm", { x: BUILDINGS.farm.x + 55, y: BUILDINGS.farm.y + 40 }, 1.9);
        }
        return createTask("tend_farm", { x: BUILDINGS.farm.x + 70, y: BUILDINGS.farm.y + 50 }, 1.8);
      }
      return createTask("idle", buildingTarget("townhall"), 1.2);
    }

    function decideTask(person) {
      if (person.health < 55 && person.inventory.medkits > 0) {
        return createTask("use_medkit", null, 0.1);
      }
      if (person.hunger >= 32) {
        if (person.inventory.food > 0 && person.hunger >= 28) {
          return createTask("eat_food", null, 0.1);
        }
        if (isBuildingBuilt("market") && person.hunger >= 55 && state.market.stocks.food > 0 && person.money >= state.market.prices.food) {
          return createTask("buy_food", { x: BUILDINGS.market.x + 55, y: BUILDINGS.market.y + 42 }, 0.5);
        }
      }
      if (sellableUnits(person) > 0) {
        return createTask("sell_goods", buildingTarget("market", 18, 8), 0.7);
      }
      return pickWorkTask(person);
    }

    function executeTask(person, task) {
      const market = state.market;
      const farm = state.resources.farm;

      if (task.type === "eat_food") {
        if (person.inventory.food > 0 && person.hunger >= 18) {
          person.inventory.food -= 1;
          person.hunger = clamp(person.hunger - 46, 0, 100);
        }
        return;
      }

      if (task.type === "use_medkit") {
        if (person.inventory.medkits > 0) {
          person.inventory.medkits -= 1;
          person.health = clamp(person.health + 36, 0, 100);
        }
        return;
      }

      if (task.type === "buy_food") {
        if (market.stocks.food > 0 && person.money >= market.prices.food) {
          market.stocks.food -= 1;
          person.money -= market.prices.food;
          market.treasury += market.prices.food;
          person.inventory.food += 1;
        }
        return;
      }

      if (task.type === "buy_medkit") {
        if (market.stocks.medkits > 0 && person.money >= market.prices.medkits) {
          market.stocks.medkits -= 1;
          person.money -= market.prices.medkits;
          market.treasury += market.prices.medkits;
          person.inventory.medkits += 1;
        }
        return;
      }

      if (task.type === "sell_goods") {
        for (const good of GOODS) {
          let reserve = 0;
          if (good === "food" && person.hunger > 30) {
            reserve = 1;
          }
          if (good === "medkits" && person.health < 55) {
            reserve = 1;
          }
          const qty = Math.max(0, person.inventory[good] - reserve);
          if (qty <= 0) {
            continue;
          }
          const unit = Math.max(1, Math.floor(market.prices[good] * (good === "logs" || good === "herbs" ? 0.9 : 0.96)));
          const canBuyUnits = Math.floor(market.treasury / unit);
          const sold = Math.min(qty, canBuyUnits);
          if (sold <= 0) {
            continue;
          }
          person.inventory[good] -= sold;
          market.stocks[good] += sold;
          market.treasury -= sold * unit;
          person.money += sold * unit;
        }
        return;
      }

      if (task.type === "gather_food") {
        const patch = state.resources.wild[task.meta.patchIndex];
        if (patch && patch.food > 0.4) {
          const amount = Math.min(patch.food, rand(1.4, 3.1) * roleEfficiency(person, "forager"));
          patch.food -= amount;
          person.inventory.food += Math.floor(amount);
          addExperience(person, "forager", 1.2);
        }
        return;
      }

      if (task.type === "gather_orchard_food") {
        const orchard = state.resources.orchards[task.meta.orchardIndex];
        if (orchard && orchard.food > 0.4) {
          const amount = Math.min(orchard.food, rand(1.7, 3.6) * roleEfficiency(person, "forager"));
          orchard.food -= amount;
          person.inventory.food += Math.floor(amount);
          addExperience(person, "forager", 1.4);
        }
        return;
      }

      if (task.type === "gather_herbs") {
        const patch = state.resources.wild[task.meta.patchIndex];
        if (patch && patch.herbs > 0.4) {
          const amount = Math.min(patch.herbs, rand(1.0, 2.4) * roleEfficiency(person, "forager"));
          patch.herbs -= amount;
          person.inventory.herbs += Math.floor(amount);
          addExperience(person, "forager", 1.1);
        }
        return;
      }

      if (task.type === "chop_wood") {
        const forest = state.resources.forests[task.meta.forestIndex];
        if (forest && forest.wood > 0.6) {
          const amount = Math.min(forest.wood, rand(1.5, 3.5) * roleEfficiency(person, "woodcutter"));
          forest.wood -= amount;
          person.inventory.logs += Math.floor(amount);
          addExperience(person, "woodcutter", 1.35);
        }
        return;
      }

      if (task.type === "harvest_farm") {
        if (farm.crop > 0.6) {
          const amount = Math.min(farm.crop, rand(1.8, 4.2) * roleEfficiency(person, "farmer"));
          farm.crop -= amount;
          farm.fertility = clamp(farm.fertility - amount * 0.9, 0, farm.maxFertility);
          person.inventory.food += Math.floor(amount);
          addExperience(person, "farmer", 1.4);
        }
        return;
      }

      if (task.type === "tend_farm") {
        farm.fertility = clamp(farm.fertility + rand(1.8, 4.6), 0, farm.maxFertility);
        addExperience(person, "farmer", 0.8);
        return;
      }

      if (task.type === "make_planks") {
        if (market.stocks.logs >= 2 && market.demand.planks > market.stocks.planks) {
          market.stocks.logs -= 2;
          const gain = Math.max(1, Math.round(roleEfficiency(person, "sawmill_worker")));
          market.stocks.planks += gain;
          const wage = Math.round(5 * roleEfficiency(person, "sawmill_worker"));
          person.money += wage;
          state.city.treasury = Math.max(0, state.city.treasury - wage);
          addExperience(person, "sawmill_worker", 1.45);
        }
        return;
      }

      if (task.type === "make_furniture") {
        if (market.stocks.planks >= 2 && market.demand.furniture > market.stocks.furniture) {
          market.stocks.planks -= 2;
          const gain = Math.max(1, Math.round(roleEfficiency(person, "carpenter")));
          market.stocks.furniture += gain;
          const wage = Math.round(8 * roleEfficiency(person, "carpenter"));
          person.money += wage;
          state.city.treasury = Math.max(0, state.city.treasury - wage);
          addExperience(person, "carpenter", 1.55);
        }
        return;
      }

      if (task.type === "make_medkit") {
        if (market.stocks.herbs >= 2 && market.demand.medkits > market.stocks.medkits) {
          market.stocks.herbs -= 2;
          const gain = Math.max(1, Math.round(roleEfficiency(person, "medic")));
          market.stocks.medkits += gain;
          const wage = Math.round(6 * roleEfficiency(person, "medic"));
          person.money += wage;
          state.city.treasury = Math.max(0, state.city.treasury - wage);
          addExperience(person, "medic", 1.5);
        }
        return;
      }
    }

    function updatePersonNeeds(person, dtHours) {
      person.ageDays += dtHours / 24;

      const workLoad = person.task && person.task.type !== "idle" ? 1 : 0;
      person.hunger = clamp(person.hunger + dtHours * (0.82 + workLoad * 0.28), 0, 100);
      if (person.switchPenaltyHours > 0) {
        person.switchPenaltyHours = Math.max(0, person.switchPenaltyHours - dtHours);
        person.hunger = clamp(person.hunger + dtHours * 0.22, 0, 100);
      }

      let healthDecay = dtHours * 0.07;
      if (person.ageDays > 60) {
        healthDecay += dtHours * (person.ageDays - 60) * 0.0025;
      }
      if (person.ageDays > 85) {
        healthDecay += dtHours * (person.ageDays - 85) * 0.005;
      }
      if (person.hunger > 42) {
        healthDecay += dtHours * 0.25;
      }
      if (person.hunger > 72) {
        healthDecay += dtHours * 0.56;
      }
      if (person.switchPenaltyHours > 0) {
        healthDecay += dtHours * 0.18;
      }

      person.health = clamp(person.health - healthDecay, 0, 100);

      if (person.hunger <= 24 && person.health < 95) {
        person.health = clamp(person.health + dtHours * 0.03, 0, 100);
      }
    }

    function updatePeople(dtHours) {
      const arr = [...state.people];
      for (const person of arr) {
        if (!person.alive) {
          continue;
        }

        updatePersonNeeds(person, dtHours);

        if (person.health <= 0 || person.ageDays >= LIFE_SPAN_DAYS) {
          diePerson(person, person.ageDays >= LIFE_SPAN_DAYS ? "old age" : "health collapse");
          continue;
        }

        if (!person.task) {
          person.task = decideTask(person);
        }

        const task = person.task;
        if (!task) {
          continue;
        }

        if (task.phase === "move") {
          const done = moveToward(person, task.targetX, task.targetY, dtHours);
          if (done) {
            task.phase = "act";
          }
        } else {
          task.remaining -= dtHours;
          if (task.remaining <= 0) {
            executeTask(person, task);
            person.task = null;
          }
        }
      }
    }

    function computeDemandAndPrices() {
      const pop = state.people.length;
      const houses = state.city.houses.length;
      const constructionNeed = Math.max(0, Math.ceil((pop - houses * HOUSE_CAPACITY) / HOUSE_CAPACITY));
      const foodNeed = Math.ceil(pop * 2.6 + 5);
      const logsNeed = 10 + constructionNeed * 8;

      state.market.demand.food = Math.max(4, foodNeed);
      state.market.demand.logs = Math.max(8, Math.ceil(logsNeed));
      state.market.demand.planks = 0;
      state.market.demand.furniture = 0;
      state.market.demand.herbs = 0;
      state.market.demand.medkits = 0;

      for (const good of GOODS) {
        const supply = state.market.stocks[good] + 1;
        const demand = state.market.demand[good] + 1;
        const scarcity = clamp(demand / supply, 0.45, 2.6);
        const price = Math.round(BASE_PRICES[good] * scarcity);
        state.market.prices[good] = Math.max(1, price);
      }
    }

    function rebalanceJobs() {
      const pop = state.people.length;
      if (pop <= 0) {
        return;
      }

      const demand = state.market.demand;
      const stocks = state.market.stocks;

      const foodGap = Math.max(0, demand.food - stocks.food);
      const logsGap = Math.max(0, demand.logs - stocks.logs);

      const wants = {
        farmer: Math.max(1, Math.ceil(foodGap / 18)),
        forager: Math.max(1, Math.ceil((foodGap * 0.5) / 16)),
        woodcutter: Math.ceil(logsGap / 15)
      };

      const priority = ["farmer", "forager", "woodcutter"];
      const roleCounts = {
        forager: 0,
        farmer: 0,
        woodcutter: 0,
        unemployed: 0
      };
      for (const p of state.people) {
        if (Object.prototype.hasOwnProperty.call(roleCounts, p.role)) {
          roleCounts[p.role] += 1;
        } else {
          roleCounts.unemployed += 1;
        }
      }

      function roleScore(person, targetRole) {
        const exp = getExperience(person, targetRole);
        const sameRoleBonus = person.role === targetRole ? 80 : 0;
        const baseBonus = person.baseProfession === targetRole ? 35 : 0;
        const switchPenalty = person.role !== targetRole ? (person.switchPenaltyHours > 0 ? 120 : 45) : 0;
        const condition = person.health + (100 - person.hunger);
        return exp * 3 + sameRoleBonus + baseBonus + condition - switchPenalty;
      }

      function bestCandidate(targetRole) {
        const candidates = state.people
          .filter((p) => p.role !== targetRole)
          .sort((a, b) => roleScore(b, targetRole) - roleScore(a, targetRole));
        return candidates.length > 0 ? candidates[0] : null;
      }

      for (const role of priority) {
        const target = clamp(wants[role], 0, pop);
        while (roleCounts[role] < target) {
          const candidate = bestCandidate(role);
          if (!candidate) {
            break;
          }
          const prev = candidate.role;
          assignRole(candidate, role);
          if (Object.prototype.hasOwnProperty.call(roleCounts, prev)) {
            roleCounts[prev] = Math.max(0, roleCounts[prev] - 1);
          } else {
            roleCounts.unemployed = Math.max(0, roleCounts.unemployed - 1);
          }
          roleCounts[role] += 1;
        }
      }

      for (const p of state.people) {
        if (!priority.includes(p.role)) {
          assignRole(p, "unemployed");
        }
      }

      for (const p of state.people) {
        if (p.task && p.task.type.startsWith("make_") && p.role === "unemployed") {
          p.task = null;
        }
      }
    }

    function updateResourceRegeneration(dtHours) {
      for (const forest of state.resources.forests) {
        const regen = REGEN.forest * dtHours;
        forest.wood = clamp(forest.wood + regen, 0, forest.maxWood);
      }

      for (const patch of state.resources.wild) {
        patch.food = clamp(patch.food + REGEN.wildFood * dtHours, 0, patch.maxFood);
        patch.herbs = clamp(patch.herbs + REGEN.wildHerbs * dtHours, 0, patch.maxHerbs);
      }

      for (const orchard of state.resources.orchards) {
        orchard.food = clamp(orchard.food + REGEN.orchardFood * dtHours, 0, orchard.maxFood);
      }

      const farm = state.resources.farm;
      const growthFactor = clamp(farm.fertility / farm.maxFertility, 0.1, 1);
      farm.crop = clamp(farm.crop + growthFactor * REGEN.farmCrop * dtHours, 0, farm.maxCrop);
      farm.fertility = clamp(farm.fertility + REGEN.farmFertility * dtHours, 0, farm.maxFertility);
    }

    function canBuild(cost) {
      return state.market.stocks.logs >= cost.logs &&
        state.market.stocks.food >= cost.food &&
        state.city.treasury >= cost.cash;
    }

    function spendBuild(cost) {
      state.market.stocks.logs -= cost.logs;
      state.market.stocks.food -= cost.food;
      state.city.treasury -= cost.cash;
      state.market.treasury += Math.round(cost.cash * 0.5);
    }

    function tryBuildBuilding(key, label, cost) {
      if (isBuildingBuilt(key)) {
        return false;
      }
      if (!canBuild(cost)) {
        return false;
      }
      spendBuild(cost);
      state.city.built[key] = true;
      addEvent(`${label} was built.`);
      return true;
    }

    function nextHousePosition() {
      const idx = state.city.houses.length;
      const cols = 4;
      const spacingX = 88;
      const spacingY = 76;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const hub = hubPoint();
      const cx = hub.x - ((cols - 1) * spacingX) * 0.5 + col * spacingX + rand(-8, 8);
      const cy = hub.y + 130 + row * spacingY + rand(-8, 8);
      return {
        x: Math.round(cx - 32),
        y: Math.round(cy - 24)
      };
    }

    function cityProgressionAndConstruction(hourAbsolute) {
      if (hourAbsolute % 24 !== 0) {
        return;
      }

      const pop = state.people.length;
      let builtToday = false;
      if (!isBuildingBuilt("townhall")) {
        builtToday = tryBuildBuilding("townhall", "Town Hall", BUILD_COSTS.townhall);
      } else if (!isBuildingBuilt("market")) {
        builtToday = tryBuildBuilding("market", "Market", BUILD_COSTS.market);
      } else if (!isBuildingBuilt("farm")) {
        builtToday = tryBuildBuilding("farm", "Farm", BUILD_COSTS.farm);
      }

      const needHomes = Math.max(0, Math.ceil((pop - state.city.houses.length * HOUSE_CAPACITY) / HOUSE_CAPACITY));
      if (!builtToday && isBuildingBuilt("townhall") && needHomes > 0 && canBuild(BUILD_COSTS.house)) {
        spendBuild(BUILD_COSTS.house);
        const p = nextHousePosition();
        state.city.houses.push(createHouse(p.x, p.y));
        addEvent("A new house was built.");
      }

      if (isBuildingBuilt("market")) {
        const socialFood = Math.min(state.market.stocks.food, Math.ceil(pop * 0.5));
        if (socialFood > 0) {
          state.market.stocks.food -= socialFood;
          const spend = socialFood * state.market.prices.food;
          if (state.city.treasury >= spend) {
            state.city.treasury -= spend;
            state.market.treasury += spend;
          }
        }
      }

      const capacity = state.city.houses.length * HOUSE_CAPACITY;
      const freeSlots = Math.max(0, capacity - state.people.length);
      if (freeSlots > 0) {
        const wellFedAdults = state.people.filter((p) => p.ageDays >= 18 && p.hunger < 55 && p.health > 45).length;
        const birthChance = clamp(0.05 + wellFedAdults * 0.008, 0.05, 0.42);
        const maxBirths = Math.min(freeSlots, 2);
        let born = 0;
        for (let i = 0; i < maxBirths; i++) {
          if (Math.random() < birthChance) {
            const baby = createPerson({ isBirth: true });
            addEvent(`${baby.name} was born.`);
            born += 1;
          }
        }
        if (born > 0) {
          rebalanceJobs();
        }
      }

      const builtCount = (isBuildingBuilt("townhall") ? 1 : 0) + (isBuildingBuilt("market") ? 1 : 0) + (isBuildingBuilt("farm") ? 1 : 0);
      if (builtCount === 0) {
        state.city.stage = "Wilderness";
      } else if (builtCount < 3) {
        state.city.stage = "Founding";
      } else if (state.city.houses.length < 5) {
        state.city.stage = "Settlement";
      } else {
        state.city.stage = "Expanding";
      }

      state.day += 1;
    }

    function processHourTick(hourAbsolute) {
      computeDemandAndPrices();

      if (hourAbsolute % 6 === 0) {
        rebalanceJobs();
      }

      if (hourAbsolute % 12 === 0 && isBuildingBuilt("market")) {
        const exportable = Math.max(0, state.market.stocks.logs - state.market.demand.logs - 2);
        const sold = Math.min(exportable, 3);
        if (sold > 0) {
          state.market.stocks.logs -= sold;
          state.market.treasury += sold * state.market.prices.logs;
        }
      }

      cityProgressionAndConstruction(hourAbsolute);
    }

    function updateSimulation(realDtSec) {
      const gameHours = realDtSec * 0.7 * state.speed;
      const prevAbs = state.absHours;
      state.absHours += gameHours;

      const startHour = Math.floor(prevAbs);
      const endHour = Math.floor(state.absHours);
      if (endHour > startHour) {
        for (let h = startHour + 1; h <= endHour; h++) {
          processHourTick(h);
        }
      }

      updatePeople(gameHours);
      updateResourceRegeneration(gameHours);
      decayRoadHeat(gameHours);
    }

    function roleLabel(role) {
      if (role === "sawmill_worker") return "Sawmill worker";
      return String(role || "unemployed").replaceAll("_", " ");
    }

    function taskLabel(task) {
      if (!task) return "none";
      return task.type.replaceAll("_", " ");
    }

    function updateUI() {
      ui.popStat.textContent = String(state.people.length);
      ui.stageStat.textContent = state.city.stage;
      ui.dayStat.textContent = String(state.day);
      ui.marketCashStat.textContent = `$${Math.round(state.market.treasury)}`;

      const hh = formatHour(currentHour());
      const stocks = state.market.stocks;
      const forestLeft = state.resources.forests.reduce((sum, f) => sum + f.wood, 0);
      const orchardFood = state.resources.orchards.reduce((sum, o) => sum + o.food, 0);
      const wildFood = state.resources.wild.reduce((sum, p) => sum + p.food, 0);
      const wildHerbs = state.resources.wild.reduce((sum, p) => sum + p.herbs, 0);
      ui.overlayText.innerHTML = `
        <div><b>Day ${state.day}</b> ${hh} | Population: ${state.people.length}</div>
        <div>Stage: <b>${state.city.stage}</b> | City cash: $${Math.round(state.city.treasury)}</div>
        <div>Finite map resources: forest ${forestLeft.toFixed(0)}, orchard food ${orchardFood.toFixed(0)}, wild food ${wildFood.toFixed(0)}, herbs ${wildHerbs.toFixed(0)}, farm crop ${state.resources.farm.crop.toFixed(0)}</div>
      `;

      ui.marketTable.innerHTML = "";
      for (const good of GOODS) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");
        td1.textContent = `${good} ($${state.market.prices[good]})`;
        td2.textContent = `${state.market.stocks[good].toFixed(0)} / demand ${state.market.demand[good].toFixed(0)}`;
        tr.appendChild(td1);
        tr.appendChild(td2);
        ui.marketTable.appendChild(tr);
      }

      const selected = getPerson(state.selectedId);
      if (!selected) {
        ui.personCard.innerHTML = `
          <h2>No person selected</h2>
          <div class="mini">Click any person on the map to inspect stats and needs.</div>
        `;
      } else {
        ui.personCard.innerHTML = `
          <h2>${selected.name}</h2>
          <div class="mini"><b>Age:</b> ${selected.ageDays.toFixed(1)} / ${LIFE_SPAN_DAYS} days</div>
          <div class="mini"><b>Role:</b> ${roleLabel(selected.role)}</div>
          <div class="mini"><b>Base profession:</b> ${roleLabel(selected.baseProfession || selected.role)}</div>
          <div class="mini"><b>Task:</b> ${taskLabel(selected.task)}</div>
          <div class="mini"><b>Money:</b> $${selected.money.toFixed(0)}</div>
          <div class="mini"><b>Experience:</b> ${Math.round(getExperience(selected, selected.role))}%</div>
          <div class="mini"><b>Switch penalty:</b> ${selected.switchPenaltyHours > 0 ? `${selected.switchPenaltyHours.toFixed(1)}h` : "none"}</div>

          ${meterHtml("Health", selected.health, "#ca4b4b")}
          ${meterHtml("Hunger", selected.hunger, "#b58b33")}

          <div class="mini"><b>Inventory:</b></div>
          <div class="mini">Food ${selected.inventory.food} | Logs ${selected.inventory.logs} | Planks ${selected.inventory.planks}</div>
          <div class="mini">Furniture ${selected.inventory.furniture} | Herbs ${selected.inventory.herbs} | Medkits ${selected.inventory.medkits}</div>
        `;
      }

      ui.eventLog.innerHTML = "";
      for (const e of state.eventLog) {
        const div = document.createElement("div");
        div.className = "event";
        div.innerHTML = `<b>${e}</b>`;
        ui.eventLog.appendChild(div);
      }

      renderProfessionLegend();
      renderResourceMenu(stocks, forestLeft, orchardFood, wildFood, wildHerbs);
      renderBuildingCard();
    }

    function renderProfessionLegend() {
      if (!ui.professionLegend) {
        return;
      }
      const counts = {
        forager: 0,
        farmer: 0,
        woodcutter: 0,
        unemployed: 0
      };
      for (const p of state.people) {
        if (Object.prototype.hasOwnProperty.call(counts, p.role)) {
          counts[p.role] += 1;
        } else {
          counts.unemployed += 1;
        }
      }
      ui.professionLegend.innerHTML = [
        `<div class="legend-row"><span><span class="dot" style="background:#d0d95c"></span>Forager</span><span>${counts.forager}</span></div>`,
        `<div class="legend-row"><span><span class="dot" style="background:#63b35d"></span>Farmer</span><span>${counts.farmer}</span></div>`,
        `<div class="legend-row"><span><span class="dot" style="background:#5f8f53"></span>Woodcutter</span><span>${counts.woodcutter}</span></div>`,
        `<div class="legend-row"><span><span class="dot" style="background:#9f9f9f"></span>Unemployed</span><span>${counts.unemployed}</span></div>`
      ].join("");
    }

    function renderResourceMenu(stocks, forestLeft, orchardFood, wildFood, wildHerbs) {
      if (!ui.resourceList) {
        return;
      }
      if (uiState.resourceView === "map") {
        ui.resourceList.innerHTML = [
          `<div>Forest wood: <b>${forestLeft.toFixed(0)}</b></div>`,
          `<div>Orchard food: <b>${orchardFood.toFixed(0)}</b></div>`,
          `<div>Wild food: <b>${wildFood.toFixed(0)}</b></div>`,
          `<div>Wild herbs: <b>${wildHerbs.toFixed(0)}</b></div>`,
          `<div>Farm crop: <b>${state.resources.farm.crop.toFixed(0)}</b></div>`
        ].join("");
      } else {
        ui.resourceList.innerHTML = [
          `<div>Population: <b>${state.people.length}</b></div>`,
          `<div>City treasury: <b>$${Math.round(state.city.treasury)}</b></div>`,
          `<div>Market treasury: <b>$${Math.round(state.market.treasury)}</b></div>`,
          `<div>Market food stock: <b>${stocks.food.toFixed(0)}</b></div>`,
          `<div>Market herbs stock: <b>${stocks.herbs.toFixed(0)}</b></div>`,
          `<div>Houses: <b>${state.city.houses.length}</b></div>`
        ].join("");
      }
    }

    function renderBuildingCard() {
      if (!ui.buildingCard) {
        return;
      }
      const selected = state.selectedBuilding;
      const selectedObject = state.selectedObject;
      if (!selected && !selectedObject) {
        ui.buildingCard.innerHTML = `
          <h2>No object selected</h2>
          <div class="mini">Click any object on the map to inspect description and stats.</div>
        `;
        return;
      }

      if (selectedObject) {
        if (selectedObject.startsWith("wild:")) {
          const idx = Number(selectedObject.split(":")[1]);
          const patch = state.resources.wild[idx];
          if (!patch) {
            state.selectedObject = null;
            return;
          }
          ui.buildingCard.innerHTML = `
            <h2>Wild Patch #${idx + 1}</h2>
            <div class="mini"><b>What is it:</b> Foraging zone where sims gather food and herbs.</div>
            <div class="mini"><b>Food:</b> ${patch.food.toFixed(0)} / ${patch.maxFood.toFixed(0)}</div>
            <div class="mini"><b>Herbs:</b> ${patch.herbs.toFixed(0)} / ${patch.maxHerbs.toFixed(0)}</div>
            <div class="mini"><b>Coords:</b> ${Math.round(patch.x)}, ${Math.round(patch.y)}</div>
          `;
          return;
        }
        if (selectedObject.startsWith("orchard:")) {
          const idx = Number(selectedObject.split(":")[1]);
          const orchard = state.resources.orchards[idx];
          if (!orchard) {
            state.selectedObject = null;
            return;
          }
          ui.buildingCard.innerHTML = `
            <h2>Orchard #${idx + 1}</h2>
            <div class="mini"><b>What is it:</b> Renewable fruit source for foragers.</div>
            <div class="mini"><b>Food:</b> ${orchard.food.toFixed(0)} / ${orchard.maxFood.toFixed(0)}</div>
            <div class="mini"><b>Coords:</b> ${Math.round(orchard.x)}, ${Math.round(orchard.y)}</div>
          `;
          return;
        }
        if (selectedObject.startsWith("forest:")) {
          const idx = Number(selectedObject.split(":")[1]);
          const forest = state.resources.forests[idx];
          if (!forest) {
            state.selectedObject = null;
            return;
          }
          ui.buildingCard.innerHTML = `
            <h2>Forest #${idx + 1}</h2>
            <div class="mini"><b>What is it:</b> Logging area where woodcutters harvest logs.</div>
            <div class="mini"><b>Wood:</b> ${forest.wood.toFixed(0)} / ${forest.maxWood.toFixed(0)}</div>
            <div class="mini"><b>Coords:</b> ${Math.round(forest.x)}, ${Math.round(forest.y)}</div>
          `;
          return;
        }
        if (selectedObject.startsWith("road:")) {
          const key = selectedObject.slice("road:".length);
          const raw = Number(state.roadHeat[key]) || 0;
          const parts = key.split(":");
          const gx = Number(parts[0]);
          const gy = Number(parts[1]);
          if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
            state.selectedObject = null;
            return;
          }
          const cx = gx * ROAD.cell + ROAD.cell * 0.5;
          const cy = gy * ROAD.cell + ROAD.cell * 0.5;
          const totalRoadTiles = roadCells(ROAD.drawThreshold).length;
          ui.buildingCard.innerHTML = `
            <h2>Path Segment</h2>
            <div class="mini"><b>What is it:</b> Emergent road created by repeated walking.</div>
            <div class="mini"><b>Traffic intensity:</b> ${raw.toFixed(1)} / ${ROAD.maxHeat}</div>
            <div class="mini"><b>Total road tiles:</b> ${totalRoadTiles}</div>
            <div class="mini"><b>Coords:</b> ${Math.round(cx)}, ${Math.round(cy)}</div>
          `;
          return;
        }
      }

      if (!selected) {
        ui.buildingCard.innerHTML = `
          <h2>No object selected</h2>
          <div class="mini">Click any object on the map to inspect description and stats.</div>
        `;
        return;
      }

      if (selected.startsWith("house:")) {
        const idx = Number(selected.split(":")[1]);
        const h = state.city.houses[idx];
        if (!h) {
          ui.buildingCard.innerHTML = `
            <h2>No building selected</h2>
            <div class="mini">Building not found.</div>
          `;
          return;
        }
        const residents = state.city.houses.length > 0
          ? state.people.filter((p) => p.homeIndex === idx).length
          : 0;
        const capacity = HOUSE_CAPACITY;
        ui.buildingCard.innerHTML = `
          <h2>House #${idx + 1}</h2>
          <div class="mini"><b>Residents:</b> ${residents} / ${capacity}</div>
          <div class="mini"><b>Coords:</b> ${Math.round(h.x)}, ${Math.round(h.y)}</div>
        `;
        return;
      }

      if (!selected.startsWith("building:")) {
        return;
      }

      const key = selected.split(":")[1];
      const workers = workersForBuilding(key);
      const workerNames = workers.slice(0, 4).map((p) => p.name).join(", ");

      if (key === "market") {
        const tradingNow = workersBusyAt(["buy_food", "buy_medkit", "sell_goods"]);
        ui.buildingCard.innerHTML = `
          <h2>Market</h2>
          <div class="mini"><b>Treasury:</b> $${Math.round(state.market.treasury)}</div>
          <div class="mini"><b>Food stock:</b> ${state.market.stocks.food.toFixed(0)} | demand ${state.market.demand.food.toFixed(0)}</div>
          <div class="mini"><b>Herbs stock:</b> ${state.market.stocks.herbs.toFixed(0)} | demand ${state.market.demand.herbs.toFixed(0)}</div>
          <div class="mini"><b>Active traders right now:</b> ${tradingNow}</div>
        `;
        return;
      }

      if (key === "farm") {
        const active = workersBusyAt(["harvest_farm", "tend_farm"]);
        ui.buildingCard.innerHTML = `
          <h2>Farm</h2>
          <div class="mini"><b>Farmers:</b> ${workers.length}</div>
          <div class="mini"><b>Working now:</b> ${active}</div>
          <div class="mini"><b>Crop:</b> ${state.resources.farm.crop.toFixed(0)} / ${state.resources.farm.maxCrop.toFixed(0)}</div>
          <div class="mini"><b>Fertility:</b> ${state.resources.farm.fertility.toFixed(0)} / ${state.resources.farm.maxFertility.toFixed(0)}</div>
          <div class="mini"><b>Workers:</b> ${workerNames || "none"}</div>
        `;
        return;
      }

      if (key === "townhall") {
        const unemployed = state.people.filter((p) => p.role === "unemployed").length;
        ui.buildingCard.innerHTML = `
          <h2>Town Hall</h2>
          <div class="mini"><b>City treasury:</b> $${Math.round(state.city.treasury)}</div>
          <div class="mini"><b>City stage:</b> ${state.city.stage}</div>
          <div class="mini"><b>Unemployed:</b> ${unemployed}</div>
          <div class="mini"><b>Houses:</b> ${state.city.houses.length}</div>
        `;
      }
    }

    function meterHtml(label, value, color) {
      const v = clamp(value, 0, 100);
      return `
        <div class="meter">
          <div class="meter-top"><span>${label}</span><span>${v.toFixed(0)}%</span></div>
          <div class="bar"><span style="width:${v}%; background:${color};"></span></div>
        </div>
      `;
    }

    function updateCameraInsets() {
      const rect = canvas.getBoundingClientRect();
      let left = 0;
      let right = 0;
      if (ui.sidebar) {
        const s = ui.sidebar.getBoundingClientRect();
        if (s.right > rect.left) {
          left = Math.max(0, s.right - rect.left + 8);
        }
      }
      if (ui.rightbar) {
        const r = ui.rightbar.getBoundingClientRect();
        if (r.left < rect.right) {
          right = Math.max(0, rect.right - r.left + 8);
        }
      }
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
      camera.setInsets({
        left: left * scaleX,
        right: right * scaleX,
        top: 12 * scaleY,
        bottom: 12 * scaleY
      });
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(640, Math.floor(rect.width * dpr));
      canvas.height = Math.max(420, Math.floor(rect.height * dpr));
      ctx.imageSmoothingEnabled = false;
      camera.resize(canvas.width, canvas.height);
      updateCameraInsets();
      updateZoomLabel();
    }

    function imageReady(img) {
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }

    function drawImageCover(img, x, y, w, h) {
      if (!imageReady(img)) {
        return false;
      }
      ctx.drawImage(img, x, y, w, h);
      return true;
    }

    function drawSheetFrame(img, cols, rows, frame, row, dx, dy, dw, dh) {
      if (!imageReady(img) || cols <= 0 || rows <= 0) {
        return false;
      }
      const fw = Math.floor(img.naturalWidth / cols);
      const fh = Math.floor(img.naturalHeight / rows);
      if (fw <= 0 || fh <= 0) {
        return false;
      }
      const fx = ((Math.floor(frame) % cols) + cols) % cols;
      const fy = ((Math.floor(row) % rows) + rows) % rows;
      ctx.drawImage(img, fx * fw, fy * fh, fw, fh, dx, dy, dw, dh);
      return true;
    }

    function animatedFrame(fps, frames, seed = 0) {
      if (!Number.isFinite(fps) || !Number.isFinite(frames) || frames <= 0) {
        return 0;
      }
      return Math.floor((state.absHours * fps + seed) % frames);
    }

    function drawPersonSprite(person) {
      const img = sprites.personSheet;
      if (!imageReady(img)) {
        return false;
      }
      const anim = SHEET_ANIMS.person;
      const moving = Boolean(person.task && person.task.phase === "move");
      const facing = normalizeFacing(person.facing);
      const row = moving ? (anim.rowByFacing[facing] ?? anim.rowByFacing.down) : anim.idleRow;
      const frame = moving ? animatedFrame(anim.walkFps, anim.walkFrames, person.id * 0.37) : anim.idleFrame;
      const dw = 24;
      const dh = 32;
      if (!drawSheetFrame(img, anim.cols, anim.rows, frame, row, person.x - dw * 0.5, person.y - dh * 0.82, dw, dh)) {
        return false;
      }
      return true;
    }

    function generateTintedSprite(base, tintColor, tintAlpha = 0.18) {
      if (!imageReady(base)) {
        return null;
      }
      const c = document.createElement("canvas");
      c.width = base.naturalWidth;
      c.height = base.naturalHeight;
      const cctx = c.getContext("2d");
      cctx.imageSmoothingEnabled = false;
      cctx.drawImage(base, 0, 0);
      cctx.globalCompositeOperation = "source-atop";
      cctx.globalAlpha = tintAlpha;
      cctx.fillStyle = tintColor;
      cctx.fillRect(0, 0, c.width, c.height);
      cctx.globalCompositeOperation = "source-over";
      cctx.globalAlpha = 1;
      const out = new Image();
      out.src = c.toDataURL("image/png");
      return out;
    }

    function ensureGeneratedBuildingSprites() {
      if (!imageReady(sprites.house)) {
        return;
      }
      if (!generatedBuildingSprites.market) {
        generatedBuildingSprites.market = generateTintedSprite(sprites.house, "#d8ab62", 0.2);
      }
      if (!generatedBuildingSprites.farm) {
        generatedBuildingSprites.farm = generateTintedSprite(sprites.house, "#7fb063", 0.2);
      }
      if (!generatedBuildingSprites.townhall) {
        generatedBuildingSprites.townhall = generateTintedSprite(sprites.house, "#7e8bb8", 0.2);
      }
    }

    function drawBuilding(b, fill, stroke, label, locked = false, sprite = null, selected = false, icon = null) {
      ctx.fillStyle = locked ? "#5d625f" : fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      drawImageCover(sprite, b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      if (imageReady(icon)) {
        drawImageCover(icon, b.x + b.w - 28, b.y + 6, 20, 20);
      }
      if (selected) {
        ctx.strokeStyle = "#ffe9a8";
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
      ctx.fillStyle = locked ? "#ced0ce" : "#f6f0df";
      ctx.font = "14px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(label + (locked ? " (locked)" : ""), b.x + b.w / 2, b.y + b.h / 2 + 5);
    }

    function drawRoadNetwork() {
      const cells = roadCells(ROAD.drawThreshold);
      if (cells.length === 0) {
        return;
      }
      const byKey = new Map(cells.map((c) => [c.key, c]));
      if (imageReady(sprites.pathTile)) {
        const pathPattern = ctx.createPattern(sprites.pathTile, "repeat");
        ctx.strokeStyle = pathPattern || "rgba(219, 199, 146, 0.45)";
        ctx.fillStyle = pathPattern || "rgba(219, 199, 146, 0.42)";
      } else {
        ctx.strokeStyle = "rgba(219, 199, 146, 0.45)";
        ctx.fillStyle = "rgba(219, 199, 146, 0.42)";
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const c of cells) {
        const normalized = clamp(c.heat / ROAD.maxHeat, 0, 1);
        const width = 7 + normalized * 11;
        const right = byKey.get(roadKey(c.gx + 1, c.gy));
        const down = byKey.get(roadKey(c.gx, c.gy + 1));
        if (right) {
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(c.cx, c.cy);
          ctx.lineTo(right.cx, right.cy);
          ctx.stroke();
        }
        if (down) {
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(c.cx, c.cy);
          ctx.lineTo(down.cx, down.cy);
          ctx.stroke();
        }
      }
      for (const c of cells) {
        const normalized = clamp(c.heat / ROAD.maxHeat, 0, 1);
        const radius = 5 + normalized * 8;
        ctx.globalAlpha = 0.45 + normalized * 0.35;
        ctx.beginPath();
        ctx.arc(c.cx, c.cy, radius, 0, Math.PI * 2);
        ctx.fill();
        if (isSelectedObject(`road:${c.key}`)) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#ffe9a8";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function renderMapBase() {
      ensureGeneratedBuildingSprites();
      if (imageReady(sprites.background)) {
        const pattern = ctx.createPattern(sprites.background, "repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, WORLD.width, WORLD.height);
        } else {
          drawImageCover(sprites.background, 0, 0, WORLD.width, WORLD.height);
        }
      } else {
        ctx.fillStyle = "#20453f";
        ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      }

      drawRoadNetwork();

      // Home district
      for (let i = 0; i < state.city.houses.length; i++) {
        const h = state.city.houses[i];
        ctx.fillStyle = "#b78f66";
        ctx.strokeStyle = "#815f3b";
        ctx.lineWidth = 2;
        ctx.fillRect(h.x, h.y, h.w, h.h);
        ctx.strokeRect(h.x, h.y, h.w, h.h);
        drawImageCover(sprites.house, h.x + 6, h.y + 6, h.w - 12, h.h - 12);
        if (isSelectedBuilding(`house:${i}`)) {
          ctx.strokeStyle = "#ffe9a8";
          ctx.lineWidth = 3;
          ctx.strokeRect(h.x - 2, h.y - 2, h.w + 4, h.h + 4);
        }
      }

      // Resource patches
      for (let i = 0; i < state.resources.wild.length; i++) {
        const patch = state.resources.wild[i];
        ctx.beginPath();
        ctx.fillStyle = "rgba(166, 192, 86, 0.35)";
        ctx.strokeStyle = "rgba(188, 220, 97, 0.85)";
        ctx.lineWidth = 2;
        ctx.arc(patch.x, patch.y, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (isSelectedObject(`wild:${i}`)) {
          ctx.strokeStyle = "#ffe9a8";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        const wildAnim = SHEET_ANIMS.wild;
        const wildFrame = animatedFrame(wildAnim.fps, wildAnim.frames, i * 0.71);
        const wildRow = i % wildAnim.rows;
        if (!drawSheetFrame(sprites.wild, wildAnim.cols, wildAnim.rows, wildFrame, wildRow, patch.x - 16, patch.y - 16, 32, 32)) {
          drawImageCover(sprites.wild, patch.x - 16, patch.y - 16, 32, 32);
        }
        ctx.fillStyle = "#dce8aa";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`F${patch.food.toFixed(0)} H${patch.herbs.toFixed(0)}`, patch.x, patch.y + 4);
      }

      for (let i = 0; i < state.resources.orchards.length; i++) {
        const orchard = state.resources.orchards[i];
        ctx.beginPath();
        ctx.fillStyle = "rgba(207, 136, 76, 0.34)";
        ctx.strokeStyle = "rgba(235, 175, 90, 0.85)";
        ctx.lineWidth = 2;
        ctx.arc(orchard.x, orchard.y, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (isSelectedObject(`orchard:${i}`)) {
          ctx.strokeStyle = "#ffe9a8";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        drawImageCover(sprites.farm, orchard.x - 16, orchard.y - 16, 32, 32);
        ctx.fillStyle = "#ffe6bc";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`Orchard ${orchard.food.toFixed(0)}`, orchard.x, orchard.y + 4);
      }

      for (let i = 0; i < state.resources.forests.length; i++) {
        const f = state.resources.forests[i];
        ctx.beginPath();
        ctx.fillStyle = "rgba(72, 124, 66, 0.45)";
        ctx.strokeStyle = "rgba(110, 176, 97, 0.8)";
        ctx.lineWidth = 2;
        ctx.arc(f.x, f.y, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (isSelectedObject(`forest:${i}`)) {
          ctx.strokeStyle = "#ffe9a8";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        drawImageCover(sprites.forest, f.x - 18, f.y - 18, 36, 36);
        ctx.fillStyle = "#d3f0cb";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`Wood ${f.wood.toFixed(0)}`, f.x, f.y + 4);
      }

      if (isBuildingBuilt("market")) {
        drawBuilding(BUILDINGS.market, "#ac824f", "#744d27", "Market", false, generatedBuildingSprites.market || sprites.house, isSelectedBuilding("building:market"), sprites.iconMarket);
      }
      if (isBuildingBuilt("farm")) {
        drawBuilding(BUILDINGS.farm, "#73954f", "#405529", "Farm", false, generatedBuildingSprites.farm || sprites.house, isSelectedBuilding("building:farm"), sprites.iconFarm);
      }
      if (isBuildingBuilt("townhall")) {
        drawBuilding(BUILDINGS.townhall, "#766e8e", "#4f4a63", "Town Hall", false, generatedBuildingSprites.townhall || sprites.house, isSelectedBuilding("building:townhall"), sprites.iconTownhall);
      }

      if (isBuildingBuilt("farm")) {
        ctx.fillStyle = "#f3edc8";
        ctx.font = "13px Trebuchet MS";
        ctx.textAlign = "left";
        ctx.fillText(`Crop ${state.resources.farm.crop.toFixed(0)} | Fertility ${state.resources.farm.fertility.toFixed(0)}`, BUILDINGS.farm.x + 3, BUILDINGS.farm.y - 8);
      }
    }

    function drawPeople() {
      for (const person of state.people) {
        const color = ROLE_COLORS[person.role] || ROLE_COLORS.unemployed;

        if (person.task && person.task.phase === "move") {
          ctx.strokeStyle = "rgba(245, 245, 245, 0.15)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(person.x, person.y);
          ctx.lineTo(person.task.targetX, person.task.targetY);
          ctx.stroke();
        }

        const drewSprite = drawPersonSprite(person);
        if (!drewSprite) {
          ctx.beginPath();
          ctx.arc(person.x, person.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }

        if (person.id === state.selectedId) {
          ctx.strokeStyle = "#fff2c5";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(person.x, person.y, 9, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#fdf7e0";
          ctx.font = "11px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText(person.name, person.x, person.y - 10);
        }

        if (person.health < 22) {
          ctx.fillStyle = "#f26f6f";
          ctx.fillRect(person.x - 5, person.y + 8, 10, 2);
        }
      }
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(view.ox, view.oy);
      ctx.scale(view.scale, view.scale);

      renderMapBase();
      drawPeople();

      // Day/night tint.
      const h = currentHour();
      const darkness = h < 5 || h > 20 ? 0.22 : 0.06;
      ctx.fillStyle = `rgba(7, 15, 18, ${darkness})`;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);

      ctx.restore();

      updateUI();
    }

    function updateCameraControls(dtSec) {
      let dx = 0;
      let dy = 0;
      if (keyState.KeyA) dx -= 1;
      if (keyState.KeyD) dx += 1;
      if (keyState.KeyW) dy -= 1;
      if (keyState.KeyS) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        camera.panByWorld(dx * PAN.keyboardSpeed * dtSec, dy * PAN.keyboardSpeed * dtSec);
      }

      if (camera.update(dtSec)) {
        updateZoomLabel();
      }
    }

    let lastFrame = performance.now();
    function gameLoop(now) {
      const dt = Math.min(0.12, (now - lastFrame) / 1000);
      lastFrame = now;

      updateCameraControls(dt);

      if (!state.paused) {
        updateSimulation(dt);
        autosaveTimer += dt;
        if (autosaveTimer >= autosaveIntervalSec) {
          saveToStorage(false);
          autosaveTimer = 0;
        }
      }
      render();
      requestAnimationFrame(gameLoop);
    }

    async function init() {
      setupUI();
      resizeCanvas();
      const restored = await loadFromStorage(false);
      if (!restored) {
        initPopulation(8);
        computeDemandAndPrices();
        addEvent("Simulation started.");
        saveToStorage(false);
      } else {
        addEvent("Save restored on startup.");
      }
      syncUiToggles();
      requestAnimationFrame(gameLoop);
    }

    init();
})();
