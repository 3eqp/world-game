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
      toggleResourcesBtn: document.getElementById("toggleResourcesBtn"),
      toolsPanel: document.getElementById("toolsPanel"),
      resourceMapBtn: document.getElementById("resourceMapBtn"),
      resourceWorldBtn: document.getElementById("resourceWorldBtn"),
      resourceList: document.getElementById("resourceList"),
      sidebar: document.querySelector(".sidebar"),
      rightbar: document.querySelector(".rightbar"),
      popStat: document.getElementById("popStat"),
      stageStat: document.getElementById("stageStat"),
      dayStat: document.getElementById("dayStat"),
      marketCashStat: document.getElementById("marketCashStat"),
      overlayText: document.getElementById("overlayText"),
      personCard: document.getElementById("personCard"),
      buildingCard: document.getElementById("buildingCard"),
      marketTable: document.getElementById("marketTable"),
      eventLog: document.getElementById("eventLog")
    };

    let state = createInitialState(false);
    const uiState = {
      toolsOpen: false,
      resourceView: "map"
    };
    const camera = Camera.createCamera(WORLD, ZOOM, CAMERA);
    const view = camera.view;
    const AUTOSAVE_INTERVAL_SEC = 20;
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
    const PROFESSIONS = ["forager", "farmer", "woodcutter", "sawmill_worker", "carpenter", "medic"];

    function createExperienceProfile(seedRole) {
      const profile = {
        forager: 0,
        farmer: 0,
        woodcutter: 0,
        sawmill_worker: 0,
        carpenter: 0,
        medic: 0
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
        nextPersonId: 1,
        people: [],
        graves: [],
        eventLog: [],
        city: {
          stage: "Subsistence",
          treasury: Math.round(380 * moneyScale),
          houses: [],
          furnitureLevel: Math.round(5 * resourceScale),
          companies: {
            sawmill: false,
            workshop: false,
            clinic: false
          }
        },
        market: {
          treasury: Math.round(2400 * moneyScale),
          stocks: {
            food: Math.round(30 * resourceScale),
            logs: Math.round(18 * resourceScale),
            planks: 0,
            furniture: Math.round(2 * resourceScale),
            herbs: Math.round(10 * resourceScale),
            medkits: Math.round(2 * resourceScale)
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
      townhall: null,
      sawmill: null,
      workshop: null,
      clinic: null
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

    function setupCity() {
      state.city.houses.push(createHouse(1180, 980));
      state.city.houses.push(createHouse(1300, 1080));
      state.city.houses.push(createHouse(1460, 1010));
      state.city.houses.push(createHouse(1200, 1180));
    }

    function hydrateState(rawState) {
      const base = createInitialState();
      const incoming = rawState && typeof rawState === "object" ? rawState : {};
      const incomingCity = incoming.city && typeof incoming.city === "object" ? incoming.city : {};
      const incomingCompanies = incomingCity.companies && typeof incomingCity.companies === "object" ? incomingCity.companies : {};
      const incomingMarket = incoming.market && typeof incoming.market === "object" ? incoming.market : {};
      const incomingResources = incoming.resources && typeof incoming.resources === "object" ? incoming.resources : {};

      state = { ...base, ...incoming };
      state.city = { ...base.city, ...incomingCity };
      state.city.companies = { ...base.city.companies, ...incomingCompanies };

      state.market = { ...base.market, ...incomingMarket };
      state.market.stocks = { ...base.market.stocks, ...(incomingMarket.stocks || {}) };
      state.market.demand = { ...base.market.demand, ...(incomingMarket.demand || {}) };
      state.market.prices = { ...base.market.prices, ...(incomingMarket.prices || {}) };

      state.resources = { ...base.resources, ...incomingResources };
      state.resources.farm = { ...base.resources.farm, ...(incomingResources.farm || {}) };
      state.resources.forests = Array.isArray(incomingResources.forests) ? incomingResources.forests : base.resources.forests;
      state.resources.orchards = Array.isArray(incomingResources.orchards) ? incomingResources.orchards : base.resources.orchards;
      state.resources.wild = Array.isArray(incomingResources.wild) ? incomingResources.wild : base.resources.wild;

      state.people = Array.isArray(incoming.people) ? incoming.people.map((p) => ({
        ...p,
        role: typeof p.role === "string" ? p.role : "unemployed",
        baseProfession: typeof p.baseProfession === "string" ? p.baseProfession : (typeof p.role === "string" ? p.role : pick(PROFESSIONS)),
        experience: {
          ...createExperienceProfile(),
          ...(p.experience && typeof p.experience === "object" ? p.experience : {})
        },
        switchPenaltyHours: Number.isFinite(p.switchPenaltyHours) ? Math.max(0, p.switchPenaltyHours) : 0,
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

      if (state.city.houses.length === 0) {
        setupCity();
      }

      const maxId = state.people.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
      state.nextPersonId = Math.max(Number(state.nextPersonId) || 1, maxId + 1);
      if (!state.people.some((p) => p.id === state.selectedId)) {
        state.selectedId = null;
      }
      if (typeof state.selectedBuilding !== "string" && state.selectedBuilding !== null) {
        state.selectedBuilding = null;
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
    }

    function updateZoomLabel() {
      if (!ui.zoomStat) {
        return;
      }
      ui.zoomStat.textContent = `Zoom: ${Math.round(view.zoom * 100)}%`;
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
      state = createInitialState(true);
      setupCity();
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
      const homeIndex = Math.floor(Math.random() * state.city.houses.length);
      const home = state.city.houses[homeIndex];
      const profession = pick(PROFESSIONS);
      const x = home.x + rand(8, home.w - 8);
      const y = home.y + rand(8, home.h - 8);
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

      ui.toggleResourcesBtn.addEventListener("click", () => {
        uiState.resourceView = uiState.resourceView === "map" ? "world" : "map";
        syncUiToggles();
      });

      ui.resourceMapBtn.addEventListener("click", () => {
        uiState.resourceView = "map";
        syncUiToggles();
      });

      ui.resourceWorldBtn.addEventListener("click", () => {
        uiState.resourceView = "world";
        syncUiToggles();
      });

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

      ui.zoomInBtn.addEventListener("click", () => {
        camera.zoomByFactor(ZOOM.step, canvas.width * 0.5, canvas.height * 0.5);
        updateZoomLabel();
      });

      ui.zoomOutBtn.addEventListener("click", () => {
        camera.zoomByFactor(1 / ZOOM.step, canvas.width * 0.5, canvas.height * 0.5);
        updateZoomLabel();
      });

      ui.zoomResetBtn.addEventListener("click", () => {
        camera.resetZoom();
        updateZoomLabel();
      });

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
        if (Object.prototype.hasOwnProperty.call(keyState, ev.code)) {
          keyState[ev.code] = true;
          ev.preventDefault();
        }
      });

      window.addEventListener("keyup", (ev) => {
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
          return;
        }

        const buildingId = findBuildingAt(wx, wy);
        if (buildingId) {
          state.selectedBuilding = buildingId;
          state.selectedId = null;
        }
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

    function buildingRole(key) {
      if (key === "sawmill") return "sawmill_worker";
      if (key === "workshop") return "carpenter";
      if (key === "clinic") return "medic";
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

      const order = ["market", "farm", "townhall", "sawmill", "workshop", "clinic"];
      for (const key of order) {
        const b = BUILDINGS[key];
        if (!b) {
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
      if (dist <= 0.001) {
        person.x = tx;
        person.y = ty;
        return true;
      }
      const step = person.speed * dtHours;
      if (step >= dist) {
        person.x = tx;
        person.y = ty;
        return true;
      }
      person.x += (dx / dist) * step;
      person.y += (dy / dist) * step;
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
        return createTask("idle", BUILDINGS.townhall, 1.5);
      }

      if (person.role === "woodcutter") {
        const logsGap = demand.logs - stocks.logs;
        const forest = richestForest();
        if (logsGap > 0 && forest && forest.forest.wood > 1.5) {
          return createTask("chop_wood", { x: forest.forest.x, y: forest.forest.y }, 2.2, { forestIndex: forest.index });
        }
        return createTask("idle", BUILDINGS.townhall, 1.4);
      }

      if (person.role === "farmer") {
        if (state.resources.farm.crop > 1.2) {
          return createTask("harvest_farm", { x: BUILDINGS.farm.x + 55, y: BUILDINGS.farm.y + 40 }, 1.9);
        }
        return createTask("tend_farm", { x: BUILDINGS.farm.x + 70, y: BUILDINGS.farm.y + 50 }, 1.8);
      }

      if (person.role === "sawmill_worker") {
        const logsEnough = stocks.logs >= 2;
        const needPlanks = demand.planks > stocks.planks;
        if (state.city.companies.sawmill && logsEnough && needPlanks) {
          return createTask("make_planks", { x: BUILDINGS.sawmill.x + 50, y: BUILDINGS.sawmill.y + 45 }, 1.8);
        }
        return createTask("idle", BUILDINGS.sawmill, 1.5);
      }

      if (person.role === "carpenter") {
        const planksEnough = stocks.planks >= 2;
        const needFurniture = demand.furniture > stocks.furniture;
        if (state.city.companies.workshop && planksEnough && needFurniture) {
          return createTask("make_furniture", { x: BUILDINGS.workshop.x + 60, y: BUILDINGS.workshop.y + 45 }, 2.2);
        }
        return createTask("idle", BUILDINGS.workshop, 1.4);
      }

      if (person.role === "medic") {
        const herbsEnough = stocks.herbs >= 2;
        const needKits = demand.medkits > stocks.medkits;
        if (state.city.companies.clinic && herbsEnough && needKits) {
          return createTask("make_medkit", { x: BUILDINGS.clinic.x + 50, y: BUILDINGS.clinic.y + 40 }, 1.8);
        }
        return createTask("idle", BUILDINGS.clinic, 1.3);
      }

      return createTask("idle", BUILDINGS.townhall, 1.2);
    }

    function decideTask(person) {
      if (person.health < 55 && person.inventory.medkits > 0) {
        return createTask("use_medkit", null, 0.1);
      }
      if (person.hunger >= 32) {
        if (person.inventory.food > 0 && person.hunger >= 28) {
          return createTask("eat_food", null, 0.1);
        }
        if (person.hunger >= 55 && state.market.stocks.food > 0 && person.money >= state.market.prices.food) {
          return createTask("buy_food", { x: BUILDINGS.market.x + 55, y: BUILDINGS.market.y + 42 }, 0.5);
        }
      }
      if (person.health < 34 && state.city.companies.clinic && state.market.stocks.medkits > 0 && person.money >= state.market.prices.medkits) {
        return createTask("buy_medkit", { x: BUILDINGS.clinic.x + 45, y: BUILDINGS.clinic.y + 38 }, 0.5);
      }
      if (sellableUnits(person) > 0) {
        return createTask("sell_goods", { x: BUILDINGS.market.x + 56, y: BUILDINGS.market.y + 42 }, 0.7);
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
      const sick = state.people.filter((p) => p.health < 55).length;
      const houses = state.city.houses.length;
      const constructionNeed = Math.max(0, Math.ceil((pop - houses * HOUSE_CAPACITY) / HOUSE_CAPACITY));

      const furnitureTarget = houses * 4;
      const furnitureNeed = Math.max(0, furnitureTarget - state.city.furnitureLevel);

      const medkitNeed = Math.ceil(sick * 1.2 + pop * 0.18);
      const herbsNeed = 4 + medkitNeed * 2;
      const foodNeed = Math.ceil(pop * 2.6 + 5);

      const planksNeed = (state.city.companies.workshop ? furnitureNeed * 2 : 0) + constructionNeed * 7 + (state.city.companies.sawmill ? 6 : 2);
      const logsNeed = (state.city.companies.sawmill ? planksNeed * 2 : 10 + constructionNeed * 8);

      state.market.demand.food = Math.max(4, foodNeed);
      state.market.demand.logs = Math.max(8, Math.ceil(logsNeed));
      state.market.demand.planks = Math.max(0, Math.ceil(planksNeed));
      state.market.demand.furniture = Math.max(0, Math.ceil(furnitureNeed));
      state.market.demand.herbs = Math.max(3, herbsNeed);
      state.market.demand.medkits = Math.max(1, medkitNeed);

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
      const herbGap = Math.max(0, demand.herbs - stocks.herbs);
      const logsGap = Math.max(0, demand.logs - stocks.logs);
      const planksGap = Math.max(0, demand.planks - stocks.planks);
      const furnitureGap = Math.max(0, demand.furniture - stocks.furniture);
      const medkitGap = Math.max(0, demand.medkits - stocks.medkits);

      const wants = {
        farmer: Math.max(1, Math.ceil(foodGap / 18)),
        forager: Math.max(1, Math.ceil((foodGap * 0.35 + herbGap) / 16)),
        woodcutter: Math.ceil(logsGap / 15),
        sawmill_worker: state.city.companies.sawmill ? Math.ceil(planksGap / 8) : 0,
        carpenter: state.city.companies.workshop ? Math.ceil(furnitureGap / 6) : 0,
        medic: state.city.companies.clinic ? Math.ceil(medkitGap / 5) : 0
      };

      const priority = ["farmer", "forager", "medic", "carpenter", "sawmill_worker", "woodcutter"];
      const roleCounts = {
        forager: 0,
        farmer: 0,
        woodcutter: 0,
        sawmill_worker: 0,
        carpenter: 0,
        medic: 0,
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
        // Very slow regrowth: finite resource pressure remains meaningful.
        const regen = 0.02 * dtHours;
        forest.wood = clamp(forest.wood + regen, 0, forest.maxWood);
      }

      for (const patch of state.resources.wild) {
        patch.food = clamp(patch.food + 0.09 * dtHours, 0, patch.maxFood);
        patch.herbs = clamp(patch.herbs + 0.05 * dtHours, 0, patch.maxHerbs);
      }

      for (const orchard of state.resources.orchards) {
        orchard.food = clamp(orchard.food + 0.18 * dtHours, 0, orchard.maxFood);
      }

      const farm = state.resources.farm;
      const growthFactor = clamp(farm.fertility / farm.maxFertility, 0.1, 1);
      farm.crop = clamp(farm.crop + growthFactor * 0.45 * dtHours, 0, farm.maxCrop);
      farm.fertility = clamp(farm.fertility + 0.09 * dtHours, 0, farm.maxFertility);
    }

    function cityProgressionAndConstruction(hourAbsolute) {
      const pop = state.people.length;

      if (!state.city.companies.sawmill && pop >= 5 && state.market.stocks.logs >= 24 && state.city.treasury >= 120) {
        state.city.companies.sawmill = true;
        state.city.treasury -= 120;
        state.city.stage = "Expanding";
        addEvent("Sawmill company opened.");
      }

      if (!state.city.companies.clinic && pop >= 6 && state.market.stocks.herbs >= 10 && state.city.treasury >= 95) {
        state.city.companies.clinic = true;
        state.city.treasury -= 95;
        state.city.stage = state.city.companies.workshop ? "Industrial" : "Expanding";
        addEvent("Clinic company opened.");
      }

      if (!state.city.companies.workshop && pop >= 7 && state.market.stocks.planks >= 10 && state.city.treasury >= 165) {
        state.city.companies.workshop = true;
        state.city.treasury -= 165;
        state.city.stage = "Industrial";
        addEvent("Furniture workshop opened.");
      }

      if (hourAbsolute % 24 !== 0) {
        return;
      }

      const needHomes = Math.max(0, Math.ceil((pop - state.city.houses.length * HOUSE_CAPACITY) / HOUSE_CAPACITY));
      if (needHomes > 0) {
        const needLogs = 14;
        const needPlanks = state.city.companies.sawmill ? 6 : 0;
        if (state.market.stocks.logs >= needLogs && state.market.stocks.planks >= needPlanks && state.city.treasury >= 70) {
          state.market.stocks.logs -= needLogs;
          state.market.stocks.planks -= needPlanks;
          state.city.treasury -= 70;

          const x = 1110 + (state.city.houses.length % 5) * 96 + rand(-16, 16);
          const y = 960 + Math.floor(state.city.houses.length / 5) * 86 + rand(-14, 14);
          state.city.houses.push(createHouse(x, y));
          addEvent("A new house was built.");
        }
      }

      // Household goods sink and realistic end demand.
      const furnitureDecay = state.city.houses.length * 0.09;
      state.city.furnitureLevel = Math.max(0, state.city.furnitureLevel - furnitureDecay);

      const neededFurniture = Math.max(0, state.city.houses.length * 4 - state.city.furnitureLevel);
      const buyQty = Math.min(state.market.stocks.furniture, Math.ceil(neededFurniture * 0.35));
      if (buyQty > 0) {
        state.market.stocks.furniture -= buyQty;
        state.city.furnitureLevel += buyQty;
        const spend = buyQty * state.market.prices.furniture;
        if (state.city.treasury >= spend) {
          state.city.treasury -= spend;
          state.market.treasury += spend;
        }
      }

      // City buys food for children/elderly support, injecting market money from city budget.
      const socialFood = Math.min(state.market.stocks.food, Math.ceil(pop * 0.5));
      if (socialFood > 0) {
        state.market.stocks.food -= socialFood;
        const spend = socialFood * state.market.prices.food;
        if (state.city.treasury >= spend) {
          state.city.treasury -= spend;
          state.market.treasury += spend;
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

      state.day += 1;
    }

    function processHourTick(hourAbsolute) {
      computeDemandAndPrices();

      if (hourAbsolute % 6 === 0) {
        rebalanceJobs();
      }

      if (hourAbsolute % 12 === 0) {
        // Light external trade: city exports small surplus, keeping economy from hard lock.
        const exportable = Math.max(0, state.market.stocks.furniture - state.market.demand.furniture - 1);
        const sold = Math.min(exportable, 2);
        if (sold > 0) {
          state.market.stocks.furniture -= sold;
          state.market.treasury += sold * state.market.prices.furniture;
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

      renderResourceMenu(stocks, forestLeft, orchardFood, wildFood, wildHerbs);
      renderBuildingCard();
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
      if (!selected) {
        ui.buildingCard.innerHTML = `
          <h2>No building selected</h2>
          <div class="mini">Click a building on the map to inspect workers and production stats.</div>
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
        const residents = state.people.filter((p) => (p.homeIndex % state.city.houses.length) === idx).length;
        const capacity = HOUSE_CAPACITY;
        ui.buildingCard.innerHTML = `
          <h2>House #${idx + 1}</h2>
          <div class="mini"><b>Residents:</b> ${residents} / ${capacity}</div>
          <div class="mini"><b>Furniture pressure:</b> ${(state.city.furnitureLevel / Math.max(1, state.city.houses.length)).toFixed(1)} per house</div>
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

      if (key === "sawmill") {
        const active = workersBusyAt(["make_planks"]);
        ui.buildingCard.innerHTML = `
          <h2>Sawmill ${state.city.companies.sawmill ? "" : "(locked)"}</h2>
          <div class="mini"><b>Workers:</b> ${workers.length}</div>
          <div class="mini"><b>Working now:</b> ${active}</div>
          <div class="mini"><b>Input logs:</b> ${state.market.stocks.logs.toFixed(0)}</div>
          <div class="mini"><b>Output planks:</b> ${state.market.stocks.planks.toFixed(0)}</div>
          <div class="mini"><b>Workers:</b> ${workerNames || "none"}</div>
        `;
        return;
      }

      if (key === "workshop") {
        const active = workersBusyAt(["make_furniture"]);
        ui.buildingCard.innerHTML = `
          <h2>Workshop ${state.city.companies.workshop ? "" : "(locked)"}</h2>
          <div class="mini"><b>Workers:</b> ${workers.length}</div>
          <div class="mini"><b>Working now:</b> ${active}</div>
          <div class="mini"><b>Input planks:</b> ${state.market.stocks.planks.toFixed(0)}</div>
          <div class="mini"><b>Output furniture:</b> ${state.market.stocks.furniture.toFixed(0)}</div>
          <div class="mini"><b>Workers:</b> ${workerNames || "none"}</div>
        `;
        return;
      }

      if (key === "clinic") {
        const active = workersBusyAt(["make_medkit"]);
        ui.buildingCard.innerHTML = `
          <h2>Clinic ${state.city.companies.clinic ? "" : "(locked)"}</h2>
          <div class="mini"><b>Medics:</b> ${workers.length}</div>
          <div class="mini"><b>Working now:</b> ${active}</div>
          <div class="mini"><b>Input herbs:</b> ${state.market.stocks.herbs.toFixed(0)}</div>
          <div class="mini"><b>Output medkits:</b> ${state.market.stocks.medkits.toFixed(0)}</div>
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

    function drawPersonSprite(person) {
      const img = sprites.personSheet;
      if (!imageReady(img)) {
        return false;
      }
      const looksLikeCutePlayerSheet = img.naturalWidth >= 192 && img.naturalHeight >= 320;
      const cols = looksLikeCutePlayerSheet ? 3 : 4;
      const rows = looksLikeCutePlayerSheet ? 5 : 4;
      const fw = Math.floor(img.naturalWidth / cols);
      const fh = Math.floor(img.naturalHeight / rows);
      const frame = Math.floor((state.absHours * 3 + person.id) % (cols * rows));
      const sx = (frame % cols) * fw;
      const sy = Math.floor(frame / cols) * fh;
      const dw = looksLikeCutePlayerSheet ? 18 : 16;
      const dh = looksLikeCutePlayerSheet ? 24 : 24;
      ctx.drawImage(img, sx, sy, fw, fh, person.x - dw * 0.5, person.y - dh * 0.78, dw, dh);
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
      if (!generatedBuildingSprites.sawmill) {
        generatedBuildingSprites.sawmill = generateTintedSprite(sprites.house, "#6f8a56", 0.2);
      }
      if (!generatedBuildingSprites.workshop) {
        generatedBuildingSprites.workshop = generateTintedSprite(sprites.house, "#9b79b0", 0.2);
      }
      if (!generatedBuildingSprites.clinic) {
        generatedBuildingSprites.clinic = generateTintedSprite(sprites.house, "#c98383", 0.2);
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

      // Paths
      if (imageReady(sprites.pathTile)) {
        const pathPattern = ctx.createPattern(sprites.pathTile, "repeat");
        if (pathPattern) {
          ctx.strokeStyle = pathPattern;
        } else {
          ctx.strokeStyle = "rgba(215, 192, 135, 0.22)";
        }
      } else {
        ctx.strokeStyle = "rgba(215, 192, 135, 0.22)";
      }
      ctx.lineWidth = 22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(250, 660);
      ctx.lineTo(770, 510);
      ctx.lineTo(1180, 290);
      ctx.moveTo(760, 510);
      ctx.lineTo(970, 740);
      ctx.moveTo(770, 510);
      ctx.lineTo(1250, 560);
      ctx.stroke();

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
      for (const patch of state.resources.wild) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(166, 192, 86, 0.35)";
        ctx.strokeStyle = "rgba(188, 220, 97, 0.85)";
        ctx.lineWidth = 2;
        ctx.arc(patch.x, patch.y, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawImageCover(sprites.wild, patch.x - 16, patch.y - 16, 32, 32);
        ctx.fillStyle = "#dce8aa";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`F${patch.food.toFixed(0)} H${patch.herbs.toFixed(0)}`, patch.x, patch.y + 4);
      }

      for (const orchard of state.resources.orchards) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(207, 136, 76, 0.34)";
        ctx.strokeStyle = "rgba(235, 175, 90, 0.85)";
        ctx.lineWidth = 2;
        ctx.arc(orchard.x, orchard.y, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawImageCover(sprites.farm, orchard.x - 16, orchard.y - 16, 32, 32);
        ctx.fillStyle = "#ffe6bc";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`Orchard ${orchard.food.toFixed(0)}`, orchard.x, orchard.y + 4);
      }

      for (const f of state.resources.forests) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(72, 124, 66, 0.45)";
        ctx.strokeStyle = "rgba(110, 176, 97, 0.8)";
        ctx.lineWidth = 2;
        ctx.arc(f.x, f.y, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawImageCover(sprites.forest, f.x - 18, f.y - 18, 36, 36);
        ctx.fillStyle = "#d3f0cb";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`Wood ${f.wood.toFixed(0)}`, f.x, f.y + 4);
      }

      drawBuilding(BUILDINGS.market, "#ac824f", "#744d27", "Market", false, generatedBuildingSprites.market || sprites.house, isSelectedBuilding("building:market"), sprites.iconMarket);
      drawBuilding(BUILDINGS.farm, "#73954f", "#405529", "Farm", false, generatedBuildingSprites.farm || sprites.house, isSelectedBuilding("building:farm"), sprites.iconFarm);
      drawBuilding(BUILDINGS.townhall, "#766e8e", "#4f4a63", "Town Hall", false, generatedBuildingSprites.townhall || sprites.house, isSelectedBuilding("building:townhall"), sprites.iconTownhall);
      drawBuilding(BUILDINGS.sawmill, "#6787ab", "#3f5d7a", "Sawmill", !state.city.companies.sawmill, generatedBuildingSprites.sawmill || sprites.house, isSelectedBuilding("building:sawmill"), sprites.iconSawmill);
      drawBuilding(BUILDINGS.workshop, "#8968ad", "#5d437a", "Workshop", !state.city.companies.workshop, generatedBuildingSprites.workshop || sprites.house, isSelectedBuilding("building:workshop"), sprites.iconWorkshop);
      drawBuilding(BUILDINGS.clinic, "#ae6666", "#744545", "Clinic", !state.city.companies.clinic, generatedBuildingSprites.clinic || sprites.house, isSelectedBuilding("building:clinic"), sprites.iconClinic);

      // Farm resources
      ctx.fillStyle = "#f3edc8";
      ctx.font = "13px Trebuchet MS";
      ctx.textAlign = "left";
      ctx.fillText(`Crop ${state.resources.farm.crop.toFixed(0)} | Fertility ${state.resources.farm.fertility.toFixed(0)}`, BUILDINGS.farm.x + 3, BUILDINGS.farm.y - 8);
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
        if (autosaveTimer >= AUTOSAVE_INTERVAL_SEC) {
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
        setupCity();
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
