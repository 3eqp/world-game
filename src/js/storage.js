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

  function saveGame(key, state, cameraView) {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      state: cloneJson(state),
      camera: cloneJson(cameraView)
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return payload;
  }

  function loadGame(key) {
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
    loadGame
  };
})();
