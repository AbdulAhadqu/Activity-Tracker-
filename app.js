(() => {
  "use strict";

  const tracker = window.UsabilityTracker;
  const byId = (id) => document.getElementById(id);
  let cartCount = 0;

  document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", () => {
      cartCount += 1;
      byId("cart-count").textContent = cartCount;
      byId("cart-button").setAttribute("aria-label", `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`);
    });
  });
  byId("cart-button").addEventListener("click", () => {
    byId("order").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    byId("customer-name").focus({ preventScroll: true });
  });
  byId("order-form").addEventListener("submit", (event) => {
    event.preventDefault();
    byId("order-message").hidden = false;
  });

  byId("toggle-panel").addEventListener("click", () => {
    const content = byId("tracker-content");
    content.hidden = !content.hidden;
    byId("toggle-panel").setAttribute("aria-expanded", String(!content.hidden));
    byId("toggle-panel").textContent = content.hidden ? "Expand" : "Collapse";
  });
  byId("show-clicks").addEventListener("click", tracker.renderClickOverlay);
  byId("show-moves").addEventListener("click", tracker.renderMoveOverlay);
  byId("clear-overlay").addEventListener("click", tracker.clearOverlay);

  function showSummary() {
    const summary = tracker.getSummary();
    const list = document.createElement("dl");
    const rows = [
      ["Total clicks", summary.totalClicks],
      ["Mouse samples", summary.totalMouseSamples],
      ["Max scroll depth", `${summary.maxScrollDepthPercent}%`],
      ["Session duration", `${summary.sessionDurationSeconds}s`],
      ["Most clicked", summary.mostClickedElement],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      list.append(row);
    }
    byId("summary-box").replaceChildren(list);
    byId("summary-box").hidden = false;
  }
  byId("show-summary").addEventListener("click", showSummary);

  byId("export-json").addEventListener("click", () => {
    // Show the same snapshot in the panel so it can be read without opening a file.
    const json = tracker.exportJSON();
    byId("json-output").textContent = json;
    byId("json-preview").hidden = false;
    byId("json-preview").open = true;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "usability-log.json";
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Allow the browser to start reading the Blob before revoking its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function updateEventCount() {
    byId("event-count").textContent = tracker.getLogs().length;
  }
  byId("clear-logs").addEventListener("click", () => {
    // This control's capture-phase click is cleared with the rest of the logs.
    tracker.clearLogs();
    byId("summary-box").hidden = true;
    byId("summary-box").replaceChildren();
    byId("json-preview").hidden = true;
    byId("json-output").textContent = "";
    updateEventCount();
  });
  updateEventCount();
  setInterval(updateEventCount, 1000);
})();
