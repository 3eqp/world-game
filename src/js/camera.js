window.WorldGame = window.WorldGame || {};

window.WorldGame.Camera = (() => {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function createCamera(world, zoomCfg, cameraCfg = {}) {
    const view = {
      width: 0,
      height: 0,
      baseScale: 0,
      scale: 1,
      zoom: 1,
      targetZoom: 1,
      minZoom: zoomCfg.min,
      maxZoom: zoomCfg.max,
      centerX: world.width * 0.5,
      centerY: world.height * 0.5,
      ox: 0,
      oy: 0
    };
    const insets = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    };
    const zoomAnchor = {
      sx: 0,
      sy: 0,
      wx: world.width * 0.5,
      wy: world.height * 0.5
    };

    function viewportCenterScreenX() {
      const left = clamp(insets.left, 0, view.width);
      const right = clamp(insets.right, 0, view.width);
      const usableLeft = left;
      const usableRight = Math.max(usableLeft + 1, view.width - right);
      return (usableLeft + usableRight) * 0.5;
    }

    function viewportCenterScreenY() {
      const top = clamp(insets.top, 0, view.height);
      const bottom = clamp(insets.bottom, 0, view.height);
      const usableTop = top;
      const usableBottom = Math.max(usableTop + 1, view.height - bottom);
      return (usableTop + usableBottom) * 0.5;
    }

    function usableWidth() {
      const left = clamp(insets.left, 0, view.width);
      const right = clamp(insets.right, 0, view.width);
      return Math.max(1, view.width - left - right);
    }

    function usableHeight() {
      const top = clamp(insets.top, 0, view.height);
      const bottom = clamp(insets.bottom, 0, view.height);
      return Math.max(1, view.height - top - bottom);
    }

    function updateTransform() {
      view.scale = view.baseScale * view.zoom;
      view.ox = viewportCenterScreenX() - view.centerX * view.scale;
      view.oy = viewportCenterScreenY() - view.centerY * view.scale;
    }

    function clampCenter() {
      const halfVisibleW = usableWidth() / (2 * view.scale);
      const halfVisibleH = usableHeight() / (2 * view.scale);
      const slackW = Math.max(24, world.width * 0.06);
      const slackH = Math.max(24, world.height * 0.06);

      if (halfVisibleW * 2 >= world.width) {
        view.centerX = clamp(
          view.centerX,
          world.width * 0.5 - slackW,
          world.width * 0.5 + slackW
        );
      } else {
        view.centerX = clamp(view.centerX, halfVisibleW, world.width - halfVisibleW);
      }

      if (halfVisibleH * 2 >= world.height) {
        view.centerY = clamp(
          view.centerY,
          world.height * 0.5 - slackH,
          world.height * 0.5 + slackH
        );
      } else {
        view.centerY = clamp(view.centerY, halfVisibleH, world.height - halfVisibleH);
      }
    }

    function resize(width, height) {
      view.width = Math.max(1, width);
      view.height = Math.max(1, height);
      const shouldRecalcBaseScale = !cameraCfg.lockScaleOnResize || view.baseScale <= 0;
      if (shouldRecalcBaseScale) {
        view.baseScale = Math.min(view.width / world.width, view.height / world.height);
      }
      clampCenter();
      updateTransform();
    }

    function setInsets(nextInsets = {}) {
      insets.left = Math.max(0, Number(nextInsets.left) || 0);
      insets.right = Math.max(0, Number(nextInsets.right) || 0);
      insets.top = Math.max(0, Number(nextInsets.top) || 0);
      insets.bottom = Math.max(0, Number(nextInsets.bottom) || 0);
      clampCenter();
      updateTransform();
    }

    function screenToWorld(sx, sy) {
      return {
        x: (sx - view.ox) / view.scale,
        y: (sy - view.oy) / view.scale
      };
    }

    function panByWorld(dx, dy) {
      view.centerX += dx;
      view.centerY += dy;
      clampCenter();
      updateTransform();
    }

    function panByPixels(dx, dy) {
      view.centerX -= dx / view.scale;
      view.centerY -= dy / view.scale;
      clampCenter();
      updateTransform();
    }

    function setZoomTarget(nextZoom, anchorSx, anchorSy) {
      zoomAnchor.sx = anchorSx;
      zoomAnchor.sy = anchorSy;
      const p = screenToWorld(anchorSx, anchorSy);
      zoomAnchor.wx = p.x;
      zoomAnchor.wy = p.y;
      view.targetZoom = clamp(nextZoom, view.minZoom, view.maxZoom);
    }

    function zoomByFactor(factor, anchorSx, anchorSy) {
      setZoomTarget(view.targetZoom * factor, anchorSx, anchorSy);
    }

    function resetZoom() {
      setZoomTarget(1, view.width * 0.5, view.height * 0.5);
    }

    function update(dtSec) {
      const diff = view.targetZoom - view.zoom;
      if (Math.abs(diff) < 0.0005) {
        view.zoom = view.targetZoom;
        return false;
      }

      const t = 1 - Math.exp(-zoomCfg.smoothness * dtSec);
      view.zoom += diff * t;
      updateTransform();

      const after = screenToWorld(zoomAnchor.sx, zoomAnchor.sy);
      view.centerX += zoomAnchor.wx - after.x;
      view.centerY += zoomAnchor.wy - after.y;
      clampCenter();
      updateTransform();
      return true;
    }

    function getSnapshot() {
      return {
        zoom: view.targetZoom,
        centerX: view.centerX,
        centerY: view.centerY
      };
    }

    function applySnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") {
        return;
      }
      if (typeof snapshot.zoom === "number" && Number.isFinite(snapshot.zoom)) {
        view.targetZoom = clamp(snapshot.zoom, view.minZoom, view.maxZoom);
        view.zoom = view.targetZoom;
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
      setInsets,
      screenToWorld,
      panByWorld,
      panByPixels,
      setZoomTarget,
      zoomByFactor,
      resetZoom,
      update,
      getSnapshot,
      applySnapshot
    };
  }

  return { createCamera };
})();
