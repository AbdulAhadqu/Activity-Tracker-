(() => {
  "use strict";

  const usabilityLogs = [];
  const SESSION_ID = "session_" + Math.floor(Math.random() * 36 ** 7).toString(36).padStart(7, "0");
  const milestonesReached = new Set();
  let startedAt = performance.now();
  let lastMoveAt = -Infinity;
  let lastScrollAt = -Infinity;
  let scrollTimer = null;
  let maxScrollDepth = 0;

  function getPageCoordinates(event) {
    const root = document.documentElement;
    const scrollX = window.pageXOffset ?? root.scrollLeft ?? 0;
    const scrollY = window.pageYOffset ?? root.scrollTop ?? 0;
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    return {
      pageX: clientX + scrollX, pageY: clientY + scrollY,
      clientX, clientY,
      viewportWidth: window.innerWidth || root.clientWidth,
      viewportHeight: window.innerHeight || root.clientHeight,
    };
  }

  function recordClick(event) {
    const target = event.target;
    const coords = getPageCoordinates(event);
    // SVG elements expose an SVGAnimatedString rather than a plain className.
    const targetClass = typeof target.className === "string"
      ? target.className : target.className?.baseVal;
    const entry = {
      sessionId: SESSION_ID,
      eventType: "click",
      timestamp: new Date().toISOString(),
      timeOffsetMs: performance.now(),
      targetTag: target.tagName?.toLowerCase() || "unknown",
      targetId: target.id || null,
      targetClass: targetClass?.trim() || null,
      targetText: (target.innerText || "").trim().slice(0, 30),
      x: coords.pageX, y: coords.pageY,
      viewportW: coords.viewportWidth, viewportH: coords.viewportHeight,
    };
    usabilityLogs.push(entry);
    console.log("[Usability Tracker]", entry);
  }

  function recordMove(event) {
    const now = performance.now();
    if (now - lastMoveAt < 250) return;
    lastMoveAt = now;
    const coords = getPageCoordinates(event);
    usabilityLogs.push({
      sessionId: SESSION_ID, eventType: "mousemove",
      timestamp: new Date().toISOString(), x: coords.pageX, y: coords.pageY,
    });
  }

  function recordScroll() {
    lastScrollAt = performance.now();
    const root = document.documentElement;
    const body = document.body;
    const scrollY = Math.max(0, window.pageYOffset ?? root.scrollTop ?? 0);
    const viewportHeight = window.innerHeight || root.clientHeight;
    const totalHeight = Math.max(root.scrollHeight, root.offsetHeight, body?.scrollHeight || 0, body?.offsetHeight || 0, viewportHeight);
    const depth = Math.min(100, Math.round((scrollY + viewportHeight) / Math.max(1, totalHeight) * 100));
    maxScrollDepth = Math.max(maxScrollDepth, depth);
    // A jump past several milestones records every crossed milestone once.
    for (const milestone of [25, 50, 75, 100]) {
      if (maxScrollDepth >= milestone && !milestonesReached.has(milestone)) {
        milestonesReached.add(milestone);
        usabilityLogs.push({ sessionId: SESSION_ID, eventType: "scroll", timestamp: new Date().toISOString(), depthPercent: milestone, scrollY });
      }
    }
  }

  function handleScroll() {
    const remaining = 250 - (performance.now() - lastScrollAt);
    if (remaining <= 0) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
      recordScroll();
    } else if (scrollTimer === null) {
      // Preserve the final depth when scrolling stops between samples.
      scrollTimer = setTimeout(() => { scrollTimer = null; recordScroll(); }, remaining);
    }
  }

  function getSummary() {
    const clicks = usabilityLogs.filter((entry) => entry.eventType === "click");
    const counts = new Map();
    let mostClickedElement = "none";
    let highestCount = 0;
    for (const entry of clicks) {
      const element = entry.targetId ? `#${entry.targetId}`
        : entry.targetClass ? `.${entry.targetClass.trim().split(/\s+/).join(".")}` : entry.targetTag;
      const count = (counts.get(element) || 0) + 1;
      counts.set(element, count);
      if (count > highestCount) { highestCount = count; mostClickedElement = element; }
    }
    return {
      totalClicks: clicks.length,
      totalMouseSamples: usabilityLogs.filter((entry) => entry.eventType === "mousemove").length,
      maxScrollDepthPercent: maxScrollDepth,
      sessionDurationSeconds: usabilityLogs.length ? Math.floor((performance.now() - startedAt) / 1000) : 0,
      mostClickedElement,
    };
  }

  function renderOverlay(eventType, className, size, color) {
    document.querySelectorAll(`.${className}`).forEach((dot) => dot.remove());
    let layer = document.getElementById("ut-overlay-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "ut-overlay-layer";
      layer.setAttribute("aria-hidden", "true");
      // Body starts at document (0, 0), with no border or margin. Clipping the
      // layer prevents dots near edges from changing the document's scroll size.
      Object.assign(layer.style, { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none", zIndex: "99999" });
      document.body.append(layer);
    }
    const fragment = document.createDocumentFragment();
    for (const entry of usabilityLogs) {
      if (entry.eventType !== eventType) continue;
      const dot = document.createElement("span");
      dot.className = className;
      Object.assign(dot.style, {
        position: "absolute", left: `${entry.x}px`, top: `${entry.y}px`,
        width: `${size}px`, height: `${size}px`, borderRadius: "50%",
        background: color, transform: "translate(-50%, -50%)",
        pointerEvents: "none", zIndex: "99999",
      });
      fragment.append(dot);
    }
    layer.append(fragment);
  }

  function clearOverlay() {
    document.querySelectorAll(".ut-click-dot, .ut-move-dot").forEach((dot) => dot.remove());
    document.getElementById("ut-overlay-layer")?.remove();
  }

  function clearLogs() {
    usabilityLogs.length = 0;
    clearOverlay();
    milestonesReached.clear();
    maxScrollDepth = 0;
    startedAt = performance.now();
    lastMoveAt = lastScrollAt = -Infinity;
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }

  // Capture sees clicks before page handlers can stop propagation.
  document.addEventListener("click", recordClick, true);
  document.addEventListener("mousemove", recordMove, { passive: true });
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.UsabilityTracker = {
    getLogs: () => usabilityLogs,
    exportJSON: () => JSON.stringify(usabilityLogs, null, 2),
    getSummary,
    renderClickOverlay: () => renderOverlay("click", "ut-click-dot", 12, "rgba(232, 49, 49, 0.55)"),
    renderMoveOverlay: () => renderOverlay("mousemove", "ut-move-dot", 6, "rgba(40, 110, 240, 0.6)"),
    clearOverlay,
    clearLogs,
  };
})();
