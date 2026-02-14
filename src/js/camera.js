window.WorldGame = window.WorldGame || {};

window.WorldGame.Camera = (() => {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function createCamera(world, zoomCfg) {
    const view = {
      width: 0,
      height: 0,
      baseScale: 1,
      scale: 1,
      zoom: 1,
      minZoom: zoomCfg.min,
      maxZoom: zoomCfg.max,
      centerX: world.width * 0.5,
      centerY: world.height * 0.5,
      ox: 0,
      oy: 0
    };

    function updateTransform() {
      view.scale = view.baseScale * view.zoom;
      view.ox = view.width * 0.5 - view.centerX * view.scale;
      view.oy = view.height * 0.5 - view.centerY * view.scale;
    }

    function clampCenter() {
      const halfVisibleW = view.width / (2 * view.scale);
      const halfVisibleH = view.height / (2 * view.scale);

      if (halfVisibleW * 2 >= world.width) {
        view.centerX = world.width * 0.5;
      } else {
        view.centerX = clamp(view.centerX, halfVisibleW, world.width - halfVisibleW);
      }

      if (halfVisibleH * 2 >= world.height) {
        view.centerY = world.height * 0.5;
      } else {
        view.centerY = clamp(view.centerY, halfVisibleH, world.height - halfVisibleH);
      }
    }

    function resize(width, height) {
      view.width = Math.max(1, width);
      view.height = Math.max(1, height);
      view.baseScale = Math.min(view.width / world.width, view.height / world.height);
      clampCenter();
      updateTransform();
    }

    function screenToWorld(sx, sy) {
      return {
        x: (sx - view.ox) / view.scale,
        y: (sy - view.oy) / view.scale
      };
    }

    function setZoom(nextZoom, anchorSx, anchorSy) {
      const before = screenToWorld(anchorSx, anchorSy);
      view.zoom = clamp(nextZoom, view.minZoom, view.maxZoom);
      updateTransform();
      const after = screenToWorld(anchorSx, anchorSy);

      view.centerX += before.x - after.x;
      view.centerY += before.y - after.y;
      clampCenter();
      updateTransform();
    }

    function zoomByFactor(factor, anchorSx, anchorSy) {
      setZoom(view.zoom * factor, anchorSx, anchorSy);
    }

    function resetZoom() {
      view.zoom = 1;
      clampCenter();
      updateTransform();
    }

    function getSnapshot() {
      return {
        zoom: view.zoom,
        centerX: view.centerX,
        centerY: view.centerY
      };
    }

    function applySnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") {
        return;
      }
      if (typeof snapshot.zoom === "number" && Number.isFinite(snapshot.zoom)) {
        view.zoom = clamp(snapshot.zoom, view.minZoom, view.maxZoom);
      }
      if (typeof snapshot.centerX === "number" && Number.isFinite(snapshot.centerX)) {
        view.centerX = snapshot.centerX;
      }
      if (typeof snapshot.centerY === "number" && Number.isFinite(snapshot.centerY)) {
        view.centerY = snapshot.centerY;
      }
      clampCenter();
      updateTransform();
    }

    return {
      view,
      resize,
      screenToWorld,
      setZoom,
      zoomByFactor,
      resetZoom,
      getSnapshot,
      applySnapshot
    };
  }

  return { createCamera };
})();
