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
      GOODS,
      BASE_PRICES,
      NAMES,
      STORAGE_KEY,
      ZOOM,
      PAN,
      CAMERA,
      ASSETS,
      ROLE_COLORS
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
      toolsMenuBtn: document.getElementById("toolsMenuBtn"),
      worldSettingsBtn: document.getElementById("worldSettingsBtn"),
      toolsPanel: document.getElementById("toolsPanel"),
      resourceMapBtn: document.getElementById("resourceMapBtn"),
      resourceWorldBtn: document.getElementById("resourceWorldBtn"),
      resourceList: document.getElementById("resourceList"),
      worldSettingsModal: document.getElementById("worldSettingsModal"),
      worldSettingsCloseBtn: document.getElementById("worldSettingsCloseBtn"),
      worldSettingsApplyBtn: document.getElementById("worldSettingsApplyBtn"),
      worldSettingsApplySaveBtn: document.getElementById("worldSettingsApplySaveBtn"),
      wsMechanicNeedsInput: document.getElementById("wsMechanicNeedsInput"),
      wsMechanicTradeInput: document.getElementById("wsMechanicTradeInput"),
      wsMechanicDynamicPricingInput: document.getElementById("wsMechanicDynamicPricingInput"),
      wsMechanicJobRebalanceInput: document.getElementById("wsMechanicJobRebalanceInput"),
      wsMechanicResourceRegenInput: document.getElementById("wsMechanicResourceRegenInput"),
      wsMechanicConstructionInput: document.getElementById("wsMechanicConstructionInput"),
      sidebar: document.querySelector(".sidebar"),
      rightbar: document.querySelector(".rightbar"),
      popStat: document.getElementById("popStat"),
      stageStat: document.getElementById("stageStat"),
      dayStat: document.getElementById("dayStat"),
      marketCashStat: document.getElementById("marketCashStat"),
      worldMoneyStat: document.getElementById("worldMoneyStat"),
      overlayText: document.getElementById("overlayText"),
      professionLegend: document.getElementById("professionLegend"),
      personCard: document.getElementById("personCard"),
      buildingCard: document.getElementById("buildingCard"),
      marketTable: document.getElementById("marketTable"),
      eventLog: document.getElementById("eventLog")
    };

    let state = null;
    const visualEffects = [];
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
    let hoverClickable = false;
    const keyState = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false
    };
    const HERO_TARGET_COUNT = 4;
    const CHALLENGE_YEARS = 5;
    const DAYS_PER_YEAR = 360;
    const CHALLENGE_TOTAL_DAYS = CHALLENGE_YEARS * DAYS_PER_YEAR;
    let LIFE_SPAN_DAYS = 360;
    const PROFESSIONS = ["forager", "farmer", "woodcutter"];
    const SIMPLE_GRAPHICS = true;
    const VISUAL_SCALE = 2;
    const PERSON_CLICK_RADIUS = 40;
    const OBJECT_TEXTURE_GAP = 28;
    const ROAD = {
      cell: 16,
      clickRadius: 12,
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
    const GAMEPLAY = {
      needs: {
        hungerBase: 0.82,
        hungerWorkBonus: 0.28,
        hungerPenaltyBonus: 0.22,
        healthBaseDecay: 0.07,
        healthFedRegen: 0.03,
        eatDecisionHunger: 32,
        eatFromInventoryHunger: 28,
        buyFoodHunger: 55,
        eatExecuteHunger: 18,
        hungerReliefPerFood: 46
      },
      trade: {
        sellRawFactor: 0.9,
        sellCraftFactor: 0.96,
        exportLogReserve: 2,
        exportLogBatch: 3
      },
      marketModel: {
        foodPerPopBase: 2.2,
        foodHungerFactor: 1.05,
        logsPerPop: 0.16,
        herbsPerPop: 0.24,
        priceRatioWeight: 0.88,
        priceShortageWeight: 0.55,
        priceSmoothingOldWeight: 0.55
      },
      jobs: {
        maxChangeRatio: 0.22
      }
    };
    const MECHANICS = {
      needs: true,
      trade: true,
      dynamicPricing: true,
      jobRebalance: true,
      resourceRegen: true,
      construction: true
    };
    const SHEET_ANIMS = Object.freeze({
      person: {
        frameW: 16,
        frameH: 16,
        // Character block in a 4x5 RPG-style atlas (each block is 3x4 frames).
        atlasX: 48,
        atlasY: 256,
        walkFrames: 3,
        walkFps: 9,
        idleRow: 0,
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
    state = createInitialState(false);

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

    function createChallengeState(startDay = 1) {
      const safeStart = Math.max(1, Math.floor(Number(startDay) || 1));
      return {
        startDay: safeStart,
        totalDays: CHALLENGE_TOTAL_DAYS,
        targetYears: CHALLENGE_YEARS,
        finished: false,
        finishedDay: null,
        finalMoney: 0,
        bestMoney: 0
      };
    }

    function createInitialState(randomized) {
      const resourceScale = randomized ? rand(0.72, 1.35) : 1;
      const moneyScale = randomized ? rand(0.65, 1.45) : 1;
      const randomPoint = (baseX, baseY, spreadX, spreadY) => {
        if (!randomized) {
          return { x: baseX, y: baseY };
        }
        return {
          x: clamp(baseX + rand(-spreadX, spreadX), 120, WORLD.width - 120),
          y: clamp(baseY + rand(-spreadY, spreadY), 120, WORLD.height - 120)
        };
      };
      const forestPoints = [
        randomPoint(2200, 430, 340, 220),
        randomPoint(2440, 560, 280, 220),
        randomPoint(2060, 350, 320, 200),
        randomPoint(2320, 760, 300, 260)
      ];
      const orchardPoints = [
        randomPoint(690, 1040, 260, 240),
        randomPoint(860, 1220, 250, 260),
        randomPoint(1020, 980, 280, 250)
      ];
      const wildPoints = [
        randomPoint(420, 560, 280, 260),
        randomPoint(620, 450, 280, 250),
        randomPoint(320, 760, 260, 240),
        randomPoint(890, 620, 300, 260)
      ];
      return {
        paused: false,
        speed: 1,
        absHours: 0,
        day: 1,
        challenge: createChallengeState(1),
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
          treasury: 0,
          houses: [],
          companies: {},
          built: {
            bank: true,
            townhall: false,
            market: false,
            farm: false
          },
          construction: {
            townhall: null,
            market: null,
            farm: null,
            houses: []
          }
        },
        bank: {
          treasury: 0
        },
        market: {
          treasury: 0,
          stocks: {
            food: Math.round(24 * resourceScale),
            logs: Math.round(8 * resourceScale),
            herbs: Math.round(10 * resourceScale)
          },
          demand: {
            food: 20,
            logs: 10,
            herbs: 10
          },
          dailyNeed: {
            food: 0
          },
          prices: { ...BASE_PRICES }
        },
        resources: {
          forests: [
            { x: forestPoints[0].x, y: forestPoints[0].y, wood: Math.round(170 * resourceScale), maxWood: Math.round(170 * resourceScale) },
            { x: forestPoints[1].x, y: forestPoints[1].y, wood: Math.round(130 * resourceScale), maxWood: Math.round(130 * resourceScale) },
            { x: forestPoints[2].x, y: forestPoints[2].y, wood: Math.round(95 * resourceScale), maxWood: Math.round(95 * resourceScale) },
            { x: forestPoints[3].x, y: forestPoints[3].y, wood: Math.round(150 * resourceScale), maxWood: Math.round(150 * resourceScale) }
          ],
          orchards: [
            { x: orchardPoints[0].x, y: orchardPoints[0].y, food: Math.round(120 * resourceScale), maxFood: Math.round(120 * resourceScale) },
            { x: orchardPoints[1].x, y: orchardPoints[1].y, food: Math.round(95 * resourceScale), maxFood: Math.round(95 * resourceScale) },
            { x: orchardPoints[2].x, y: orchardPoints[2].y, food: Math.round(110 * resourceScale), maxFood: Math.round(110 * resourceScale) }
          ],
          wild: [
            { x: wildPoints[0].x, y: wildPoints[0].y, food: Math.round(90 * resourceScale), herbs: Math.round(55 * resourceScale), maxFood: Math.round(90 * resourceScale), maxHerbs: Math.round(55 * resourceScale) },
            { x: wildPoints[1].x, y: wildPoints[1].y, food: Math.round(70 * resourceScale), herbs: Math.round(45 * resourceScale), maxFood: Math.round(70 * resourceScale), maxHerbs: Math.round(45 * resourceScale) },
            { x: wildPoints[2].x, y: wildPoints[2].y, food: Math.round(85 * resourceScale), herbs: Math.round(35 * resourceScale), maxFood: Math.round(85 * resourceScale), maxHerbs: Math.round(35 * resourceScale) },
            { x: wildPoints[3].x, y: wildPoints[3].y, food: Math.round(100 * resourceScale), herbs: Math.round(48 * resourceScale), maxFood: Math.round(100 * resourceScale), maxHerbs: Math.round(48 * resourceScale) }
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
        mechanics: {
          needs: true,
          trade: true,
          dynamicPricing: true,
          jobRebalance: true,
          resourceRegen: true,
          construction: true
        }
      };
    }

    function cloneWorldSettings(settings) {
      return {
        mechanics: { ...settings.mechanics }
      };
    }

    function sanitizeWorldSettings(rawSettings) {
      const defaults = defaultWorldSettings();
      const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
      const rawMechanics = source.mechanics && typeof source.mechanics === "object" ? source.mechanics : {};
      return {
        mechanics: {
          needs: rawMechanics.needs === undefined ? defaults.mechanics.needs : Boolean(rawMechanics.needs),
          trade: rawMechanics.trade === undefined ? defaults.mechanics.trade : Boolean(rawMechanics.trade),
          dynamicPricing: rawMechanics.dynamicPricing === undefined ? defaults.mechanics.dynamicPricing : Boolean(rawMechanics.dynamicPricing),
          jobRebalance: rawMechanics.jobRebalance === undefined ? defaults.mechanics.jobRebalance : Boolean(rawMechanics.jobRebalance),
          resourceRegen: rawMechanics.resourceRegen === undefined ? defaults.mechanics.resourceRegen : Boolean(rawMechanics.resourceRegen),
          construction: rawMechanics.construction === undefined ? defaults.mechanics.construction : Boolean(rawMechanics.construction)
        }
      };
    }

    function applyWorldSettings(rawSettings) {
      const next = sanitizeWorldSettings(rawSettings);
      MECHANICS.needs = next.mechanics.needs;
      MECHANICS.trade = next.mechanics.trade;
      MECHANICS.dynamicPricing = next.mechanics.dynamicPricing;
      MECHANICS.jobRebalance = next.mechanics.jobRebalance;
      MECHANICS.resourceRegen = next.mechanics.resourceRegen;
      MECHANICS.construction = next.mechanics.construction;

      state.worldSettings = cloneWorldSettings(next);
      return next;
    }

    function runtimeWorldSettings() {
      return {
        mechanics: {
          needs: MECHANICS.needs,
          trade: MECHANICS.trade,
          dynamicPricing: MECHANICS.dynamicPricing,
          jobRebalance: MECHANICS.jobRebalance,
          resourceRegen: MECHANICS.resourceRegen,
          construction: MECHANICS.construction
        }
      };
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
      personWalk: loadImage(ASSETS.personWalk),
      personIdle: loadImage(ASSETS.personIdle),
      freePack: loadImage(ASSETS.freePack),
      springTileset: loadImage(ASSETS.springTileset),
      roadSheet: loadImage(ASSETS.roadSheet),
      house: loadImage(ASSETS.house),
      market: loadImage(ASSETS.market),
      farm: loadImage(ASSETS.farm),
      townhall: loadImage(ASSETS.townhall),
      forest: loadImage(ASSETS.forest),
      wild: loadImage(ASSETS.wild),
      iconMarket: loadImage(ASSETS.iconMarket),
      iconFarm: loadImage(ASSETS.iconFarm),
      iconTownhall: loadImage(ASSETS.iconTownhall)
    };
    const generatedBuildingSprites = {
      market: null,
      farm: null,
      townhall: null
    };
    const tileCanvasCache = new Map();
    const tilePatternCache = new Map();
    const worldDecor = buildWorldDecor();
    const staticWorldLayer = {
      canvas: document.createElement("canvas"),
      ctx: null,
      ready: false
    };
    staticWorldLayer.canvas.width = WORLD.width;
    staticWorldLayer.canvas.height = WORLD.height;
    staticWorldLayer.ctx = staticWorldLayer.canvas.getContext("2d");
    staticWorldLayer.ctx.imageSmoothingEnabled = false;
    const TILESET = Object.freeze({
      size: 16,
      spring: {
        grassA: { x: 0, y: 0 },
        grassB: { x: 1, y: 0 },
        path: { x: 0, y: 1 },
        flower: { x: 2, y: 1 },
        clover: { x: 3, y: 1 }
      },
      free: {
        bush: { x: 2, y: 9 },
        rock: { x: 3, y: 9 },
        fence: { x: 0, y: 10 },
        crop: { x: 7, y: 11 }
      },
      road: {
        main: { x: 0, y: 0 },
        horizontal: { x: 1, y: 0 },
        vertical: { x: 2, y: 0 },
        diagonalA: { x: 3, y: 0 },
        diagonalB: { x: 4, y: 0 },
        junction: { x: 0, y: 1 },
        hotspot: { x: 1, y: 1 }
      }
    });

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

    function addVisualEffect(type, x, y, ttl = 1.6) {
      visualEffects.push({
        type,
        x,
        y,
        ttl,
        maxTtl: ttl
      });
    }

    function updateVisualEffects(dtSec) {
      for (let i = visualEffects.length - 1; i >= 0; i--) {
        const fx = visualEffects[i];
        fx.ttl -= dtSec;
        if (fx.ttl <= 0) {
          visualEffects.splice(i, 1);
        }
      }
    }

    function currentHour() {
      return state.absHours % 24;
    }

    function totalMoneyScore() {
      const peopleCash = state.people.reduce((sum, p) => sum + (Number(p.money) || 0), 0);
      return Math.max(0, (Number(state.bank.treasury) || 0) + peopleCash);
    }

    function moneyChallengeState() {
      if (!state.challenge || typeof state.challenge !== "object") {
        state.challenge = createChallengeState(state.day);
      }
      return state.challenge;
    }

    function challengeElapsedDays() {
      const challenge = moneyChallengeState();
      return Math.max(0, Math.floor(state.day - challenge.startDay));
    }

    function challengeDaysLeft() {
      const challenge = moneyChallengeState();
      return Math.max(0, challenge.totalDays - challengeElapsedDays());
    }

    function challengeProgressRatio() {
      const challenge = moneyChallengeState();
      return clamp(challengeElapsedDays() / Math.max(1, challenge.totalDays), 0, 1);
    }

    function trackChallengeMoneyPeak() {
      const challenge = moneyChallengeState();
      const current = Math.round(totalMoneyScore());
      challenge.bestMoney = Math.max(Number(challenge.bestMoney) || 0, current);
    }

    function buildChallengeResults() {
      const livingHeroes = state.people
        .filter((p) => p.isHero)
        .map((p) => ({
          name: p.name,
          careerEarnings: Math.max(0, Math.round(Number(p.careerEarnings) || 0)),
          money: Math.max(0, Math.round(Number(p.money) || 0)),
          alive: true,
          reason: ""
        }));
      const fallenHeroes = state.graves
        .filter((g) => g && g.isHero)
        .map((g) => ({
          name: String(g.name || "Unknown hero"),
          careerEarnings: Math.max(0, Math.round(Number(g.careerEarnings) || 0)),
          money: Math.max(0, Math.round(Number(g.moneyAtDeath) || 0)),
          alive: false,
          reason: String(g.reason || "unknown")
        }));
      const all = [...livingHeroes, ...fallenHeroes];
      all.sort((a, b) => {
        if (b.careerEarnings !== a.careerEarnings) {
          return b.careerEarnings - a.careerEarnings;
        }
        return b.money - a.money;
      });
      return all.slice(0, HERO_TARGET_COUNT);
    }

    function ensureChallengeResults() {
      const challenge = moneyChallengeState();
      if (!challenge.finished) {
        return;
      }
      if (!Array.isArray(challenge.results) || challenge.results.length === 0) {
        challenge.results = buildChallengeResults();
      }
      challenge.winner = challenge.results.length > 0 ? challenge.results[0] : null;
    }

    function completeMoneyChallenge() {
      const challenge = moneyChallengeState();
      if (challenge.finished) {
        return;
      }
      trackChallengeMoneyPeak();
      challenge.finished = true;
      challenge.finishedDay = Math.max(1, Math.floor(state.day));
      challenge.finalMoney = Math.round(totalMoneyScore());
      challenge.bestMoney = Math.max(Number(challenge.bestMoney) || 0, challenge.finalMoney);
      challenge.results = buildChallengeResults();
      challenge.winner = challenge.results.length > 0 ? challenge.results[0] : null;
      state.paused = true;
      addEvent(`5-year challenge complete. Final money: $${challenge.finalMoney}. Peak money: $${challenge.bestMoney}.`);
      if (challenge.winner) {
        addEvent(`Winner: ${challenge.winner.name} with $${challenge.winner.careerEarnings} earned.`);
      }
      for (let i = 0; i < challenge.results.length; i++) {
        const row = challenge.results[i];
        addEvent(`#${i + 1} ${row.name}: earned $${row.careerEarnings}, cash $${row.money}${row.alive ? "" : `, died (${row.reason})`}.`);
      }
      syncUiToggles();
    }

    function updateMoneyChallengeProgress() {
      const challenge = moneyChallengeState();
      trackChallengeMoneyPeak();
      if (!challenge.finished && challengeElapsedDays() >= challenge.totalDays) {
        completeMoneyChallenge();
      }
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
          bank: incomingBuilt.bank !== false,
          townhall: Boolean(incomingBuilt.townhall),
          market: Boolean(incomingBuilt.market),
          farm: Boolean(incomingBuilt.farm)
        };
      } else {
        const legacyBuilt = false;
        state.city.built = {
          bank: true,
          townhall: legacyBuilt,
          market: legacyBuilt,
          farm: legacyBuilt
        };
      }
      const incomingBank = incoming.bank && typeof incoming.bank === "object" ? incoming.bank : {};
      state.bank = {
        treasury: Math.max(0, Number(incomingBank.treasury) || 0)
      };
      const incomingConstruction = incomingCity.construction && typeof incomingCity.construction === "object"
        ? incomingCity.construction
        : {};
      state.city.construction = {
        townhall: incomingConstruction.townhall && typeof incomingConstruction.townhall === "object" ? incomingConstruction.townhall : null,
        market: incomingConstruction.market && typeof incomingConstruction.market === "object" ? incomingConstruction.market : null,
        farm: incomingConstruction.farm && typeof incomingConstruction.farm === "object" ? incomingConstruction.farm : null,
        houses: Array.isArray(incomingConstruction.houses) ? incomingConstruction.houses : []
      };

      state.market = { ...base.market, ...incomingMarket };
      state.market.stocks = { ...base.market.stocks, ...(incomingMarket.stocks || {}) };
      state.market.demand = { ...base.market.demand, ...(incomingMarket.demand || {}) };
      state.market.dailyNeed = { ...base.market.dailyNeed, ...(incomingMarket.dailyNeed || {}) };
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
        isHero: Boolean(p.isHero),
        heroSlot: Number.isFinite(p.heroSlot) ? Math.max(1, Math.floor(p.heroSlot)) : null,
        careerEarnings: Math.max(0, Math.round(Number(p.careerEarnings) || 0)),
        ignoredNeedsHours: Math.max(0, Number(p.ignoredNeedsHours) || 0),
        needsWarningCooldown: Math.max(0, Number(p.needsWarningCooldown) || 0),
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
      if (state.selectedBuilding && state.selectedBuilding.startsWith("building:")) {
        const buildingKey = state.selectedBuilding.split(":")[1];
        if (!isBuildingBuilt(buildingKey)) {
          state.selectedBuilding = null;
        }
      }
      if (typeof state.selectedObject !== "string" && state.selectedObject !== null) {
        state.selectedObject = null;
      }
      if (typeof state.selectedObject === "string" && state.selectedObject.startsWith("road:")) {
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
      const incomingChallenge = incoming.challenge && typeof incoming.challenge === "object" ? incoming.challenge : {};
      const challengeStartDay = Number.isFinite(incomingChallenge.startDay)
        ? Math.max(1, Math.floor(incomingChallenge.startDay))
        : Math.max(1, Math.floor(state.day));
      const challengeTotalDays = Number.isFinite(incomingChallenge.totalDays)
        ? Math.max(30, Math.floor(incomingChallenge.totalDays))
        : CHALLENGE_TOTAL_DAYS;
      state.challenge = {
        ...createChallengeState(challengeStartDay),
        ...incomingChallenge,
        startDay: challengeStartDay,
        totalDays: challengeTotalDays,
        targetYears: CHALLENGE_YEARS,
        finished: Boolean(incomingChallenge.finished),
        finishedDay: Number.isFinite(incomingChallenge.finishedDay) ? Math.max(1, Math.floor(incomingChallenge.finishedDay)) : null,
        finalMoney: Math.max(0, Math.round(Number(incomingChallenge.finalMoney) || 0)),
        bestMoney: Math.max(0, Math.round(Number(incomingChallenge.bestMoney) || 0)),
        results: Array.isArray(incomingChallenge.results) ? incomingChallenge.results : [],
        winner: incomingChallenge.winner && typeof incomingChallenge.winner === "object" ? incomingChallenge.winner : null
      };
      applyWorldSettings(incoming.worldSettings || state.worldSettings);
      normalizeObjectTextureSpacing();
      computeDemandAndPrices();
      rebalanceJobs();
      updateMoneyChallengeProgress();
      if (state.challenge.finished) {
        state.paused = true;
        ensureChallengeResults();
      }
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
      if (ui.toolsPanel) {
        ui.toolsPanel.classList.toggle("hidden", !uiState.toolsOpen);
      }
      if (ui.resourceMapBtn && ui.resourceWorldBtn) {
        ui.resourceMapBtn.classList.toggle("active", uiState.resourceView === "map");
        ui.resourceWorldBtn.classList.toggle("active", uiState.resourceView === "world");
      }
      if (ui.worldSettingsBtn) {
        ui.worldSettingsBtn.classList.toggle("active", uiState.worldSettingsOpen);
        ui.worldSettingsBtn.textContent = uiState.worldSettingsOpen ? "Close Settings" : "World Settings";
      }
      if (ui.worldSettingsModal) {
        ui.worldSettingsModal.classList.toggle("hidden", !uiState.worldSettingsOpen);
      }
      document.body.classList.toggle("modal-open", uiState.worldSettingsOpen);
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

    function readWorldSettingsFromForm() {
      return {
        mechanics: {
          needs: ui.wsMechanicNeedsInput ? ui.wsMechanicNeedsInput.checked : undefined,
          trade: ui.wsMechanicTradeInput ? ui.wsMechanicTradeInput.checked : undefined,
          dynamicPricing: ui.wsMechanicDynamicPricingInput ? ui.wsMechanicDynamicPricingInput.checked : undefined,
          jobRebalance: ui.wsMechanicJobRebalanceInput ? ui.wsMechanicJobRebalanceInput.checked : undefined,
          resourceRegen: ui.wsMechanicResourceRegenInput ? ui.wsMechanicResourceRegenInput.checked : undefined,
          construction: ui.wsMechanicConstructionInput ? ui.wsMechanicConstructionInput.checked : undefined
        }
      };
    }

    function fillWorldSettingsForm() {
      if (!ui.wsMechanicNeedsInput) {
        return;
      }
      const settings = sanitizeWorldSettings(runtimeWorldSettings());
      ui.wsMechanicNeedsInput.checked = settings.mechanics.needs;
      ui.wsMechanicTradeInput.checked = settings.mechanics.trade;
      ui.wsMechanicDynamicPricingInput.checked = settings.mechanics.dynamicPricing;
      ui.wsMechanicJobRebalanceInput.checked = settings.mechanics.jobRebalance;
      ui.wsMechanicResourceRegenInput.checked = settings.mechanics.resourceRegen;
      ui.wsMechanicConstructionInput.checked = settings.mechanics.construction;
    }

    function setWorldSettingsModalOpen(open) {
      uiState.worldSettingsOpen = Boolean(open);
      if (uiState.worldSettingsOpen) {
        fillWorldSettingsForm();
        resetMovementKeys();
        isDragging = false;
        canvas.classList.remove("is-grabbing");
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
      const currentSettings = cloneWorldSettings(sanitizeWorldSettings(runtimeWorldSettings()));
      state = createInitialState(true);
      applyWorldSettings(currentSettings);
      normalizeObjectTextureSpacing();
      initPopulation(HERO_TARGET_COUNT);
      computeDemandAndPrices();
      camera.resetZoom();
      state.paused = false;
      autosaveTimer = 0;
      addEvent(`New 5-year challenge started with ${HERO_TARGET_COUNT} heroes. Goal: maximize money.`);
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
      const person = {
        id,
        name: `${pick(NAMES)} #${id}`,
        x,
        y,
        targetX: x,
        targetY: y,
        speed: rand(110, 145),
        ageDays: rand(18, 70),
        health: rand(72, 100),
        hunger: rand(18, 48),
        money: rand(16, 42),
        role: profession,
        baseProfession: profession,
        experience: createExperienceProfile(profession),
        switchPenaltyHours: 0,
        facing: "down",
        isHero: Boolean(opts.isHero),
        heroSlot: Number.isFinite(opts.heroSlot) ? Math.max(1, Math.floor(opts.heroSlot)) : null,
        careerEarnings: 0,
        ignoredNeedsHours: 0,
        needsWarningCooldown: 0,
        homeIndex,
        alive: true,
        task: null,
        inventory: {
          food: Math.random() < 0.45 ? 1 : 0,
          logs: 0,
          herbs: 0
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
      const transfer = Math.max(0, Math.round(Number(person.money) || 0));
      const moneyAtDeath = transfer;
      if (transfer > 0) {
        state.bank.treasury += transfer;
        person.money = 0;
      }
      addVisualEffect("death", person.x, person.y - 10, 1.9);
      state.graves.push({
        name: person.name,
        ageDays: person.ageDays,
        reason,
        isHero: Boolean(person.isHero),
        heroSlot: Number.isFinite(person.heroSlot) ? person.heroSlot : null,
        moneyAtDeath,
        careerEarnings: Math.max(0, Math.round(Number(person.careerEarnings) || 0))
      });
      removePersonById(person.id, reason);
      if (transfer > 0) {
        addEvent(`${person.name} died at day ${person.ageDays.toFixed(1)} (${reason}). $${transfer} transferred to bank.`);
      } else {
        addEvent(`${person.name} died at day ${person.ageDays.toFixed(1)} (${reason}).`);
      }
    }

    function initPopulation(count) {
      for (let i = 0; i < count; i++) {
        const p = createPerson({ isHero: true, heroSlot: i + 1 });
        if (i === 0) {
          state.selectedId = p.id;
        }
      }
      rebalanceJobs();
      updateMoneyChallengeProgress();
    }

    function buttonSetActive(activeBtn) {
      [ui.speed1Btn, ui.speed3Btn, ui.speed6Btn].forEach((b) => b.classList.remove("active"));
      activeBtn.classList.add("active");
    }

    function setupUI() {
      ui.addPersonBtn.addEventListener("click", () => {
        if (state.people.length >= HERO_TARGET_COUNT) {
          addEvent(`Hero limit reached (${HERO_TARGET_COUNT}/${HERO_TARGET_COUNT}).`);
          return;
        }
        const p = createPerson({ isHero: true, heroSlot: state.people.length + 1 });
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
        if (state.challenge && state.challenge.finished) {
          return;
        }
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
          setWorldSettingsModalOpen(!uiState.worldSettingsOpen);
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
        const p = eventToCanvasPoint(ev);
        const worldPos = camera.screenToWorld(p.x, p.y);
        hoverClickable = Boolean(findPersonNear(worldPos.x, worldPos.y, PERSON_CLICK_RADIUS) || findMapObjectAt(worldPos.x, worldPos.y));
        if (isDragging) {
          canvas.style.cursor = "grabbing";
        } else {
          canvas.style.cursor = hoverClickable ? "pointer" : "grab";
        }
        if (!isDragging) {
          return;
        }
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
        canvas.style.cursor = hoverClickable ? "pointer" : "grab";
      });

      canvas.addEventListener("mouseleave", () => {
        hoverClickable = false;
        if (!isDragging) {
          canvas.style.cursor = "grab";
        }
      });

      window.addEventListener("blur", () => {
        resetMovementKeys();
        isDragging = false;
        canvas.classList.remove("is-grabbing");
        canvas.style.cursor = "grab";
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          resetMovementKeys();
          isDragging = false;
          canvas.classList.remove("is-grabbing");
          canvas.style.cursor = "grab";
        }
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

        const chosen = findPersonNear(wx, wy, PERSON_CLICK_RADIUS);

        if (chosen) {
          state.selectedId = chosen.id;
          state.selectedBuilding = null;
          state.selectedObject = null;
          return;
        }

        const objectId = findMapObjectAt(wx, wy);
        if (objectId) {
          state.selectedId = null;
          if (objectId.startsWith("building:") || objectId.startsWith("house:") || objectId.startsWith("construction:")) {
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
      canvas.style.cursor = "grab";
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

    function findPersonNear(x, y, radius = PERSON_CLICK_RADIUS) {
      let chosen = null;
      let best = Infinity;
      for (const person of state.people) {
        const d = Math.hypot(person.x - x, person.y - y);
        if (d <= radius && d < best) {
          best = d;
          chosen = person;
        }
      }
      return chosen;
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

    function scaledRectAt(x, y, w, h) {
      const scale = SIMPLE_GRAPHICS ? VISUAL_SCALE : 1;
      const sw = w * scale;
      const sh = h * scale;
      return {
        x: x + w * 0.5 - sw * 0.5,
        y: y + h * 0.5 - sh * 0.5,
        w: sw,
        h: sh
      };
    }

    function rectOverlaps(a, b, gap = OBJECT_TEXTURE_GAP) {
      return !(a.x + a.w + gap <= b.x ||
        b.x + b.w + gap <= a.x ||
        a.y + a.h + gap <= b.y ||
        b.y + b.h + gap <= a.y);
    }

    function resolveNonOverlappingPosition(x, y, w, h, occupiedRects) {
      const step = 48;
      const maxRing = 22;
      const testAt = (tx, ty) => {
        const r = scaledRectAt(tx, ty, w, h);
        if (r.x < 0 || r.y < 0 || r.x + r.w > WORLD.width || r.y + r.h > WORLD.height) {
          return false;
        }
        return !occupiedRects.some((other) => rectOverlaps(r, other, OBJECT_TEXTURE_GAP));
      };

      if (testAt(x, y)) {
        return { x, y };
      }
      for (let ring = 1; ring <= maxRing; ring++) {
        for (let gx = -ring; gx <= ring; gx++) {
          for (let gy = -ring; gy <= ring; gy++) {
            if (Math.max(Math.abs(gx), Math.abs(gy)) !== ring) {
              continue;
            }
            const tx = x + gx * step;
            const ty = y + gy * step;
            if (testAt(tx, ty)) {
              return { x: tx, y: ty };
            }
          }
        }
      }
      return { x, y };
    }

    function resolveNonOverlappingCenter(x, y, radius, occupiedRects) {
      const step = 48;
      const maxRing = 26;
      const r = Math.max(8, radius);
      const testAt = (cx, cy) => {
        const rect = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
        if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > WORLD.width || rect.y + rect.h > WORLD.height) {
          return false;
        }
        return !occupiedRects.some((other) => rectOverlaps(rect, other, OBJECT_TEXTURE_GAP));
      };
      if (testAt(x, y)) {
        return { x, y };
      }
      for (let ring = 1; ring <= maxRing; ring++) {
        for (let gx = -ring; gx <= ring; gx++) {
          for (let gy = -ring; gy <= ring; gy++) {
            if (Math.max(Math.abs(gx), Math.abs(gy)) !== ring) {
              continue;
            }
            const cx = x + gx * step;
            const cy = y + gy * step;
            if (testAt(cx, cy)) {
              return { x: cx, y: cy };
            }
          }
        }
      }
      return { x, y };
    }

    function pushCoreBuildingSlotsTo(rects) {
      for (const key of ["townhall", "bank", "farm", "market"]) {
        const b = BUILDINGS[key];
        if (!b) {
          continue;
        }
        rects.push(scaledRectAt(b.x, b.y, b.w, b.h));
      }
    }

    function resourceRadius(kind) {
      if (kind === "forest") {
        return 22 * VISUAL_SCALE;
      }
      if (kind === "orchard") {
        return 18 * VISUAL_SCALE;
      }
      return 14 * VISUAL_SCALE;
    }

    function normalizeObjectTextureSpacing() {
      enforceCoreBuildingSpacing();
      const occupied = [];
      pushCoreBuildingSlotsTo(occupied);

      if (state.city.construction) {
        for (const key of ["townhall", "market", "farm"]) {
          const p = state.city.construction[key];
          const b = BUILDINGS[key];
          if (!p || !b) {
            continue;
          }
          p.x = b.x;
          p.y = b.y;
          p.w = b.w;
          p.h = b.h;
        }
      }

      for (const h of state.city.houses) {
        const pos = resolveNonOverlappingPosition(h.x, h.y, h.w, h.h, occupied);
        h.x = pos.x;
        h.y = pos.y;
        occupied.push(scaledRectAt(h.x, h.y, h.w, h.h));
      }

      if (state.city.construction && Array.isArray(state.city.construction.houses)) {
        for (const p of state.city.construction.houses) {
          if (!p) {
            continue;
          }
          const pos = resolveNonOverlappingPosition(p.x, p.y, p.w, p.h, occupied);
          p.x = pos.x;
          p.y = pos.y;
          occupied.push(scaledRectAt(p.x, p.y, p.w, p.h));
        }
      }

      for (const patch of state.resources.wild) {
        const r = resourceRadius("wild");
        const pos = resolveNonOverlappingCenter(patch.x, patch.y, r, occupied);
        patch.x = pos.x;
        patch.y = pos.y;
        occupied.push({ x: patch.x - r, y: patch.y - r, w: r * 2, h: r * 2 });
      }
      for (const orchard of state.resources.orchards) {
        const r = resourceRadius("orchard");
        const pos = resolveNonOverlappingCenter(orchard.x, orchard.y, r, occupied);
        orchard.x = pos.x;
        orchard.y = pos.y;
        occupied.push({ x: orchard.x - r, y: orchard.y - r, w: r * 2, h: r * 2 });
      }
      for (const forest of state.resources.forests) {
        const r = resourceRadius("forest");
        const pos = resolveNonOverlappingCenter(forest.x, forest.y, r, occupied);
        forest.x = pos.x;
        forest.y = pos.y;
        occupied.push({ x: forest.x - r, y: forest.y - r, w: r * 2, h: r * 2 });
      }
    }

    function collectOccupiedRects() {
      const rects = [];
      const fixedKeys = ["bank", "townhall", "market", "farm"];
      for (const key of fixedKeys) {
        const b = BUILDINGS[key];
        if (!b) {
          continue;
        }
        if (key !== "bank" && !isBuildingBuilt(key)) {
          continue;
        }
        rects.push(scaledRectAt(b.x, b.y, b.w, b.h));
      }
      for (const h of state.city.houses) {
        rects.push(scaledRectAt(h.x, h.y, h.w, h.h));
      }
      if (state.city.construction) {
        const c = state.city.construction;
        for (const key of ["townhall", "market", "farm"]) {
          if (c[key]) {
            rects.push(scaledRectAt(c[key].x, c[key].y, c[key].w, c[key].h));
          }
        }
        if (Array.isArray(c.houses)) {
          for (const p of c.houses) {
            if (p) {
              rects.push(scaledRectAt(p.x, p.y, p.w, p.h));
            }
          }
        }
      }
      return rects;
    }

    function enforceCoreBuildingSpacing() {
      const keys = ["townhall", "bank", "farm", "market"];
      const placed = [];
      for (const key of keys) {
        const b = BUILDINGS[key];
        if (!b) {
          continue;
        }
        if (key === "townhall") {
          placed.push(scaledRectAt(b.x, b.y, b.w, b.h));
          continue;
        }
        const pos = resolveNonOverlappingPosition(b.x, b.y, b.w, b.h, placed);
        b.x = pos.x;
        b.y = pos.y;
        placed.push(scaledRectAt(b.x, b.y, b.w, b.h));
      }
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
      function hitScaledRect(rx, ry, rw, rh, scale = SIMPLE_GRAPHICS ? VISUAL_SCALE : 1) {
        const sw = rw * scale;
        const sh = rh * scale;
        const sx = rx + rw * 0.5 - sw * 0.5;
        const sy = ry + rh * 0.5 - sh * 0.5;
        return x >= sx && x <= sx + sw && y >= sy && y <= sy + sh;
      }
      if (state.city && state.city.construction) {
        const coreKeys = ["townhall", "market", "farm"];
        for (const key of coreKeys) {
          const p = state.city.construction[key];
          if (p && hitScaledRect(p.x, p.y, p.w, p.h)) {
            return `construction:${key}`;
          }
        }
        if (Array.isArray(state.city.construction.houses)) {
          for (let i = 0; i < state.city.construction.houses.length; i++) {
            const p = state.city.construction.houses[i];
            if (p && hitScaledRect(p.x, p.y, p.w, p.h)) {
              return `construction:house:${i}`;
            }
          }
        }
      }
      for (let i = 0; i < state.city.houses.length; i++) {
        const h = state.city.houses[i];
        if (hitScaledRect(h.x, h.y, h.w, h.h)) {
          return `house:${i}`;
        }
      }

      const order = ["bank", "market", "farm", "townhall"];
      for (const key of order) {
        const b = BUILDINGS[key];
        if (!b) {
          continue;
        }
        if (!isBuildingBuilt(key)) {
          continue;
        }
        if (hitScaledRect(b.x, b.y, b.w, b.h)) {
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
      return;
    }

    function decayRoadHeat(dtHours) {
      return;
    }

    function roadCells(minHeat = ROAD.drawThreshold) {
      return [];
    }

    function roadEdges(minHeat = ROAD.drawThreshold) {
      return [];
    }

    function findRoadAt(x, y) {
      return null;
    }

    function findMapObjectAt(x, y) {
      const buildingId = findBuildingAt(x, y);
      if (buildingId) {
        return buildingId;
      }
      for (let i = 0; i < state.resources.wild.length; i++) {
        const p = state.resources.wild[i];
        if (Math.hypot(p.x - x, p.y - y) <= 46 * VISUAL_SCALE) {
          return `wild:${i}`;
        }
      }
      for (let i = 0; i < state.resources.orchards.length; i++) {
        const o = state.resources.orchards[i];
        if (Math.hypot(o.x - x, o.y - y) <= 44 * VISUAL_SCALE) {
          return `orchard:${i}`;
        }
      }
      for (let i = 0; i < state.resources.forests.length; i++) {
        const f = state.resources.forests[i];
        if (Math.hypot(f.x - x, f.y - y) <= 50 * VISUAL_SCALE) {
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
        total += Math.max(0, person.inventory[g] - reserve);
      }
      return total;
    }

    function taskRole(taskType) {
      if (taskType === "gather_food" || taskType === "gather_herbs" || taskType === "gather_orchard_food") return "forager";
      if (taskType === "harvest_farm" || taskType === "tend_farm") return "farmer";
      if (taskType === "chop_wood") return "woodcutter";
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
        duration: durationHours,
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
      function sellUnitPrice(good) {
        const price = Number(state.market.prices[good]) || BASE_PRICES[good] || 1;
        const factor = good === "logs" || good === "herbs" ? GAMEPLAY.trade.sellRawFactor : GAMEPLAY.trade.sellCraftFactor;
        return Math.max(1, Math.floor(price * factor));
      }

      function expectedYield(taskType, available) {
        if (taskType === "gather_food") return Math.min(available, 2.25 * roleEfficiency(person, "forager"));
        if (taskType === "gather_orchard_food") return Math.min(available, 2.65 * roleEfficiency(person, "forager"));
        if (taskType === "gather_herbs") return Math.min(available, 1.7 * roleEfficiency(person, "forager"));
        if (taskType === "chop_wood") return Math.min(available, 2.5 * roleEfficiency(person, "woodcutter"));
        if (taskType === "harvest_farm") return Math.min(available, 3.0 * roleEfficiency(person, "farmer"));
        return 0;
      }

      function travelHours(target) {
        if (!target) {
          return 0;
        }
        const dist = Math.hypot((target.x || person.x) - person.x, (target.y || person.y) - person.y);
        return dist / Math.max(1, person.speed);
      }

      function taskScore(good, taskType, target, duration, available) {
        if (!good || available <= 0) {
          return -1;
        }
        const yieldUnits = expectedYield(taskType, available);
        if (yieldUnits <= 0) {
          return -1;
        }
        const gross = yieldUnits * sellUnitPrice(good);
        const hours = Math.max(0.3, duration + travelHours(target));
        return gross / hours;
      }

      const options = [];

      const herbsPatch = nearestPatchWith("herbs");
      if (herbsPatch && herbsPatch.patch.herbs > 0.9) {
        const target = { x: herbsPatch.patch.x, y: herbsPatch.patch.y };
        options.push({
          score: taskScore("herbs", "gather_herbs", target, 1.8, herbsPatch.patch.herbs),
          task: () => createTask("gather_herbs", target, 1.8, { patchIndex: herbsPatch.index })
        });
      }

      const orchard = richestOrchard();
      if (orchard && orchard.orchard.food > 1) {
        const target = { x: orchard.orchard.x, y: orchard.orchard.y };
        options.push({
          score: taskScore("food", "gather_orchard_food", target, 1.6, orchard.orchard.food),
          task: () => createTask("gather_orchard_food", target, 1.6, { orchardIndex: orchard.index })
        });
      }

      const foodPatch = nearestPatchWith("food");
      if (foodPatch && foodPatch.patch.food > 1) {
        const target = { x: foodPatch.patch.x, y: foodPatch.patch.y };
        options.push({
          score: taskScore("food", "gather_food", target, 1.7, foodPatch.patch.food),
          task: () => createTask("gather_food", target, 1.7, { patchIndex: foodPatch.index })
        });
      }

      const forest = richestForest();
      if (forest && forest.forest.wood > 1) {
        const target = { x: forest.forest.x, y: forest.forest.y };
        options.push({
          score: taskScore("logs", "chop_wood", target, 2.2, forest.forest.wood),
          task: () => createTask("chop_wood", target, 2.2, { forestIndex: forest.index })
        });
      }

      if (isBuildingBuilt("farm")) {
        const farm = state.resources.farm;
        const harvestTarget = { x: BUILDINGS.farm.x + 55, y: BUILDINGS.farm.y + 40 };
        if (farm.crop > 0.6) {
          options.push({
            score: taskScore("food", "harvest_farm", harvestTarget, 1.9, farm.crop),
            task: () => createTask("harvest_farm", harvestTarget, 1.9)
          });
        }
        if (farm.crop <= 1.2 || farm.fertility < farm.maxFertility * 0.68) {
          const tendTarget = { x: BUILDINGS.farm.x + 70, y: BUILDINGS.farm.y + 50 };
          const fertilityGap = clamp((farm.maxFertility - farm.fertility) / Math.max(1, farm.maxFertility), 0, 1);
          const strategicValue = sellUnitPrice("food") * (0.75 + fertilityGap * 2.6);
          const hours = Math.max(0.3, 1.8 + travelHours(tendTarget));
          options.push({
            score: strategicValue / hours,
            task: () => createTask("tend_farm", tendTarget, 1.8)
          });
        }
      }

      options.sort((a, b) => b.score - a.score);
      const best = options.find((o) => Number.isFinite(o.score) && o.score > 0);
      if (best) {
        return best.task();
      }
      return createTask("idle", buildingTarget("townhall"), 1.3);
    }

    function decideTask(person) {
      const lowHealth = person.health <= 52;
      const criticalHealth = person.health < 30;
      const highHunger = person.hunger >= GAMEPLAY.needs.eatDecisionHunger;
      const criticalHunger = person.hunger > 70;
      const criticalNeeds = criticalHunger || criticalHealth;
      const marketOpen = isBuildingBuilt("market");
      const canBuyFood = MECHANICS.trade && marketOpen && state.market.stocks.food > 0 && person.money >= state.market.prices.food;
      const canBuyHerbs = MECHANICS.trade && marketOpen && state.market.stocks.herbs > 0 && person.money >= state.market.prices.herbs;

      function foodPriorityTask() {
        if (person.inventory.food > 0 && person.hunger >= GAMEPLAY.needs.eatFromInventoryHunger) {
          return createTask("eat_food", null, 0.1);
        }
        if (canBuyFood) {
          return createTask("buy_food", { x: BUILDINGS.market.x + 55, y: BUILDINGS.market.y + 42 }, 0.5);
        }
        const orchard = richestOrchard();
        const wildFood = nearestPatchWith("food");
        const orchardFood = orchard ? orchard.orchard.food : 0;
        const wildFoodUnits = wildFood ? wildFood.patch.food : 0;
        if (orchard && orchardFood >= wildFoodUnits && orchardFood > 1) {
          return createTask("gather_orchard_food", { x: orchard.orchard.x, y: orchard.orchard.y }, 1.6, { orchardIndex: orchard.index });
        }
        if (wildFood && wildFoodUnits > 1) {
          return createTask("gather_food", { x: wildFood.patch.x, y: wildFood.patch.y }, 1.7, { patchIndex: wildFood.index });
        }
        return null;
      }

      function healthPriorityTask() {
        if (person.inventory.herbs > 0 && person.health <= 88) {
          return createTask("use_herbs", null, 0.12);
        }
        if (canBuyHerbs && person.health <= 70) {
          return createTask("buy_herbs", { x: BUILDINGS.market.x + 55, y: BUILDINGS.market.y + 42 }, 0.5);
        }
        const herbsPatch = nearestPatchWith("herbs");
        if (herbsPatch && herbsPatch.patch.herbs > 0.9) {
          return createTask("gather_herbs", { x: herbsPatch.patch.x, y: herbsPatch.patch.y }, 1.8, { patchIndex: herbsPatch.index });
        }
        return null;
      }

      if (criticalNeeds) {
        const urgentFood = foodPriorityTask();
        if (urgentFood) {
          return urgentFood;
        }
        const urgentHealth = healthPriorityTask();
        if (urgentHealth) {
          return urgentHealth;
        }
      }

      if (lowHealth) {
        const healthTask = healthPriorityTask();
        if (healthTask) {
          return healthTask;
        }
      }

      if (highHunger) {
        const foodTask = foodPriorityTask();
        if (foodTask) {
          return foodTask;
        }
      }

      if (MECHANICS.trade && sellableUnits(person) > 0) {
        return createTask("sell_goods", buildingTarget("market", 18, 8), 0.7);
      }
      return pickWorkTask(person);
    }

    function executeTask(person, task) {
      const market = state.market;
      const farm = state.resources.farm;

      if (task.type === "eat_food") {
        if (person.inventory.food > 0 && person.hunger >= GAMEPLAY.needs.eatExecuteHunger) {
          person.inventory.food -= 1;
          person.hunger = clamp(person.hunger - GAMEPLAY.needs.hungerReliefPerFood, 0, 100);
        }
        return;
      }

      if (task.type === "buy_food") {
        if (!MECHANICS.trade) {
          return;
        }
        if (market.stocks.food > 0 && person.money >= market.prices.food) {
          market.stocks.food -= 1;
          person.money -= market.prices.food;
          state.bank.treasury += market.prices.food;
          person.inventory.food += 1;
        }
        return;
      }

      if (task.type === "use_herbs") {
        if (person.inventory.herbs > 0 && person.health < 100) {
          person.inventory.herbs -= 1;
          person.health = clamp(person.health + 28, 0, 100);
        }
        return;
      }

      if (task.type === "buy_herbs") {
        if (!MECHANICS.trade) {
          return;
        }
        if (market.stocks.herbs > 0 && person.money >= market.prices.herbs) {
          market.stocks.herbs -= 1;
          person.money -= market.prices.herbs;
          state.bank.treasury += market.prices.herbs;
          person.inventory.herbs += 1;
        }
        return;
      }

      if (task.type === "sell_goods") {
        if (!MECHANICS.trade) {
          return;
        }
        for (const good of GOODS) {
          let reserve = 0;
          if (good === "food" && person.hunger > 30) {
            reserve = 1;
          }
          if (good === "herbs" && person.health < 85) {
            reserve = Math.max(reserve, 1);
          }
          const qty = Math.max(0, person.inventory[good] - reserve);
          if (qty <= 0) {
            continue;
          }
          const factor = good === "logs" || good === "herbs" ? GAMEPLAY.trade.sellRawFactor : GAMEPLAY.trade.sellCraftFactor;
          const unit = Math.max(1, Math.floor(market.prices[good] * factor));
          const sold = qty;
          if (sold <= 0) {
            continue;
          }
          person.inventory[good] -= sold;
          market.stocks[good] += sold;
          const income = sold * unit;
          person.money += income;
          person.careerEarnings = Math.max(0, Math.round(Number(person.careerEarnings) || 0)) + income;
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

    }

    function updatePersonNeeds(person, dtHours) {
      person.ageDays += dtHours / 24;
      if (!MECHANICS.needs) {
        return;
      }

      const workLoad = person.task && person.task.type !== "idle" ? 1 : 0;
      person.hunger = clamp(person.hunger + dtHours * (GAMEPLAY.needs.hungerBase + workLoad * GAMEPLAY.needs.hungerWorkBonus), 0, 100);
      if (person.switchPenaltyHours > 0) {
        person.switchPenaltyHours = Math.max(0, person.switchPenaltyHours - dtHours);
        person.hunger = clamp(person.hunger + dtHours * GAMEPLAY.needs.hungerPenaltyBonus, 0, 100);
      }

      let healthDecay = dtHours * GAMEPLAY.needs.healthBaseDecay;
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
        person.health = clamp(person.health + dtHours * GAMEPLAY.needs.healthFedRegen, 0, 100);
      }

      person.needsWarningCooldown = Math.max(0, (Number(person.needsWarningCooldown) || 0) - dtHours);
      const urgentNeeds = person.hunger >= 78 || person.health <= 34;
      const safeTasks = new Set([
        "eat_food",
        "buy_food",
        "gather_food",
        "gather_orchard_food",
        "use_herbs",
        "buy_herbs",
        "gather_herbs",
        "idle"
      ]);
      const taskType = person.task ? person.task.type : "idle";
      const ignoringNeeds = urgentNeeds && !safeTasks.has(taskType);
      if (ignoringNeeds) {
        person.ignoredNeedsHours = Math.min(72, (Number(person.ignoredNeedsHours) || 0) + dtHours);
        const extraRisk = dtHours * (0.7 + person.ignoredNeedsHours * 0.05);
        person.health = clamp(person.health - extraRisk, 0, 100);
        if (person.needsWarningCooldown <= 0) {
          addEvent(`${person.name} is ignoring critical needs and may die.`);
          person.needsWarningCooldown = 10;
        }
      } else {
        person.ignoredNeedsHours = Math.max(0, (Number(person.ignoredNeedsHours) || 0) - dtHours * 1.8);
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
            if (!Number.isFinite(task.duration) || task.duration <= 0) {
              task.duration = Math.max(0.001, Number(task.remaining) || 0.001);
            }
          }
        } else {
          if (!Number.isFinite(task.duration) || task.duration <= 0) {
            task.duration = Math.max(0.001, Number(task.remaining) || 0.001);
          }
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
      const hungryPeople = state.people.filter((p) => p.hunger >= 60).length;
      const hungerPressure = pop > 0 ? hungryPeople / pop : 0;
      const dailyFoodNeed = Math.ceil(pop * (1.2 + hungerPressure * 1.4) + 2);
      state.market.dailyNeed.food = Math.max(0, dailyFoodNeed);

      const foodNeed = Math.max(dailyFoodNeed, Math.ceil(pop * (GAMEPLAY.marketModel.foodPerPopBase + hungerPressure * GAMEPLAY.marketModel.foodHungerFactor) + 4));
      const logsNeed = Math.ceil(8 + constructionNeed * 8 + pop * GAMEPLAY.marketModel.logsPerPop);
      const herbsNeed = Math.ceil(pop * GAMEPLAY.marketModel.herbsPerPop + hungryPeople * 0.2);

      state.market.demand.food = Math.max(4, foodNeed);
      state.market.demand.logs = Math.max(8, logsNeed);
      state.market.demand.herbs = Math.max(0, herbsNeed);
      if (!MECHANICS.dynamicPricing) {
        for (const good of GOODS) {
          state.market.prices[good] = BASE_PRICES[good] || 1;
        }
        return;
      }

      for (const good of GOODS) {
        const basePrice = BASE_PRICES[good] || 1;
        const prevPrice = Number(state.market.prices[good]) || basePrice;
        const supply = state.market.stocks[good] + 1;
        const demand = state.market.demand[good] + 1;
        const shortage = Math.max(0, demand - supply);
        const shortageRatio = demand / supply;
        const shortageBoost = shortage / demand;
        const demandLoad = pop > 0 ? demand / pop : demand;
        const targetMultiplier = clamp(
          0.55 +
            shortageRatio * GAMEPLAY.marketModel.priceRatioWeight +
            shortageBoost * GAMEPLAY.marketModel.priceShortageWeight +
            demandLoad * 0.045,
          0.45,
          4.25
        );
        const targetPrice = basePrice * targetMultiplier;
        const oldWeight = GAMEPLAY.marketModel.priceSmoothingOldWeight;
        const smoothed = prevPrice * oldWeight + targetPrice * (1 - oldWeight);
        state.market.prices[good] = Math.max(1, Math.round(smoothed));
      }
    }

    function rebalanceJobs() {
      const pop = state.people.length;
      if (pop <= 0) {
        return;
      }

      const demand = state.market.demand;
      const stocks = state.market.stocks;
      const prices = state.market.prices;

      const foodGap = Math.max(0, demand.food - stocks.food);
      const logsGap = Math.max(0, demand.logs - stocks.logs);
      const herbsGap = Math.max(0, demand.herbs - stocks.herbs);
      const foodUnitValue = Math.max(1, Math.floor((prices.food || BASE_PRICES.food) * GAMEPLAY.trade.sellCraftFactor));
      const logsUnitValue = Math.max(1, Math.floor((prices.logs || BASE_PRICES.logs) * GAMEPLAY.trade.sellRawFactor));
      const herbsUnitValue = Math.max(1, Math.floor((prices.herbs || BASE_PRICES.herbs) * GAMEPLAY.trade.sellRawFactor));
      const incomePotential = {
        farmer: (isBuildingBuilt("farm") ? 3.0 : 2.2) * foodUnitValue,
        forager: Math.max(2.65 * foodUnitValue, 1.7 * herbsUnitValue),
        woodcutter: 2.5 * logsUnitValue
      };
      const foodPressure = foodGap + demand.food * 0.08;

      const driver = {
        farmer: incomePotential.farmer * 1.25 + foodPressure * 2.8,
        forager: incomePotential.forager * 1.2 + herbsGap * 2.3 + foodPressure * 1.1,
        woodcutter: incomePotential.woodcutter * 1.05 + logsGap * 1.9
      };

      if (!isBuildingBuilt("farm")) {
        driver.farmer = 0;
      }

      const minimum = {
        farmer: isBuildingBuilt("farm") && pop >= 3 ? 1 : 0,
        forager: pop >= 1 ? 1 : 0,
        woodcutter: pop >= 4 ? 1 : 0
      };

      const priority = ["farmer", "forager", "woodcutter"];
      const wants = {
        farmer: minimum.farmer,
        forager: minimum.forager,
        woodcutter: minimum.woodcutter
      };
      const fixedAssigned = wants.farmer + wants.forager + wants.woodcutter;
      let remaining = Math.max(0, pop - fixedAssigned);
      const totalDriver = Math.max(0.0001, driver.farmer + driver.forager + driver.woodcutter);

      if (remaining > 0) {
        wants.farmer += Math.floor(remaining * (driver.farmer / totalDriver));
        wants.forager += Math.floor(remaining * (driver.forager / totalDriver));
        wants.woodcutter += Math.floor(remaining * (driver.woodcutter / totalDriver));
      }
      remaining = pop - (wants.farmer + wants.forager + wants.woodcutter);
      while (remaining > 0) {
        const bestRole = priority.reduce((best, role) => (
          driver[role] > driver[best] ? role : best
        ), priority[0]);
        wants[bestRole] += 1;
        remaining -= 1;
      }

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
        const incomeBonus = incomePotential[targetRole] || 0;
        return exp * 3 + sameRoleBonus + baseBonus + condition + incomeBonus * 2 - switchPenalty;
      }

      function sourceSurplus(sourceRole) {
        if (!Object.prototype.hasOwnProperty.call(roleCounts, sourceRole)) {
          return 999;
        }
        return roleCounts[sourceRole] - (wants[sourceRole] || 0);
      }

      function bestCandidate(targetRole) {
        const candidates = state.people
          .filter((p) => p.role !== targetRole);
        candidates.sort((a, b) => {
          const surplusA = sourceSurplus(a.role);
          const surplusB = sourceSurplus(b.role);
          const sourceBiasA = a.role === "unemployed" ? 220 : (surplusA > 0 ? surplusA * 90 : -120);
          const sourceBiasB = b.role === "unemployed" ? 220 : (surplusB > 0 ? surplusB * 90 : -120);
          const scoreA = roleScore(a, targetRole) + sourceBiasA;
          const scoreB = roleScore(b, targetRole) + sourceBiasB;
          return scoreB - scoreA;
        });
        return candidates.length > 0 ? candidates[0] : null;
      }

      const maxChanges = Math.max(1, Math.floor(pop * GAMEPLAY.jobs.maxChangeRatio));
      let changes = 0;
      for (const role of priority) {
        const target = clamp(wants[role], 0, pop);
        while (roleCounts[role] < target && changes < maxChanges) {
          const candidate = bestCandidate(role);
          if (!candidate) {
            break;
          }
          const prev = candidate.role;
          if (Object.prototype.hasOwnProperty.call(roleCounts, prev)) {
            const prevNeed = wants[prev] || 0;
            if (prev !== "unemployed" && roleCounts[prev] <= prevNeed) {
              break;
            }
          }
          assignRole(candidate, role);
          if (Object.prototype.hasOwnProperty.call(roleCounts, prev)) {
            roleCounts[prev] = Math.max(0, roleCounts[prev] - 1);
          } else {
            roleCounts.unemployed = Math.max(0, roleCounts.unemployed - 1);
          }
          roleCounts[role] += 1;
          changes += 1;
        }
      }

      for (const role of priority) {
        const target = wants[role] || 0;
        while (roleCounts[role] > target && changes < maxChanges) {
          const candidates = state.people
            .filter((p) => p.role === role)
            .sort((a, b) => roleScore(a, role) - roleScore(b, role));
          if (candidates.length === 0) {
            break;
          }
          const candidate = candidates[0];
          assignRole(candidate, "unemployed");
          roleCounts[role] = Math.max(0, roleCounts[role] - 1);
          roleCounts.unemployed += 1;
          changes += 1;
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

    function createConstructionProject(key, cost, x, y, w, h, label) {
      return {
        key,
        label,
        x,
        y,
        w,
        h,
        cost: { ...cost },
        paid: { logs: 0, food: 0, cash: 0 }
      };
    }

    function constructionProgress(project) {
      if (!project || !project.cost) {
        return 0;
      }
      const logsPart = project.cost.logs > 0 ? clamp((project.paid.logs || 0) / project.cost.logs, 0, 1) : 1;
      const foodPart = project.cost.food > 0 ? clamp((project.paid.food || 0) / project.cost.food, 0, 1) : 1;
      const cashPart = project.cost.cash > 0 ? clamp((project.paid.cash || 0) / project.cost.cash, 0, 1) : 1;
      return clamp((logsPart + foodPart + cashPart) / 3, 0, 1);
    }

    function investIntoProject(project) {
      if (!project || !project.cost || !project.paid) {
        return false;
      }
      const logsNeed = Math.max(0, project.cost.logs - (project.paid.logs || 0));
      const foodNeed = Math.max(0, project.cost.food - (project.paid.food || 0));
      const cashNeed = Math.max(0, project.cost.cash - (project.paid.cash || 0));
      if (logsNeed <= 0 && foodNeed <= 0 && cashNeed <= 0) {
        return true;
      }

      const payLogs = Math.min(logsNeed, Math.max(1, Math.ceil(project.cost.logs * 0.2)), Math.floor(state.market.stocks.logs));
      const payFood = Math.min(foodNeed, Math.max(1, Math.ceil(project.cost.food * 0.2)), Math.floor(state.market.stocks.food));
      const payCash = Math.min(cashNeed, Math.max(1, Math.ceil(project.cost.cash * 0.2)), Math.floor(state.bank.treasury));
      if (payLogs > 0) {
        state.market.stocks.logs -= payLogs;
        project.paid.logs += payLogs;
      }
      if (payFood > 0) {
        state.market.stocks.food -= payFood;
        project.paid.food += payFood;
      }
      if (payCash > 0) {
        state.bank.treasury -= payCash;
        project.paid.cash += payCash;
      }
      return constructionProgress(project) >= 0.999;
    }

    function ensureConstructionProject(key, cost, label) {
      if (isBuildingBuilt(key)) {
        return null;
      }
      if (!state.city.construction || typeof state.city.construction !== "object") {
        state.city.construction = { townhall: null, market: null, farm: null, houses: [] };
      }
      if (!state.city.construction[key]) {
        const b = BUILDINGS[key];
        state.city.construction[key] = createConstructionProject(key, cost, b.x, b.y, b.w, b.h, label);
        normalizeObjectTextureSpacing();
        addEvent(`${label} construction started.`);
      }
      return state.city.construction[key];
    }

    function ensureHouseConstructionProject() {
      if (!state.city.construction || typeof state.city.construction !== "object") {
        state.city.construction = { townhall: null, market: null, farm: null, houses: [] };
      }
      if (!Array.isArray(state.city.construction.houses)) {
        state.city.construction.houses = [];
      }
      if (state.city.construction.houses.length > 0) {
        return state.city.construction.houses[0];
      }
      const p = nextHousePosition();
      const project = createConstructionProject("house", BUILD_COSTS.house, p.x, p.y, 64, 48, "House");
      state.city.construction.houses.push(project);
      normalizeObjectTextureSpacing();
      addEvent("House construction started.");
      return project;
    }

    function nextHousePosition() {
      const idx = state.city.houses.length;
      const cols = 4;
      const spacingX = 88 * VISUAL_SCALE;
      const spacingY = 76 * VISUAL_SCALE;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const hub = hubPoint();
      const cx = hub.x - ((cols - 1) * spacingX) * 0.5 + col * spacingX + rand(-8, 8);
      const cy = hub.y + 180 * VISUAL_SCALE + row * spacingY + rand(-8, 8);
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
        const project = ensureConstructionProject("townhall", BUILD_COSTS.townhall, "Town Hall");
        builtToday = investIntoProject(project);
        if (builtToday) {
          state.city.built.townhall = true;
          state.city.construction.townhall = null;
          addEvent("Town Hall was built.");
        }
      } else if (!isBuildingBuilt("market")) {
        const project = ensureConstructionProject("market", BUILD_COSTS.market, "Market");
        builtToday = investIntoProject(project);
        if (builtToday) {
          state.city.built.market = true;
          state.city.construction.market = null;
          addEvent("Market was built.");
        }
      } else if (!isBuildingBuilt("farm")) {
        const project = ensureConstructionProject("farm", BUILD_COSTS.farm, "Farm");
        builtToday = investIntoProject(project);
        if (builtToday) {
          state.city.built.farm = true;
          state.city.construction.farm = null;
          addEvent("Farm was built.");
        }
      }

      const needHomes = Math.max(0, Math.ceil((pop - state.city.houses.length * HOUSE_CAPACITY) / HOUSE_CAPACITY));
      if (!builtToday && isBuildingBuilt("townhall") && needHomes > 0) {
        const houseProject = ensureHouseConstructionProject();
        const finished = investIntoProject(houseProject);
        if (finished) {
          state.city.houses.push(createHouse(houseProject.x, houseProject.y));
          state.city.construction.houses.shift();
          addEvent("A new house was built.");
        }
      }

      // Social food program removed

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
      if (state.day % 30 === 0) {
        let taxes = 0;
        for (const person of state.people) {
          const tax = Math.max(0, Math.floor((Number(person.money) || 0) * 0.10));
          if (tax > 0) {
            person.money -= tax;
            taxes += tax;
          }
        }
        if (taxes > 0) {
          state.bank.treasury += taxes;
          addEvent(`Monthly taxes collected: $${taxes}.`);
        }
      }
      updateMoneyChallengeProgress();
    }

    function processHourTick(hourAbsolute) {
      computeDemandAndPrices();

      if (MECHANICS.jobRebalance && hourAbsolute % 6 === 0) {
        rebalanceJobs();
      }

      if (MECHANICS.trade && hourAbsolute % 12 === 0 && isBuildingBuilt("market")) {
        const exportable = Math.max(0, state.market.stocks.logs - state.market.demand.logs - GAMEPLAY.trade.exportLogReserve);
        const sold = Math.min(exportable, GAMEPLAY.trade.exportLogBatch);
        if (sold > 0) {
          state.market.stocks.logs -= sold;
          state.bank.treasury += sold * state.market.prices.logs;
        }
      }

      if (MECHANICS.construction) {
        cityProgressionAndConstruction(hourAbsolute);
      }
    }

    function updateSimulation(realDtSec) {
      const gameHours = realDtSec * state.speed;
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
      if (MECHANICS.resourceRegen) {
        updateResourceRegeneration(gameHours);
      }
      decayRoadHeat(gameHours);
    }

    function roleLabel(role) {
      return String(role || "unemployed").replaceAll("_", " ");
    }

    function taskLabel(task) {
      if (!task) return "none";
      return task.type.replaceAll("_", " ");
    }

    function updateUI() {
      updateMoneyChallengeProgress();
      const peopleCash = state.people.reduce((sum, p) => sum + (Number(p.money) || 0), 0);
      const totalWorldMoney = Math.round(totalMoneyScore());
      const challenge = moneyChallengeState();
      ensureChallengeResults();
      const elapsedDays = challengeElapsedDays();
      const daysLeft = challengeDaysLeft();
      const challengeProgress = Math.round(challengeProgressRatio() * 100);
      ui.popStat.textContent = String(state.people.length);
      ui.stageStat.textContent = state.city.stage;
      ui.dayStat.textContent = String(state.day);
      ui.marketCashStat.textContent = `$${Math.round(state.bank.treasury)}`;
      ui.worldMoneyStat.textContent = `$${totalWorldMoney}`;
      if (ui.addPersonBtn) {
        ui.addPersonBtn.disabled = state.people.length >= HERO_TARGET_COUNT || Boolean(challenge.finished);
      }
      if (ui.pauseBtn) {
        ui.pauseBtn.disabled = Boolean(challenge.finished);
      }
      if (ui.speed1Btn) {
        ui.speed1Btn.disabled = Boolean(challenge.finished);
      }
      if (ui.speed3Btn) {
        ui.speed3Btn.disabled = Boolean(challenge.finished);
      }
      if (ui.speed6Btn) {
        ui.speed6Btn.disabled = Boolean(challenge.finished);
      }

      const hh = formatHour(currentHour());
      const calendarDay = Math.max(1, state.day);
      const month = Math.floor((calendarDay - 1) / 30) % 12 + 1;
      const year = Math.floor((calendarDay - 1) / 360) + 1;
      const dayOfMonth = ((calendarDay - 1) % 30) + 1;
      const stocks = state.market.stocks;
      const forestLeft = state.resources.forests.reduce((sum, f) => sum + f.wood, 0);
      const orchardFood = state.resources.orchards.reduce((sum, o) => sum + o.food, 0);
      const wildFood = state.resources.wild.reduce((sum, p) => sum + p.food, 0);
      const wildHerbs = state.resources.wild.reduce((sum, p) => sum + p.herbs, 0);
      const resultsHtml = challenge.finished && challenge.winner
        ? `<div><b>Winner:</b> ${challenge.winner.name} (earned $${challenge.winner.careerEarnings}, cash $${challenge.winner.money})</div>
           ${challenge.results.map((row, idx) => `<div>#${idx + 1} ${row.name}: earned $${row.careerEarnings}, cash $${row.money}${row.alive ? "" : `, died (${row.reason})`}</div>`).join("")}`
        : "";
      ui.overlayText.innerHTML = `
        <div><b>Y${year} M${month} D${dayOfMonth}</b> ${hh} | Population: ${state.people.length}</div>
        <div>Stage: <b>${state.city.stage}</b> | Bank: $${Math.round(state.bank.treasury)}</div>
        <div>Goal: maximize money in ${challenge.targetYears} years | Progress: <b>${challengeProgress}%</b> (${elapsedDays}/${challenge.totalDays} days, ${daysLeft} left)</div>
        <div>${challenge.finished ? `Challenge complete. Final $${challenge.finalMoney}, peak $${challenge.bestMoney}.` : `Current money: $${totalWorldMoney} | Best so far: $${challenge.bestMoney}`}</div>
        ${resultsHtml}
        <div>Daily needs: food <b>${Math.round(state.market.dailyNeed.food || 0)}</b></div>
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
        const balances = state.people
          .slice(0, 14)
          .map((p) => `<div class="mini">${p.name}: $${Math.round(p.money || 0)}</div>`)
          .join("");
        ui.personCard.innerHTML = `
          <h2>No person selected</h2>
          <div class="mini">Click any person on the map to inspect stats and needs.</div>
          <div class="mini"><b>Balances:</b></div>
          ${balances || `<div class="mini">No people</div>`}
        `;
      } else {
        ui.personCard.innerHTML = `
          <h2>${selected.name}</h2>
          <div class="mini"><b>Age:</b> ${selected.ageDays.toFixed(1)} / ${LIFE_SPAN_DAYS} days</div>
          <div class="mini"><b>Role:</b> ${roleLabel(selected.role)}</div>
          <div class="mini"><b>Base profession:</b> ${roleLabel(selected.baseProfession || selected.role)}</div>
          <div class="mini"><b>Task:</b> ${taskLabel(selected.task)}</div>
          <div class="mini"><b>Money:</b> $${selected.money.toFixed(0)}</div>
          <div class="mini"><b>Earned:</b> $${Math.round(selected.careerEarnings || 0)}</div>
          <div class="mini"><b>Experience:</b> ${Math.round(getExperience(selected, selected.role))}%</div>
          <div class="mini"><b>Switch penalty:</b> ${selected.switchPenaltyHours > 0 ? `${selected.switchPenaltyHours.toFixed(1)}h` : "none"}</div>

          ${meterHtml("Health", selected.health, "#ca4b4b")}
          ${meterHtml("Hunger", selected.hunger, "#b58b33")}

          <div class="mini"><b>Inventory:</b></div>
          <div class="mini">Food ${selected.inventory.food} | Logs ${selected.inventory.logs} | Herbs ${selected.inventory.herbs}</div>
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
        `<div class="legend-row"><span><span class="dot" style="background:${ROLE_COLORS.forager}"></span>Forager</span><span>${counts.forager}</span></div>`,
        `<div class="legend-row"><span><span class="dot" style="background:${ROLE_COLORS.farmer}"></span>Farmer</span><span>${counts.farmer}</span></div>`,
        `<div class="legend-row"><span><span class="dot" style="background:${ROLE_COLORS.woodcutter}"></span>Woodcutter</span><span>${counts.woodcutter}</span></div>`,
        `<div class="legend-row"><span><span class="dot" style="background:${ROLE_COLORS.unemployed}"></span>Unemployed</span><span>${counts.unemployed}</span></div>`
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
          `<div>Bank treasury: <b>$${Math.round(state.bank.treasury)}</b></div>`,
          `<div>Daily food need: <b>${Math.round(state.market.dailyNeed.food || 0)}</b></div>`,
          `<div>Market food stock: <b>${stocks.food.toFixed(0)}</b></div>`,
          `<div>Market herbs stock: <b>${stocks.herbs.toFixed(0)}</b></div>`,
          `<div>Houses: <b>${state.city.houses.length}</b></div>`,
          ...state.people.slice(0, 14).map((p) => `<div>${p.name}: <b>$${Math.round(p.money || 0)}</b></div>`)
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
        
      }

      if (!selected) {
        ui.buildingCard.innerHTML = `
          <h2>No object selected</h2>
          <div class="mini">Click any object on the map to inspect description and stats.</div>
        `;
        return;
      }

      if (selected.startsWith("construction:")) {
        let project = null;
        let label = "Construction";
        if (selected === "construction:townhall") {
          project = state.city.construction ? state.city.construction.townhall : null;
          label = "Town Hall";
        } else if (selected === "construction:market") {
          project = state.city.construction ? state.city.construction.market : null;
          label = "Market";
        } else if (selected === "construction:farm") {
          project = state.city.construction ? state.city.construction.farm : null;
          label = "Farm";
        } else if (selected.startsWith("construction:house:")) {
          const idx = Number(selected.split(":")[2]);
          project = state.city.construction && Array.isArray(state.city.construction.houses)
            ? state.city.construction.houses[idx]
            : null;
          label = "House";
        }
        if (!project) {
          ui.buildingCard.innerHTML = `
            <h2>Construction</h2>
            <div class="mini">Project not found.</div>
          `;
          return;
        }
        const p = constructionProgress(project);
        ui.buildingCard.innerHTML = `
          <h2>${label} Construction</h2>
          <div class="mini"><b>Progress:</b> ${(p * 100).toFixed(0)}%</div>
          <div class="mini"><b>Logs:</b> ${project.paid.logs}/${project.cost.logs}</div>
          <div class="mini"><b>Food:</b> ${project.paid.food}/${project.cost.food}</div>
          <div class="mini"><b>Cash:</b> $${project.paid.cash}/$${project.cost.cash}</div>
          <div class="mini"><b>Coords:</b> ${Math.round(project.x)}, ${Math.round(project.y)}</div>
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
        const tradingNow = workersBusyAt(["buy_food", "sell_goods"]);
        ui.buildingCard.innerHTML = `
          <h2>Market</h2>
          <div class="mini"><b>Treasury:</b> n/a (all money goes to bank)</div>
          <div class="mini"><b>Food stock:</b> ${state.market.stocks.food.toFixed(0)} | demand ${state.market.demand.food.toFixed(0)}</div>
          <div class="mini"><b>Herbs stock:</b> ${state.market.stocks.herbs.toFixed(0)} | demand ${state.market.demand.herbs.toFixed(0)}</div>
          <div class="mini"><b>Active traders right now:</b> ${tradingNow}</div>
        `;
        return;
      }

      if (key === "bank") {
        ui.buildingCard.innerHTML = `
          <h2>Bank</h2>
          <div class="mini"><b>State funds:</b> $${Math.round(state.bank.treasury)}</div>
          <div class="mini"><b>Rule:</b> all institutional money is stored here.</div>
          <div class="mini"><b>Tax:</b> 10% monthly from each person.</div>
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
          <div class="mini"><b>City treasury:</b> n/a (money stored in bank)</div>
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

    function drawImageCoverTo(targetCtx, img, x, y, w, h) {
      if (!imageReady(img)) {
        return false;
      }
      targetCtx.drawImage(img, x, y, w, h);
      return true;
    }

    function tileCacheKey(img, tx, ty, size) {
      return `${img.src}|${tx}|${ty}|${size}`;
    }

    function getTileCanvas(img, tx, ty, size = 16) {
      if (!imageReady(img)) {
        return null;
      }
      const key = tileCacheKey(img, tx, ty, size);
      if (tileCanvasCache.has(key)) {
        return tileCanvasCache.get(key);
      }
      const sx = tx * size;
      const sy = ty * size;
      if (sx < 0 || sy < 0 || sx + size > img.naturalWidth || sy + size > img.naturalHeight) {
        return null;
      }
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const cctx = c.getContext("2d");
      cctx.imageSmoothingEnabled = false;
      cctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
      tileCanvasCache.set(key, c);
      return c;
    }

    function getTilePattern(img, tx, ty, size = 16) {
      const tile = getTileCanvas(img, tx, ty, size);
      if (!tile) {
        return null;
      }
      const key = `pattern:${tileCacheKey(img, tx, ty, size)}`;
      if (tilePatternCache.has(key)) {
        return tilePatternCache.get(key);
      }
      const pattern = ctx.createPattern(tile, "repeat");
      tilePatternCache.set(key, pattern || null);
      return pattern || null;
    }

    function drawTile(img, tx, ty, dx, dy, dw = 16, dh = 16, size = 16) {
      const tile = getTileCanvas(img, tx, ty, size);
      if (!tile) {
        return false;
      }
      ctx.drawImage(tile, dx, dy, dw, dh);
      return true;
    }

    function drawTileTo(targetCtx, img, tx, ty, dx, dy, dw = 16, dh = 16, size = 16) {
      const tile = getTileCanvas(img, tx, ty, size);
      if (!tile) {
        return false;
      }
      targetCtx.drawImage(tile, dx, dy, dw, dh);
      return true;
    }

    function seedUnit(seed) {
      const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return s - Math.floor(s);
    }

    function pushDecorSprite(list, spriteKey, x, y, w, h) {
      list.push({
        spriteKey,
        x,
        y,
        w,
        h,
        sortY: y + h
      });
    }

    function addTiledDecor(list, spriteKey, x, y, cols, rows, tileW, tileH, jitterSeed = 0) {
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const seed = jitterSeed + gy * 91 + gx * 37;
          const ox = (seedUnit(seed) - 0.5) * 2.2;
          const oy = (seedUnit(seed + 0.77) - 0.5) * 2.2;
          pushDecorSprite(
            list,
            spriteKey,
            x + gx * tileW + ox,
            y + gy * tileH + oy,
            tileW,
            tileH
          );
        }
      }
    }

    function buildWorldDecor() {
      const list = [];
      const town = BUILDINGS.townhall || { x: WORLD.width * 0.5 - 60, y: WORLD.height * 0.5 - 50, w: 120, h: 90 };
      const market = BUILDINGS.market || { x: town.x + 160, y: town.y + 28, w: 130, h: 94 };
      const farm = BUILDINGS.farm || { x: town.x - 190, y: town.y + 34, w: 130, h: 95 };
      const cx = town.x + town.w * 0.5;
      const cy = town.y + town.h * 0.5;

      // Courtyard paths around village center.
      for (let gy = -7; gy <= 7; gy++) {
        for (let gx = -10; gx <= 10; gx++) {
          const seed = gx * 41 + gy * 97 + 1003;
          const keep = Math.abs(gx) + Math.abs(gy) < 12 || seedUnit(seed) > 0.28;
          if (!keep) {
            continue;
          }
          pushDecorSprite(
            list,
            "pathTile",
            cx + gx * 16 - 8 + (seedUnit(seed + 1) - 0.5) * 1.8,
            cy + gy * 16 - 8 + (seedUnit(seed + 2) - 0.5) * 1.8,
            16,
            16
          );
        }
      }

      // Yard and farm patches.
      addTiledDecor(list, "farm", farm.x - 76, farm.y + 28, 4, 3, 28, 28, 211);
      addTiledDecor(list, "farm", farm.x + farm.w - 10, farm.y + 18, 3, 3, 24, 24, 517);
      addTiledDecor(list, "farm", town.x - 48, town.y + town.h + 10, 3, 2, 24, 24, 733);
      addTiledDecor(list, "farm", market.x + market.w + 10, market.y + 18, 2, 2, 26, 26, 967);

      // Props near buildings.
      pushDecorSprite(list, "townhall", town.x - 84, town.y + 18, 74, 34);
      pushDecorSprite(list, "market", market.x + market.w - 18, market.y + market.h - 18, 20, 20);
      pushDecorSprite(list, "iconFarm", farm.x + farm.w + 24, farm.y + 14, 26, 26);
      pushDecorSprite(list, "iconTownhall", town.x + town.w + 22, town.y + 4, 32, 32);
      pushDecorSprite(list, "iconMarket", market.x + 14, market.y - 30, 24, 24);

      // Decorative trees and critters across map.
      for (let i = 0; i < 140; i++) {
        const seed = i * 17.33 + 9.1;
        const x = 48 + seedUnit(seed) * (WORLD.width - 96);
        const y = 44 + seedUnit(seed + 1.7) * (WORLD.height - 88);
        const nearVillage = Math.hypot(x - cx, y - cy) < 190;
        if (nearVillage) {
          continue;
        }
        const s = 0.7 + seedUnit(seed + 3.6) * 0.5;
        pushDecorSprite(list, "forest", x - 22 * s, y - 54 * s, 44 * s, 56 * s);
      }

      for (let i = 0; i < 34; i++) {
        const seed = i * 23.71 + 300.5;
        const angle = seedUnit(seed) * Math.PI * 2;
        const radius = 130 + seedUnit(seed + 1.2) * 320;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const pickAnimal = seedUnit(seed + 2.6);
        const spriteKey = pickAnimal < 0.33 ? "iconTownhall" : (pickAnimal < 0.66 ? "wild" : "wild");
        const size = 24 + seedUnit(seed + 4.1) * 12;
        pushDecorSprite(list, spriteKey, x - size * 0.5, y - size * 0.65, size, size);
      }

      list.sort((a, b) => a.sortY - b.sortY);
      return list;
    }

    function drawWorldDecor() {
      for (const item of worldDecor) {
        const sprite = sprites[item.spriteKey];
        drawImageCover(sprite, item.x, item.y, item.w, item.h);
      }
    }

    function drawWorldDecorTo(targetCtx) {
      for (const item of worldDecor) {
        const sprite = sprites[item.spriteKey];
        drawImageCoverTo(targetCtx, sprite, item.x, item.y, item.w, item.h);
      }
    }

    function drawSlicedEnvironmentLayerTo(targetCtx) {
      if (!imageReady(sprites.springTileset)) {
        return;
      }
      const town = BUILDINGS.townhall;
      if (!town) {
        return;
      }
      const baseX = Math.round(town.x - 160);
      const baseY = Math.round(town.y - 120);
      const cols = 30;
      const rows = 22;
      const s = TILESET.size;

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const seed = gx * 31 + gy * 57 + 123;
          const tile = seedUnit(seed) > 0.82 ? TILESET.spring.grassB : TILESET.spring.grassA;
          drawTileTo(targetCtx, sprites.springTileset, tile.x, tile.y, baseX + gx * s, baseY + gy * s, s, s, s);
          if (seedUnit(seed + 0.41) > 0.93) {
            const deco = seedUnit(seed + 0.95) > 0.5 ? TILESET.spring.flower : TILESET.spring.clover;
            drawTileTo(targetCtx, sprites.springTileset, deco.x, deco.y, baseX + gx * s, baseY + gy * s, s, s, s);
          }
        }
      }

      const cx = Math.round(town.x + town.w * 0.5 - 4 * s);
      const cy = Math.round(town.y + town.h * 0.5 - 4 * s);
      for (let i = 0; i < 9; i++) {
        drawTileTo(targetCtx, sprites.springTileset, TILESET.spring.path.x, TILESET.spring.path.y, cx + i * s, cy + 4 * s, s, s, s);
        drawTileTo(targetCtx, sprites.springTileset, TILESET.spring.path.x, TILESET.spring.path.y, cx + 4 * s, cy + i * s, s, s, s);
      }

      if (!imageReady(sprites.freePack)) {
        return;
      }
      const fx = baseX + 2 * s;
      const fy = baseY + rows * s - 2 * s;
      for (let i = 0; i < 16; i++) {
        drawTileTo(targetCtx, sprites.freePack, TILESET.free.fence.x, TILESET.free.fence.y, fx + i * s, fy, s, s, s);
      }
      for (let i = 0; i < 12; i++) {
        const seed = i * 17.2 + 0.7;
        const x = baseX + Math.floor(seedUnit(seed) * (cols - 2)) * s;
        const y = baseY + Math.floor(seedUnit(seed + 0.51) * (rows - 2)) * s;
        const tile = seedUnit(seed + 1.2) > 0.55 ? TILESET.free.bush : TILESET.free.rock;
        drawTileTo(targetCtx, sprites.freePack, tile.x, tile.y, x, y, s, s, s);
      }
      for (let i = 0; i < 18; i++) {
        const seed = i * 29.7 + 7;
        const x = baseX + 8 * s + Math.floor(seedUnit(seed) * 10) * s;
        const y = baseY + 10 * s + Math.floor(seedUnit(seed + 0.8) * 8) * s;
        drawTileTo(targetCtx, sprites.freePack, TILESET.free.crop.x, TILESET.free.crop.y, x, y, s, s, s);
      }
    }

    function ensureStaticWorldLayer() {
      if (staticWorldLayer.ready) {
        return true;
      }
      if (SIMPLE_GRAPHICS) {
        const cctxSimple = staticWorldLayer.ctx;
        if (!cctxSimple) {
          return false;
        }
        cctxSimple.clearRect(0, 0, WORLD.width, WORLD.height);
        cctxSimple.fillStyle = "#2f7a43";
        cctxSimple.fillRect(0, 0, WORLD.width, WORLD.height);
        cctxSimple.strokeStyle = "rgba(255,255,255,0.04)";
        cctxSimple.lineWidth = 1;
        for (let x = 0; x <= WORLD.width; x += 64) {
          cctxSimple.beginPath();
          cctxSimple.moveTo(x, 0);
          cctxSimple.lineTo(x, WORLD.height);
          cctxSimple.stroke();
        }
        for (let y = 0; y <= WORLD.height; y += 64) {
          cctxSimple.beginPath();
          cctxSimple.moveTo(0, y);
          cctxSimple.lineTo(WORLD.width, y);
          cctxSimple.stroke();
        }
        staticWorldLayer.ready = true;
        return true;
      }
      const staticAssetsReady = imageReady(sprites.background) &&
        imageReady(sprites.springTileset) &&
        imageReady(sprites.freePack) &&
        worldDecor.every((item) => imageReady(sprites[item.spriteKey]));
      const cctx = staticWorldLayer.ctx;
      if (!cctx) {
        return false;
      }
      cctx.clearRect(0, 0, WORLD.width, WORLD.height);
      if (imageReady(sprites.background)) {
        const pattern = cctx.createPattern(sprites.background, "repeat");
        if (pattern) {
          cctx.fillStyle = pattern;
          cctx.fillRect(0, 0, WORLD.width, WORLD.height);
        } else {
          drawImageCoverTo(cctx, sprites.background, 0, 0, WORLD.width, WORLD.height);
        }
      } else {
        cctx.fillStyle = "#20453f";
        cctx.fillRect(0, 0, WORLD.width, WORLD.height);
      }
      drawSlicedEnvironmentLayerTo(cctx);
      drawWorldDecorTo(cctx);
      staticWorldLayer.ready = staticAssetsReady;
      return true;
    }

    function drawSlicedEnvironmentLayer() {
      if (!imageReady(sprites.springTileset)) {
        return;
      }
      const town = BUILDINGS.townhall;
      if (!town) {
        return;
      }
      const baseX = Math.round(town.x - 160);
      const baseY = Math.round(town.y - 120);
      const cols = 30;
      const rows = 22;
      const s = TILESET.size;

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const seed = gx * 31 + gy * 57 + 123;
          const tile = seedUnit(seed) > 0.82 ? TILESET.spring.grassB : TILESET.spring.grassA;
          drawTile(sprites.springTileset, tile.x, tile.y, baseX + gx * s, baseY + gy * s, s, s, s);
          if (seedUnit(seed + 0.41) > 0.93) {
            const deco = seedUnit(seed + 0.95) > 0.5 ? TILESET.spring.flower : TILESET.spring.clover;
            drawTile(sprites.springTileset, deco.x, deco.y, baseX + gx * s, baseY + gy * s, s, s, s);
          }
        }
      }

      // Courtyard path cross.
      const cx = Math.round(town.x + town.w * 0.5 - 4 * s);
      const cy = Math.round(town.y + town.h * 0.5 - 4 * s);
      for (let i = 0; i < 9; i++) {
        drawTile(sprites.springTileset, TILESET.spring.path.x, TILESET.spring.path.y, cx + i * s, cy + 4 * s, s, s, s);
        drawTile(sprites.springTileset, TILESET.spring.path.x, TILESET.spring.path.y, cx + 4 * s, cy + i * s, s, s, s);
      }

      if (imageReady(sprites.freePack)) {
        // Fence strip.
        const fx = baseX + 2 * s;
        const fy = baseY + rows * s - 2 * s;
        for (let i = 0; i < 16; i++) {
          drawTile(sprites.freePack, TILESET.free.fence.x, TILESET.free.fence.y, fx + i * s, fy, s, s, s);
        }
        // Bushes and rocks.
        for (let i = 0; i < 12; i++) {
          const seed = i * 17.2 + 0.7;
          const x = baseX + Math.floor(seedUnit(seed) * (cols - 2)) * s;
          const y = baseY + Math.floor(seedUnit(seed + 0.51) * (rows - 2)) * s;
          const tile = seedUnit(seed + 1.2) > 0.55 ? TILESET.free.bush : TILESET.free.rock;
          drawTile(sprites.freePack, tile.x, tile.y, x, y, s, s, s);
        }
        // Crop mini-patches.
        for (let i = 0; i < 18; i++) {
          const seed = i * 29.7 + 7;
          const x = baseX + 8 * s + Math.floor(seedUnit(seed) * 10) * s;
          const y = baseY + 10 * s + Math.floor(seedUnit(seed + 0.8) * 8) * s;
          drawTile(sprites.freePack, TILESET.free.crop.x, TILESET.free.crop.y, x, y, s, s, s);
        }
      }
    }

    function drawSelectionMarker(x, y, size = 18) {
      if (SIMPLE_GRAPHICS) {
        const s = size * VISUAL_SCALE;
        ctx.beginPath();
        ctx.arc(x, y - s * 0.25, s * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }
      if (!drawImageCover(sprites.market, x - size * 0.5, y - size * 1.08, size, size)) {
        drawImageCover(sprites.pathTile, x - size * 0.5, y - size * 1.08, size, size);
      }
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

    function drawAtlasFrame(img, srcX, srcY, frameW, frameH, frame, row, dx, dy, dw, dh) {
      if (!imageReady(img) || frameW <= 0 || frameH <= 0) {
        return false;
      }
      const fx = srcX + Math.floor(frame) * frameW;
      const fy = srcY + Math.floor(row) * frameH;
      if (fx < 0 || fy < 0 || fx + frameW > img.naturalWidth || fy + frameH > img.naturalHeight) {
        return false;
      }
      ctx.drawImage(img, fx, fy, frameW, frameH, dx, dy, dw, dh);
      return true;
    }

    function animatedFrame(fps, frames, seed = 0) {
      if (!Number.isFinite(fps) || !Number.isFinite(frames) || frames <= 0) {
        return 0;
      }
      return Math.floor((state.absHours * fps + seed) % frames);
    }

    function drawPersonSprite(person) {
      if (SIMPLE_GRAPHICS) {
        return false;
      }
      const anim = SHEET_ANIMS.person;
      const hasMoveTask = Boolean(person.task && person.task.phase === "move");
      const distToTarget = person.task ? Math.hypot((person.task.targetX || person.x) - person.x, (person.task.targetY || person.y) - person.y) : 0;
      const moving = hasMoveTask && distToTarget > 1.25;
      const facing = normalizeFacing(person.facing);
      const row = anim.rowByFacing[facing] ?? anim.rowByFacing.down;
      const frame = moving ? animatedFrame(anim.walkFps, anim.walkFrames, person.id * 0.37) : anim.idleFrame;
      const dw = 42;
      const dh = 58;
      const dx = person.x - dw * 0.5;
      const dy = person.y - dh * 0.82;

      const walk = sprites.personWalk;
      const idle = sprites.personIdle;
      if (imageReady(walk)) {
        // Render both walk and idle from one sheet to avoid visual blinking between mismatched atlases.
        if (drawSheetFrame(walk, 12, 6, frame, row, dx, dy, dw, dh)) {
          return true;
        }
      }
      if (imageReady(idle)) {
        if (drawSheetFrame(idle, 8, 6, moving ? frame : 1, row, dx, dy, dw, dh)) {
          return true;
        }
      }

      const img = sprites.personSheet;
      if (!imageReady(img)) {
        return false;
      }
      return drawAtlasFrame(
        img,
        anim.atlasX,
        anim.atlasY,
        anim.frameW,
        anim.frameH,
        frame,
        row,
        dx,
        dy,
        dw,
        dh
      );
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
      if (SIMPLE_GRAPHICS) {
        const sw = b.w * VISUAL_SCALE;
        const sh = b.h * VISUAL_SCALE;
        const sx = b.x + b.w * 0.5 - sw * 0.5;
        const sy = b.y + b.h * 0.5 - sh * 0.5;
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.fillStyle = "#f3f4dc";
        ctx.font = "10px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(label, sx + sw * 0.5, sy + sh * 0.58);
        if (selected) {
          drawSelectionMarker(sx + sw * 0.5, sy - 4, 20);
        }
        if (locked) {
          ctx.fillStyle = "rgba(20,20,20,0.2)";
          ctx.fillRect(sx, sy, sw, sh);
        }
        return;
      }
      const mainSprite = sprite || sprites.house;
      const scale = 1.34;
      const dw = b.w * scale;
      const dh = b.h * scale;
      const dx = b.x + b.w * 0.5 - dw * 0.5;
      const dy = b.y + b.h * 0.5 - dh * 0.58;
      drawImageCover(mainSprite, dx, dy, dw, dh);
      if (imageReady(icon)) {
        drawImageCover(icon, b.x + b.w - 24, b.y - 16, 20, 20);
      }
      if (selected) {
        drawSelectionMarker(b.x + b.w * 0.5, b.y - 4, 20);
      }
      if (locked) {
        ctx.globalAlpha = 0.3;
        drawImageCover(sprites.pathTile, b.x + b.w * 0.5 - 16, b.y + b.h * 0.5 - 16, 32, 32);
        ctx.globalAlpha = 1;
      }
    }

    function drawConstructionProject(project, selected = false) {
      if (!project) {
        return;
      }
      const progress = constructionProgress(project);
      const sw = project.w * VISUAL_SCALE;
      const sh = project.h * VISUAL_SCALE;
      const sx = project.x + project.w * 0.5 - sw * 0.5;
      const sy = project.y + project.h * 0.5 - sh * 0.5;
      ctx.fillStyle = "rgba(244, 236, 200, 0.10)";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = "rgba(95, 79, 52, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, sw, sh);

      ctx.fillStyle = "rgba(108, 190, 120, 0.55)";
      ctx.fillRect(sx, sy, sw * progress, sh);

      ctx.fillStyle = "#f3f4dc";
      ctx.font = "10px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(`${project.label} ${Math.round(progress * 100)}%`, sx + sw * 0.5, sy + sh * 0.55);
      if (selected) {
        drawSelectionMarker(sx + sw * 0.5, sy - 4, 18);
      }
    }

    function drawRoadNetwork() {
      return;
    }

    function fillZoneCircle(x, y, r, fill, stroke) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function fillZoneRect(x, y, w, h, fill, stroke) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    }

    function drawZoneOverlays() {
      ctx.save();

      for (let i = 0; i < state.resources.wild.length; i++) {
        const p = state.resources.wild[i];
        fillZoneCircle(p.x, p.y, 52, "rgba(235, 196, 106, 0.14)", "rgba(247, 217, 152, 0.6)");
      }
      for (let i = 0; i < state.resources.orchards.length; i++) {
        const o = state.resources.orchards[i];
        fillZoneCircle(o.x, o.y, 62, "rgba(124, 204, 128, 0.12)", "rgba(171, 230, 176, 0.6)");
      }
      for (let i = 0; i < state.resources.forests.length; i++) {
        const f = state.resources.forests[i];
        fillZoneCircle(f.x, f.y, 70, "rgba(69, 131, 87, 0.14)", "rgba(135, 196, 153, 0.55)");
      }

      if (isBuildingBuilt("farm")) {
        const b = BUILDINGS.farm;
        fillZoneRect(b.x - 18, b.y - 14, b.w + 36, b.h + 28, "rgba(124, 204, 128, 0.12)", "rgba(171, 230, 176, 0.6)");
      }
      if (isBuildingBuilt("market")) {
        const b = BUILDINGS.market;
        fillZoneRect(b.x - 16, b.y - 12, b.w + 32, b.h + 24, "rgba(238, 180, 96, 0.12)", "rgba(246, 207, 150, 0.62)");
      }
      if (isBuildingBuilt("townhall")) {
        const b = BUILDINGS.townhall;
        fillZoneRect(b.x - 14, b.y - 10, b.w + 28, b.h + 20, "rgba(162, 171, 232, 0.12)", "rgba(194, 201, 245, 0.62)");
      }

      for (let i = 0; i < state.city.houses.length; i++) {
        const h = state.city.houses[i];
        fillZoneRect(h.x - 8, h.y - 8, h.w + 16, h.h + 16, "rgba(186, 213, 247, 0.08)", "rgba(203, 225, 252, 0.42)");
      }

      ctx.restore();
    }

    function renderMapBase() {
      if (!SIMPLE_GRAPHICS) {
        ensureGeneratedBuildingSprites();
      }
      ensureStaticWorldLayer();
      ctx.drawImage(staticWorldLayer.canvas, 0, 0);
      drawRoadNetwork();

      if (SIMPLE_GRAPHICS) {
        for (let i = 0; i < state.city.houses.length; i++) {
          const h = state.city.houses[i];
          const sw = h.w * VISUAL_SCALE;
          const sh = h.h * VISUAL_SCALE;
          const sx = h.x + h.w * 0.5 - sw * 0.5;
          const sy = h.y + h.h * 0.5 - sh * 0.5;
          ctx.fillStyle = "#cab28a";
          ctx.strokeStyle = "#6f5a3b";
          ctx.lineWidth = 2;
          ctx.fillRect(sx, sy, sw, sh);
          ctx.strokeRect(sx, sy, sw, sh);
          ctx.fillStyle = "#8d734d";
          ctx.fillRect(sx + sw * 0.34, sy + sh * 0.58, sw * 0.32, sh * 0.42);
          if (isSelectedBuilding(`house:${i}`)) {
            drawSelectionMarker(sx + sw * 0.5, sy - 8, 20);
          }
        }

        for (let i = 0; i < state.resources.wild.length; i++) {
          const patch = state.resources.wild[i];
          fillZoneCircle(patch.x, patch.y, 14 * VISUAL_SCALE, "rgba(230, 198, 113, 0.55)", "rgba(115, 90, 46, 0.9)");
          ctx.fillStyle = "#1f2d1f";
          ctx.font = "9px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText("wild", patch.x, patch.y + 3);
          if (isSelectedObject(`wild:${i}`)) {
            drawSelectionMarker(patch.x, patch.y - 20, 18);
          }
        }

        for (let i = 0; i < state.resources.orchards.length; i++) {
          const orchard = state.resources.orchards[i];
          fillZoneCircle(orchard.x, orchard.y, 18 * VISUAL_SCALE, "rgba(117, 197, 111, 0.5)", "rgba(37, 98, 47, 0.9)");
          ctx.fillStyle = "#143418";
          ctx.font = "9px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText("orchard", orchard.x, orchard.y + 3);
          if (isSelectedObject(`orchard:${i}`)) {
            drawSelectionMarker(orchard.x, orchard.y - 20, 18);
          }
        }

        for (let i = 0; i < state.resources.forests.length; i++) {
          const f = state.resources.forests[i];
          fillZoneCircle(f.x, f.y, 22 * VISUAL_SCALE, "rgba(56, 119, 70, 0.55)", "rgba(28, 64, 37, 0.95)");
          ctx.fillStyle = "#e9f0dc";
          ctx.font = "9px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText("forest", f.x, f.y + 3);
          if (isSelectedObject(`forest:${i}`)) {
            drawSelectionMarker(f.x, f.y - 24, 18);
          }
        }

        if (state.city.construction) {
          drawConstructionProject(state.city.construction.townhall, isSelectedBuilding("construction:townhall"));
          drawConstructionProject(state.city.construction.market, isSelectedBuilding("construction:market"));
          drawConstructionProject(state.city.construction.farm, isSelectedBuilding("construction:farm"));
          if (Array.isArray(state.city.construction.houses)) {
            for (let i = 0; i < state.city.construction.houses.length; i++) {
              drawConstructionProject(state.city.construction.houses[i], isSelectedBuilding(`construction:house:${i}`));
            }
          }
        }

        if (isBuildingBuilt("bank")) {
          drawBuilding(BUILDINGS.bank, "#d4c36f", "#786933", "Bank", false, null, isSelectedBuilding("building:bank"), null);
        }
        if (isBuildingBuilt("market")) {
          drawBuilding(BUILDINGS.market, "#ac824f", "#744d27", "Market", false, null, isSelectedBuilding("building:market"), null);
        }
        if (isBuildingBuilt("farm")) {
          drawBuilding(BUILDINGS.farm, "#73954f", "#405529", "Farm", false, null, isSelectedBuilding("building:farm"), null);
        }
        if (isBuildingBuilt("townhall")) {
          drawBuilding(BUILDINGS.townhall, "#766e8e", "#4f4a63", "Town Hall", false, null, isSelectedBuilding("building:townhall"), null);
        }

        drawZoneOverlays();
        return;
      }

      // Home district
      for (let i = 0; i < state.city.houses.length; i++) {
        const h = state.city.houses[i];
        if (!drawTile(sprites.roadSheet, TILESET.road.hotspot.x, TILESET.road.hotspot.y, h.x + h.w * 0.5 - 18, h.y + h.h - 8, 16, 16, TILESET.size)) {
          drawImageCover(sprites.pathTile, h.x + h.w * 0.5 - 18, h.y + h.h - 8, 16, 16);
        }
        if (!drawTile(sprites.roadSheet, TILESET.road.hotspot.x, TILESET.road.hotspot.y, h.x + h.w * 0.5 - 2, h.y + h.h - 8, 16, 16, TILESET.size)) {
          drawImageCover(sprites.pathTile, h.x + h.w * 0.5 - 2, h.y + h.h - 8, 16, 16);
        }
        drawImageCover(sprites.farm, h.x + h.w - 8, h.y + h.h - 12, 22, 22);
        const houseScale = 1.28;
        const houseDw = h.w * houseScale;
        const houseDh = h.h * houseScale;
        const houseDx = h.x + h.w * 0.5 - houseDw * 0.5;
        const houseDy = h.y + h.h * 0.5 - houseDh * 0.58;
        drawImageCover(sprites.house, houseDx, houseDy, houseDw, houseDh);
        if (isSelectedBuilding(`house:${i}`)) {
          drawSelectionMarker(h.x + h.w * 0.5, h.y - 8, 20);
        }
      }

      // Resource patches
      for (let i = 0; i < state.resources.wild.length; i++) {
        const patch = state.resources.wild[i];
        drawImageCover(sprites.sawmill, patch.x - 54, patch.y + 2, 108, 54);
        const wildAnim = SHEET_ANIMS.wild;
        const wildFrame = animatedFrame(wildAnim.fps, wildAnim.frames, i * 0.71);
        const wildRow = i % wildAnim.rows;
        if (!drawSheetFrame(sprites.wild, wildAnim.cols, wildAnim.rows, wildFrame, wildRow, patch.x - 22, patch.y - 34, 44, 44)) {
          drawImageCover(sprites.wild, patch.x - 22, patch.y - 34, 44, 44);
        }
        if (isSelectedObject(`wild:${i}`)) {
          drawSelectionMarker(patch.x, patch.y - 20, 18);
        }
      }

      for (let i = 0; i < state.resources.orchards.length; i++) {
        const orchard = state.resources.orchards[i];
        drawImageCover(sprites.sawmill, orchard.x - 62, orchard.y - 24, 124, 62);
        drawImageCover(sprites.sawmill, orchard.x - 48, orchard.y + 2, 96, 48);
        drawImageCover(sprites.farm, orchard.x - 22, orchard.y + 2, 44, 44);
        if (isSelectedObject(`orchard:${i}`)) {
          drawSelectionMarker(orchard.x, orchard.y - 20, 18);
        }
      }

      for (let i = 0; i < state.resources.forests.length; i++) {
        const f = state.resources.forests[i];
        drawImageCover(sprites.forest, f.x - 32, f.y - 70, 64, 80);
        drawImageCover(sprites.sawmill, f.x - 52, f.y - 10, 104, 52);
        if (isSelectedObject(`forest:${i}`)) {
          drawSelectionMarker(f.x, f.y - 24, 18);
        }
      }

      if (state.city.construction) {
        drawConstructionProject(state.city.construction.townhall, isSelectedBuilding("construction:townhall"));
        drawConstructionProject(state.city.construction.market, isSelectedBuilding("construction:market"));
        drawConstructionProject(state.city.construction.farm, isSelectedBuilding("construction:farm"));
        if (Array.isArray(state.city.construction.houses)) {
          for (let i = 0; i < state.city.construction.houses.length; i++) {
            drawConstructionProject(state.city.construction.houses[i], isSelectedBuilding(`construction:house:${i}`));
          }
        }
      }

      if (isBuildingBuilt("market")) {
        drawBuilding(BUILDINGS.market, "#ac824f", "#744d27", "Market", false, generatedBuildingSprites.market || sprites.house, isSelectedBuilding("building:market"), sprites.iconMarket);
      }
      if (isBuildingBuilt("bank")) {
        drawBuilding(BUILDINGS.bank, "#d4c36f", "#786933", "Bank", false, generatedBuildingSprites.market || sprites.house, isSelectedBuilding("building:bank"), sprites.iconMarket);
      }
      if (isBuildingBuilt("farm")) {
        drawBuilding(BUILDINGS.farm, "#73954f", "#405529", "Farm", false, generatedBuildingSprites.farm || sprites.house, isSelectedBuilding("building:farm"), sprites.iconFarm);
      }
      if (isBuildingBuilt("townhall")) {
        drawBuilding(BUILDINGS.townhall, "#766e8e", "#4f4a63", "Town Hall", false, generatedBuildingSprites.townhall || sprites.house, isSelectedBuilding("building:townhall"), sprites.iconTownhall);
      }

      drawZoneOverlays();
    }

    function drawPeople() {
      function drawTaskProgress(person) {
        const task = person.task;
        if (!task || task.phase !== "act") {
          return;
        }
        const duration = Number(task.duration);
        const remaining = Number(task.remaining);
        if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(remaining)) {
          return;
        }
        const progress = clamp(1 - remaining / duration, 0, 1);
        if (progress <= 0.01) {
          return;
        }
        const cx = person.x;
        const cy = person.y - 4;
        const radius = SIMPLE_GRAPHICS ? 10 * VISUAL_SCALE : 13;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress);
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (SIMPLE_GRAPHICS) {
        for (const person of state.people) {
          const roleColor = ROLE_COLORS[person.role] || ROLE_COLORS.unemployed;
          const bodyR = 7 * VISUAL_SCALE;
          const offsetY = 4 * VISUAL_SCALE;
          ctx.fillStyle = roleColor;
          ctx.strokeStyle = "#1f1f1f";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(person.x, person.y - offsetY, bodyR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          const dir = normalizeFacing(person.facing);
          const dx = dir === "left" ? -5 * VISUAL_SCALE : (dir === "right" ? 5 * VISUAL_SCALE : 0);
          const dy = dir === "up" ? -5 * VISUAL_SCALE : (dir === "down" ? 5 * VISUAL_SCALE : 0);
          ctx.beginPath();
          ctx.moveTo(person.x, person.y - offsetY);
          ctx.lineTo(person.x + dx, person.y - offsetY + dy);
          ctx.strokeStyle = "#202020";
          ctx.lineWidth = 1.3;
          ctx.stroke();
          drawTaskProgress(person);

          if (person.id === state.selectedId) {
            drawSelectionMarker(person.x, person.y - 18, 16);
            ctx.fillStyle = "#fdf7e0";
            ctx.font = "11px Trebuchet MS";
            ctx.textAlign = "center";
            ctx.fillText(person.name, person.x, person.y - 10);
          }
        }
        return;
      }
      for (const person of state.people) {
        const drewSprite = drawPersonSprite(person);
        if (!drewSprite) {
          drawImageCover(sprites.iconTownhall, person.x - 14, person.y - 26, 28, 28);
        }
        drawTaskProgress(person);

        if (person.id === state.selectedId) {
          drawSelectionMarker(person.x, person.y - 18, 16);

          ctx.fillStyle = "#fdf7e0";
          ctx.font = "11px Trebuchet MS";
          ctx.textAlign = "center";
          ctx.fillText(person.name, person.x, person.y - 10);
        }
      }
    }

    function drawVisualEffects() {
      for (const fx of visualEffects) {
        const p = clamp(fx.ttl / Math.max(0.001, fx.maxTtl), 0, 1);
        if (fx.type === "death") {
          const r = 11;
          ctx.fillStyle = `rgba(245, 245, 245, ${p * 0.95})`;
          ctx.strokeStyle = `rgba(50, 50, 50, ${p * 0.9})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = `rgba(30, 30, 30, ${p * 0.9})`;
          ctx.beginPath();
          ctx.arc(fx.x - 3.5, fx.y - 2, 1.8, 0, Math.PI * 2);
          ctx.arc(fx.x + 3.5, fx.y - 2, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(fx.x - 3, fx.y + 3, 6, 2);
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
      drawVisualEffects();

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

      camera.update(dtSec);
    }

    function stepFrame(dtSec) {
      const dt = Math.max(0, Math.min(0.12, dtSec));
      updateCameraControls(dt);

      if (!state.paused) {
        updateSimulation(dt);
        autosaveTimer += dt;
        if (autosaveTimer >= autosaveIntervalSec) {
          saveToStorage(false);
          autosaveTimer = 0;
        }
      }
      updateVisualEffects(dt);
      render();
    }

    let lastFrame = performance.now();
    function gameLoop(now) {
      const dt = Math.min(0.12, (now - lastFrame) / 1000);
      lastFrame = now;
      stepFrame(dt);
      requestAnimationFrame(gameLoop);
    }

    function renderGameToText() {
      const challenge = moneyChallengeState();
      ensureChallengeResults();
      const heroes = [...state.people]
        .sort((a, b) => (Number(b.careerEarnings) || 0) - (Number(a.careerEarnings) || 0))
        .slice(0, HERO_TARGET_COUNT)
        .map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          x: Number(p.x.toFixed(1)),
          y: Number(p.y.toFixed(1)),
          hunger: Number(p.hunger.toFixed(1)),
          health: Number(p.health.toFixed(1)),
          money: Math.round(Number(p.money) || 0),
          earned: Math.round(Number(p.careerEarnings) || 0),
          task: p.task ? p.task.type : "none"
        }));
      const payload = {
        mode: challenge.finished ? "challenge_complete" : (state.paused ? "paused" : "running"),
        coordinateSystem: "origin top-left; x right; y down",
        time: {
          day: state.day,
          hour: formatHour(currentHour())
        },
        challenge: {
          yearsTarget: challenge.targetYears,
          daysElapsed: challengeElapsedDays(),
          daysLeft: challengeDaysLeft(),
          progress: Number(challengeProgressRatio().toFixed(3)),
          finished: challenge.finished,
          currentMoney: Math.round(totalMoneyScore()),
          bestMoney: Math.round(challenge.bestMoney || 0),
          finalMoney: Math.round(challenge.finalMoney || 0),
          winner: challenge.winner
            ? {
              name: challenge.winner.name,
              earned: challenge.winner.careerEarnings,
              cash: challenge.winner.money
            }
            : null
        },
        heroes,
        market: {
          prices: { ...state.market.prices },
          stocks: {
            food: Math.round(state.market.stocks.food || 0),
            logs: Math.round(state.market.stocks.logs || 0),
            herbs: Math.round(state.market.stocks.herbs || 0)
          }
        }
      };
      return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = (ms) => {
      const totalSeconds = clamp((Number(ms) || 0) / 1000, 0, 30);
      if (totalSeconds <= 0) {
        render();
        return;
      }
      const step = 1 / 60;
      let remaining = totalSeconds;
      while (remaining > 0) {
        const dt = Math.min(step, remaining);
        stepFrame(dt);
        remaining -= dt;
      }
    };

    async function init() {
      setupUI();
      setWorldSettingsModalOpen(false);
      resetMovementKeys();
      resizeCanvas();
      const restored = await loadFromStorage(false);
      if (!restored) {
        normalizeObjectTextureSpacing();
        initPopulation(HERO_TARGET_COUNT);
        computeDemandAndPrices();
        addEvent(`5-year challenge started with ${HERO_TARGET_COUNT} heroes. Goal: maximize money.`);
        saveToStorage(false);
      } else {
        addEvent("Save restored on startup.");
      }
      syncUiToggles();
      requestAnimationFrame(gameLoop);
    }

    init();
})();
