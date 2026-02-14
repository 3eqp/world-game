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
      ZOOM
    } = Config;

    const canvas = document.getElementById("world");
    const ctx = canvas.getContext("2d");

    const ui = {
      addPersonBtn: document.getElementById("addPersonBtn"),
      removeSelectedBtn: document.getElementById("removeSelectedBtn"),
      removeRandomBtn: document.getElementById("removeRandomBtn"),
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
      popStat: document.getElementById("popStat"),
      stageStat: document.getElementById("stageStat"),
      dayStat: document.getElementById("dayStat"),
      marketCashStat: document.getElementById("marketCashStat"),
      overlayText: document.getElementById("overlayText"),
      personCard: document.getElementById("personCard"),
      marketTable: document.getElementById("marketTable"),
      eventLog: document.getElementById("eventLog")
    };

    let state = createInitialState();
    const camera = Camera.createCamera(WORLD, ZOOM);
    const view = camera.view;
    const AUTOSAVE_INTERVAL_SEC = 20;
    let autosaveTimer = 0;

    function createInitialState() {
      return {
        paused: false,
        speed: 1,
        absHours: 0,
        day: 1,
        selectedId: null,
        nextPersonId: 1,
        people: [],
        graves: [],
        eventLog: [],
        city: {
          stage: "Subsistence",
          treasury: 380,
          houses: [],
          furnitureLevel: 5,
          companies: {
            sawmill: false,
            workshop: false,
            clinic: false
          }
        },
        market: {
          treasury: 2400,
          stocks: {
            food: 30,
            logs: 18,
            planks: 0,
            furniture: 2,
            herbs: 10,
            medkits: 2
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
            { x: 1340, y: 205, wood: 170, maxWood: 170 },
            { x: 1430, y: 285, wood: 130, maxWood: 130 },
            { x: 1260, y: 175, wood: 95, maxWood: 95 }
          ],
          wild: [
            { x: 260, y: 280, food: 90, herbs: 55, maxFood: 90, maxHerbs: 55 },
            { x: 410, y: 210, food: 70, herbs: 45, maxFood: 70, maxHerbs: 45 },
            { x: 180, y: 420, food: 85, herbs: 35, maxFood: 85, maxHerbs: 35 }
          ],
          farm: {
            crop: 45,
            maxCrop: 120,
            fertility: 90,
            maxFertility: 110
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
      state.city.houses.push(createHouse(540, 595));
      state.city.houses.push(createHouse(620, 660));
      state.city.houses.push(createHouse(720, 620));
      state.city.houses.push(createHouse(545, 735));
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
      state.resources.wild = Array.isArray(incomingResources.wild) ? incomingResources.wild : base.resources.wild;

      state.people = Array.isArray(incoming.people) ? incoming.people : [];
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
    }

    function updateZoomLabel() {
      if (!ui.zoomStat) {
        return;
      }
      ui.zoomStat.textContent = `Zoom: ${Math.round(view.zoom * 100)}%`;
    }

    function saveToStorage(manual) {
      try {
        Storage.saveGame(STORAGE_KEY, state, camera.getSnapshot());
        if (manual) {
          addEvent("Game saved.");
        }
      } catch (_err) {
        if (manual) {
          addEvent("Save failed.");
        }
      }
    }

    function loadFromStorage(manual) {
      const payload = Storage.loadGame(STORAGE_KEY);
      if (!payload) {
        if (manual) {
          addEvent("No saved game found.");
        }
        return false;
      }

      hydrateState(payload.state);
      resizeCanvas();
      camera.applySnapshot(payload.camera);
      syncUiToggles();
      if (manual) {
        addEvent("Save loaded.");
      }
      return true;
    }

    function findHomePosition(person) {
      const idx = person.homeIndex % state.city.houses.length;
      const home = state.city.houses[idx];
      return { x: home.x + home.w * 0.5, y: home.y + home.h * 0.5 };
    }

    function createPerson() {
      const id = state.nextPersonId++;
      const homeIndex = Math.floor(Math.random() * state.city.houses.length);
      const home = state.city.houses[homeIndex];
      const x = home.x + rand(8, home.w - 8);
      const y = home.y + rand(8, home.h - 8);
      const person = {
        id,
        name: `${pick(NAMES)} #${id}`,
        x,
        y,
        targetX: x,
        targetY: y,
        speed: rand(110, 145),
        age: rand(17, 48),
        health: rand(72, 100),
        hunger: rand(55, 85),
        energy: rand(50, 88),
        joy: rand(50, 82),
        money: rand(16, 42),
        role: "unemployed",
        homeIndex,
        alive: true,
        task: null,
        inventory: {
          food: Math.random() < 0.45 ? 1 : 0,
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
      state.graves.push({ name: person.name, age: person.age, reason });
      removePersonById(person.id, reason);
      addEvent(`${person.name} died at ${person.age.toFixed(1)} years (${reason}).`);
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
        const rect = canvas.getBoundingClientRect();
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        const factor = ev.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step;
        camera.zoomByFactor(factor, sx, sy);
        updateZoomLabel();
      }, { passive: false });

      canvas.addEventListener("click", (ev) => {
        const rect = canvas.getBoundingClientRect();
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
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
        }
      });

      window.addEventListener("resize", resizeCanvas);
      syncUiToggles();
    }

    function alivePeople() {
      return state.people;
    }

    function getPerson(id) {
      return state.people.find((p) => p.id === id) || null;
    }

    function inventoryTotal(person) {
      return GOODS.reduce((sum, g) => sum + person.inventory[g], 0);
    }

    function sellableUnits(person) {
      let total = 0;
      for (const g of GOODS) {
        let reserve = 0;
        if (g === "food") {
          reserve = person.hunger < 65 ? 1 : 0;
        }
        if (g === "medkits") {
          reserve = person.health < 55 ? 1 : 0;
        }
        total += Math.max(0, person.inventory[g] - reserve);
      }
      return total;
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
        const bestFood = nearestPatchWith("food");
        if (bestFood && bestFood.patch.food > 1) {
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
      if (person.hunger < 32) {
        if (person.inventory.food > 0) {
          return createTask("eat_food", null, 0.1);
        }
        if (state.market.stocks.food > 0 && person.money >= state.market.prices.food) {
          return createTask("buy_food", { x: BUILDINGS.market.x + 55, y: BUILDINGS.market.y + 42 }, 0.5);
        }
      }
      if (person.health < 34 && state.city.companies.clinic && state.market.stocks.medkits > 0 && person.money >= state.market.prices.medkits) {
        return createTask("buy_medkit", { x: BUILDINGS.clinic.x + 45, y: BUILDINGS.clinic.y + 38 }, 0.5);
      }
      if (person.energy < 24) {
        const home = findHomePosition(person);
        return createTask("sleep", home, 3.2);
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
        if (person.inventory.food > 0) {
          person.inventory.food -= 1;
          person.hunger = clamp(person.hunger + 48, 0, 100);
          person.joy = clamp(person.joy + 3, 0, 100);
        }
        return;
      }

      if (task.type === "use_medkit") {
        if (person.inventory.medkits > 0) {
          person.inventory.medkits -= 1;
          person.health = clamp(person.health + 36, 0, 100);
          person.joy = clamp(person.joy + 5, 0, 100);
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

      if (task.type === "sleep") {
        person.energy = clamp(person.energy + rand(34, 56), 0, 100);
        if (person.hunger > 35) {
          person.health = clamp(person.health + rand(2, 5), 0, 100);
        }
        person.joy = clamp(person.joy + 2, 0, 100);
        return;
      }

      if (task.type === "sell_goods") {
        for (const good of GOODS) {
          let reserve = 0;
          if (good === "food" && person.hunger < 65) {
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
          const amount = Math.min(patch.food, rand(1.4, 3.1));
          patch.food -= amount;
          person.inventory.food += Math.floor(amount);
          person.energy = clamp(person.energy - rand(4, 8), 0, 100);
        }
        return;
      }

      if (task.type === "gather_herbs") {
        const patch = state.resources.wild[task.meta.patchIndex];
        if (patch && patch.herbs > 0.4) {
          const amount = Math.min(patch.herbs, rand(1.0, 2.4));
          patch.herbs -= amount;
          person.inventory.herbs += Math.floor(amount);
          person.energy = clamp(person.energy - rand(4, 8), 0, 100);
        }
        return;
      }

      if (task.type === "chop_wood") {
        const forest = state.resources.forests[task.meta.forestIndex];
        if (forest && forest.wood > 0.6) {
          const amount = Math.min(forest.wood, rand(1.5, 3.5));
          forest.wood -= amount;
          person.inventory.logs += Math.floor(amount);
          person.energy = clamp(person.energy - rand(6, 10), 0, 100);
          person.joy = clamp(person.joy - 1, 0, 100);
        }
        return;
      }

      if (task.type === "harvest_farm") {
        if (farm.crop > 0.6) {
          const amount = Math.min(farm.crop, rand(1.8, 4.2));
          farm.crop -= amount;
          farm.fertility = clamp(farm.fertility - amount * 0.9, 0, farm.maxFertility);
          person.inventory.food += Math.floor(amount);
          person.energy = clamp(person.energy - rand(5, 9), 0, 100);
        }
        return;
      }

      if (task.type === "tend_farm") {
        farm.fertility = clamp(farm.fertility + rand(1.8, 4.6), 0, farm.maxFertility);
        person.energy = clamp(person.energy - rand(3, 6), 0, 100);
        return;
      }

      if (task.type === "make_planks") {
        if (market.stocks.logs >= 2 && market.demand.planks > market.stocks.planks) {
          market.stocks.logs -= 2;
          market.stocks.planks += 1;
          const wage = 5;
          person.money += wage;
          state.city.treasury = Math.max(0, state.city.treasury - wage);
          person.energy = clamp(person.energy - rand(6, 10), 0, 100);
        }
        return;
      }

      if (task.type === "make_furniture") {
        if (market.stocks.planks >= 2 && market.demand.furniture > market.stocks.furniture) {
          market.stocks.planks -= 2;
          market.stocks.furniture += 1;
          const wage = 8;
          person.money += wage;
          state.city.treasury = Math.max(0, state.city.treasury - wage);
          person.energy = clamp(person.energy - rand(7, 11), 0, 100);
        }
        return;
      }

      if (task.type === "make_medkit") {
        if (market.stocks.herbs >= 2 && market.demand.medkits > market.stocks.medkits) {
          market.stocks.herbs -= 2;
          market.stocks.medkits += 1;
          const wage = 6;
          person.money += wage;
          state.city.treasury = Math.max(0, state.city.treasury - wage);
          person.energy = clamp(person.energy - rand(5, 8), 0, 100);
        }
        return;
      }

      if (task.type === "idle") {
        person.energy = clamp(person.energy + 2, 0, 100);
      }
    }

    function updatePersonNeeds(person, dtHours) {
      person.age += dtHours / (24 * 365);

      const workLoad = person.task && !["sleep", "idle"].includes(person.task.type) ? 1 : 0;
      person.hunger = clamp(person.hunger - dtHours * (0.75 + workLoad * 0.28), 0, 100);
      person.energy = clamp(person.energy - dtHours * (0.55 + workLoad * 0.2), 0, 100);
      person.joy = clamp(person.joy - dtHours * 0.12, 0, 100);

      let healthDecay = dtHours * 0.02;
      if (person.age > 45) {
        healthDecay += dtHours * (person.age - 45) * 0.003;
      }
      if (person.age > 65) {
        healthDecay += dtHours * (person.age - 65) * 0.007;
      }
      if (person.hunger < 16) {
        healthDecay += dtHours * 0.56;
      }
      if (person.energy < 12) {
        healthDecay += dtHours * 0.32;
      }
      if (person.joy < 14) {
        healthDecay += dtHours * 0.16;
      }

      person.health = clamp(person.health - healthDecay, 0, 100);

      if (person.hunger > 70 && person.energy > 60 && person.health < 95) {
        person.health = clamp(person.health + dtHours * 0.07, 0, 100);
      }
    }

    function updatePeople(dtHours) {
      const arr = [...state.people];
      for (const person of arr) {
        if (!person.alive) {
          continue;
        }

        updatePersonNeeds(person, dtHours);

        if (person.health <= 0 || person.age >= 95) {
          diePerson(person, "health collapse");
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
      const pool = [...state.people].sort((a, b) => (b.health + b.energy + b.joy) - (a.health + a.energy + a.joy));

      for (const p of pool) {
        p.role = "unemployed";
      }

      let cursor = 0;
      for (const role of priority) {
        const amount = clamp(wants[role], 0, pop);
        for (let i = 0; i < amount && cursor < pool.length; i++) {
          pool[cursor].role = role;
          cursor++;
        }
      }

      while (cursor < pool.length) {
        if (state.market.demand.logs > state.market.stocks.logs) {
          pool[cursor].role = "woodcutter";
        } else if (state.market.demand.food > state.market.stocks.food) {
          pool[cursor].role = "forager";
        } else {
          pool[cursor].role = "unemployed";
        }
        cursor++;
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

          const x = 510 + (state.city.houses.length % 4) * 84 + rand(-12, 12);
          const y = 590 + Math.floor(state.city.houses.length / 4) * 76 + rand(-10, 10);
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
      return role.replace("_", " ");
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
      const wildFood = state.resources.wild.reduce((sum, p) => sum + p.food, 0);
      const wildHerbs = state.resources.wild.reduce((sum, p) => sum + p.herbs, 0);
      ui.overlayText.innerHTML = `
        <div><b>Day ${state.day}</b> ${hh} | Population: ${state.people.length}</div>
        <div>Stage: <b>${state.city.stage}</b> | City cash: $${Math.round(state.city.treasury)}</div>
        <div>Finite map resources: forest ${forestLeft.toFixed(0)}, wild food ${wildFood.toFixed(0)}, herbs ${wildHerbs.toFixed(0)}, farm crop ${state.resources.farm.crop.toFixed(0)}</div>
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
          <div class="mini"><b>Age:</b> ${selected.age.toFixed(1)} years</div>
          <div class="mini"><b>Role:</b> ${roleLabel(selected.role)}</div>
          <div class="mini"><b>Task:</b> ${taskLabel(selected.task)}</div>
          <div class="mini"><b>Money:</b> $${selected.money.toFixed(0)}</div>

          ${meterHtml("Health", selected.health, "#ca4b4b")}
          ${meterHtml("Hunger", selected.hunger, "#b58b33")}
          ${meterHtml("Energy", selected.energy, "#3d89b5")}
          ${meterHtml("Joy", selected.joy, "#4ea364")}

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

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(640, Math.floor(rect.width));
      canvas.height = Math.max(420, Math.floor(rect.height));
      camera.resize(canvas.width, canvas.height);
      updateZoomLabel();
    }

    function drawBuilding(b, fill, stroke, label, locked = false) {
      ctx.fillStyle = locked ? "#5d625f" : fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = locked ? "#ced0ce" : "#f6f0df";
      ctx.font = "14px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(label + (locked ? " (locked)" : ""), b.x + b.w / 2, b.y + b.h / 2 + 5);
    }

    function renderMapBase() {
      ctx.fillStyle = "#20453f";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);

      // Paths
      ctx.strokeStyle = "rgba(215, 192, 135, 0.22)";
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
      for (const h of state.city.houses) {
        ctx.fillStyle = "#b78f66";
        ctx.strokeStyle = "#815f3b";
        ctx.lineWidth = 2;
        ctx.fillRect(h.x, h.y, h.w, h.h);
        ctx.strokeRect(h.x, h.y, h.w, h.h);
        ctx.fillStyle = "#724f2d";
        ctx.fillRect(h.x + 6, h.y + 6, 12, 10);
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
        ctx.fillStyle = "#dce8aa";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`F${patch.food.toFixed(0)} H${patch.herbs.toFixed(0)}`, patch.x, patch.y + 4);
      }

      for (const f of state.resources.forests) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(72, 124, 66, 0.45)";
        ctx.strokeStyle = "rgba(110, 176, 97, 0.8)";
        ctx.lineWidth = 2;
        ctx.arc(f.x, f.y, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#d3f0cb";
        ctx.font = "12px Trebuchet MS";
        ctx.textAlign = "center";
        ctx.fillText(`Wood ${f.wood.toFixed(0)}`, f.x, f.y + 4);
      }

      drawBuilding(BUILDINGS.market, "#ac824f", "#744d27", "Market", false);
      drawBuilding(BUILDINGS.farm, "#73954f", "#405529", "Farm", false);
      drawBuilding(BUILDINGS.townhall, "#766e8e", "#4f4a63", "Town Hall", false);
      drawBuilding(BUILDINGS.sawmill, "#6787ab", "#3f5d7a", "Sawmill", !state.city.companies.sawmill);
      drawBuilding(BUILDINGS.workshop, "#8968ad", "#5d437a", "Workshop", !state.city.companies.workshop);
      drawBuilding(BUILDINGS.clinic, "#ae6666", "#744545", "Clinic", !state.city.companies.clinic);

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

        ctx.beginPath();
        ctx.arc(person.x, person.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (person.id === state.selectedId) {
          ctx.strokeStyle = "#fff2c5";
          ctx.lineWidth = 2;
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

    let lastFrame = performance.now();
    function gameLoop(now) {
      const dt = Math.min(0.12, (now - lastFrame) / 1000);
      lastFrame = now;

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

    function init() {
      setupUI();
      resizeCanvas();
      const restored = loadFromStorage(false);
      if (!restored) {
        setupCity();
        initPopulation(8);
        computeDemandAndPrices();
        addEvent("Simulation started.");
      } else {
        addEvent("Save restored on startup.");
      }
      syncUiToggles();
      requestAnimationFrame(gameLoop);
    }

    init();
})();
