window.WorldGame = window.WorldGame || {};

window.WorldGame.Storage = (() => {
  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== "object") {
      return false;
    }
    if (!payload.state || typeof payload.state !== "object") {
      return false;
    }
    if (!payload.state.city || !payload.state.market || !payload.state.resources) {
      return false;
    }
    if (!Array.isArray(payload.state.people)) {
      return false;
    }
    return true;
  }

  function buildPayload(state, cameraView) {
    return {
      version: 1,
      savedAt: Date.now(),
      state: cloneJson(state),
      camera: cloneJson(cameraView)
    };
  }

  async function saveGame(key, state, cameraView) {
    const payload = buildPayload(state, cameraView);
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, payload })
    });
    if (!res.ok) {
      throw new Error("Save request failed.");
    }
    return payload;
  }

  async function loadGame(key) {
    const res = await fetch(`/api/load?key=${encodeURIComponent(key)}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error("Load request failed.");
    }
    const payload = await res.json();
    if (!validatePayload(payload)) {
      return null;
    }
    return payload;
  }

  // Optional local backup helpers.
  function saveLocalBackup(key, state, cameraView) {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      state: cloneJson(state),
      camera: cloneJson(cameraView)
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return payload;
  }

  function loadLocalBackup(key) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      const payload = JSON.parse(raw);
      if (!validatePayload(payload)) {
        return null;
      }
      return payload;
    } catch (_err) {
      return null;
    }
  }

  return {
    saveGame,
    loadGame,
    saveLocalBackup,
    loadLocalBackup,
    validatePayload,
    buildPayload
  };
})();
