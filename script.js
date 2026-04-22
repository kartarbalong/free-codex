const STORAGE_KEY = "email_weekly_tracker_v1";
const SETTINGS_KEY = "email_weekly_tracker_settings_v1";
const AUTO_DURATION_DAYS = 7;
const DEFAULT_WEEKLY_TOKENS = 258000;
const REFRESH_MS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  items: [],
  settings: {
    weeklyTokens: DEFAULT_WEEKLY_TOKENS
  }
};
const draggingLimitIds = new Set();

const listEl = document.getElementById("email-list");
const emptyStateEl = document.getElementById("empty-state");
const addForm = document.getElementById("add-form");
const emailInput = document.getElementById("email-input");
const weeklyTokenInput = document.getElementById("weekly-token-input");
const tokenPerDayEl = document.getElementById("token-per-day");
const tokenPerHourEl = document.getElementById("token-per-hour");

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

function normalizeItem(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    email: String(raw.email || "").trim(),
    lastUsed: Number.isFinite(raw.lastUsed) ? raw.lastUsed : Date.now(),
    duration: AUTO_DURATION_DAYS,
    mode: "auto",
    limitPercent: Number.isFinite(raw.limitPercent) ? clamp(Math.floor(raw.limitPercent), 0, 100) : 50
  };
}

function loadState() {
  const rawItems = localStorage.getItem(STORAGE_KEY);
  if (rawItems) {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) {
        state.items = parsed.map(normalizeItem).filter((item) => item.email);
      }
    } catch {
      state.items = [];
    }
  }

  const rawSettings = localStorage.getItem(SETTINGS_KEY);
  if (rawSettings) {
    try {
      const parsed = JSON.parse(rawSettings);
      const weeklyTokens = Number.parseInt(parsed.weeklyTokens, 10);
      if (Number.isFinite(weeklyTokens) && weeklyTokens >= 0) {
        state.settings.weeklyTokens = weeklyTokens;
      }
    } catch {
      state.settings.weeklyTokens = DEFAULT_WEEKLY_TOKENS;
    }
  }
}

function getDurationDays(item) {
  return AUTO_DURATION_DAYS;
}

function getRemainingMs(item) {
  const durationDays = getDurationDays(item);
  const targetMs = item.lastUsed + durationDays * DAY_MS;
  return targetMs - Date.now();
}

function getLiveItemState(item, nowMs = Date.now()) {
  const durationDays = getDurationDays(item);
  const durationMs = Math.max(1, durationDays * DAY_MS);
  const startPercent = clamp(item.limitPercent, 0, 100);
  const elapsedMs = Math.max(0, nowMs - item.lastUsed);
  const refillPercentPerMs = 100 / durationMs;
  const currentPercent = clamp(startPercent + elapsedMs * refillPercentPerMs, 0, 100);
  const remainingMs = Math.max(0, durationMs * ((100 - currentPercent) / 100));
  const weekly = state.settings.weeklyTokens;
  const tokenNow = weekly * (currentPercent / 100);
  const tokenPerDay = weekly / durationDays;
  const tokenPerHour = tokenPerDay / 24;

  return {
    durationDays,
    currentPercent,
    remainingMs,
    tokenNow,
    tokenPerDay,
    tokenPerHour
  };
}

function formatCountdown(remainingMs) {
  if (remainingMs <= 0) {
    return { text: "Full", className: "ok" };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return {
    text: `${days}h ${hours}j ${minutes}m`,
    className: "ok"
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTokenStats(syncInput) {
  if (syncInput && document.activeElement !== weeklyTokenInput) {
    weeklyTokenInput.value = String(state.settings.weeklyTokens);
  }

  const weekly = state.settings.weeklyTokens;
  const perDay = weekly / 7;
  const perHour = perDay / 24;

  tokenPerDayEl.textContent = formatNumber(perDay, 2);
  tokenPerHourEl.textContent = formatNumber(perHour, 2);
}

function render() {
  renderTokenStats(true);
  emptyStateEl.style.display = state.items.length ? "none" : "block";
  const openIds = new Set(
    Array.from(listEl.querySelectorAll(".card[open]")).map((node) => node.getAttribute("data-id"))
  );
  const nowMs = Date.now();
  const sortedItems = [...state.items].sort((a, b) => {
    const aRemaining = getLiveItemState(a, nowMs).remainingMs;
    const bRemaining = getLiveItemState(b, nowMs).remainingMs;
    return aRemaining - bRemaining;
  });

  listEl.innerHTML = sortedItems
    .map((item) => {
      const live = getLiveItemState(item, nowMs);
      const countdown = formatCountdown(live.remainingMs);
      const sliderPercent = Math.round(live.currentPercent);
      const isOpen = openIds.has(item.id) ? "open" : "";

      return `
        <li>
          <details class="card" data-id="${item.id}" ${isOpen}>
            <summary class="card-summary">
              <span class="card-summary-email">${escapeHtml(item.email)}</span>
              <span class="card-summary-right">
                <span class="status ${countdown.className}" data-role="countdown-summary">${countdown.text}</span>
                <span class="summary-percent" data-role="limit-summary">${sliderPercent}%</span>
              </span>
              <span class="summary-progress" aria-hidden="true">
                <span class="summary-progress-fill" data-role="summary-progress-fill" style="width:${sliderPercent}%"></span>
              </span>
            </summary>

            <div class="card-body">
              <div class="card-top">
                <div>
                  <h2 class="card-email">${escapeHtml(item.email)}</h2>
                </div>
                <span class="status ${countdown.className}" data-role="countdown">${countdown.text}</span>
              </div>

              <span class="mode-tag">Countdown otomatis 7 hari</span>
              <p class="card-meta" data-role="token-now">Token saat ini: ${formatNumber(live.tokenNow, 2)}</p>
              <p class="card-meta" data-role="token-rate">Refill: ${formatNumber(live.tokenPerHour, 2)}/jam | ${formatNumber(live.tokenPerDay, 2)}/hari</p>

              <div class="control-row">
                <button class="secondary" data-action="edit-email">Edit nama</button>
                <button data-action="delete">Hapus</button>
              </div>

              <div class="slider-group">
                <label for="limit-${item.id}">Rate limit</label>
                <div class="slider-row">
                  <input id="limit-${item.id}" type="range" min="0" max="100" step="1" value="${sliderPercent}" data-action="set-limit" />
                  <span class="range-label" data-role="limit-label">${sliderPercent}%</span>
                </div>
              </div>
            </div>
          </details>
        </li>
      `;
    })
    .join("");
}

function updateCountdownLabelsOnly() {
  const nowMs = Date.now();
  const cardNodes = listEl.querySelectorAll(".card");
  cardNodes.forEach((card) => {
    const id = card.getAttribute("data-id");
    const item = state.items.find((entry) => entry.id === id);
    if (!item) {
      return;
    }

    const live = getLiveItemState(item, nowMs);
    const countdown = formatCountdown(live.remainingMs);
    const countdownEl = card.querySelector("[data-role='countdown']");
    const countdownSummaryEl = card.querySelector("[data-role='countdown-summary']");
    if (!countdownEl) {
      return;
    }
    const slider = card.querySelector("input[data-action='set-limit']");
    const limitLabel = card.querySelector("[data-role='limit-label']");
    const limitSummary = card.querySelector("[data-role='limit-summary']");
    const summaryProgressFill = card.querySelector("[data-role='summary-progress-fill']");
    const tokenNowEl = card.querySelector("[data-role='token-now']");
    const tokenRateEl = card.querySelector("[data-role='token-rate']");
    const isDragging = id ? draggingLimitIds.has(id) : false;
    const isSliderActive = slider instanceof HTMLInputElement && (document.activeElement === slider || isDragging);

    countdownEl.textContent = countdown.text;
    countdownEl.classList.remove("ok", "expired");
    countdownEl.classList.add(countdown.className);
    if (countdownSummaryEl) {
      countdownSummaryEl.textContent = countdown.text;
      countdownSummaryEl.classList.remove("ok", "expired");
      countdownSummaryEl.classList.add(countdown.className);
    }
    if (slider instanceof HTMLInputElement && !isSliderActive) {
      slider.value = String(Math.round(live.currentPercent));
    }
    if (limitLabel) {
      limitLabel.textContent = `${Math.round(live.currentPercent)}%`;
    }
    if (limitSummary) {
      limitSummary.textContent = `${Math.round(live.currentPercent)}%`;
    }
    if (summaryProgressFill) {
      summaryProgressFill.style.width = `${Math.round(live.currentPercent)}%`;
    }
    if (tokenNowEl) {
      tokenNowEl.textContent = `Token saat ini: ${formatNumber(live.tokenNow, 2)}`;
    }
    if (tokenRateEl) {
      tokenRateEl.textContent = `Refill: ${formatNumber(live.tokenPerHour, 2)}/jam | ${formatNumber(live.tokenPerDay, 2)}/hari`;
    }
  });
}

function updateItem(id, updater) {
  const idx = state.items.findIndex((item) => item.id === id);
  if (idx === -1) {
    return;
  }

  const next = updater({ ...state.items[idx] });
  state.items[idx] = normalizeItem(next);
  saveItems();
  render();
}

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  if (!email) {
    return;
  }

  state.items.unshift(
    normalizeItem({
      id: crypto.randomUUID(),
      email,
      lastUsed: Date.now(),
      duration: AUTO_DURATION_DAYS,
      mode: "auto",
      limitPercent: 50
    })
  );

  saveItems();
  render();
  emailInput.value = "";
  emailInput.focus();
});

weeklyTokenInput.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const numeric = Number.parseInt(target.value, 10);
  state.settings.weeklyTokens = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  saveSettings();
  render();
});

listEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".card");
  if (!card) {
    return;
  }

  const id = card.getAttribute("data-id");
  if (!id) {
    return;
  }

  const action = button.getAttribute("data-action");

  if (action === "edit-email") {
    const current = state.items.find((item) => item.id === id);
    if (!current) {
      return;
    }
    const nextEmail = window.prompt("Ubah nama email/akun:", current.email);
    if (nextEmail === null) {
      return;
    }
    const cleaned = nextEmail.trim();
    if (!cleaned) {
      return;
    }
    updateItem(id, (item) => ({ ...item, email: cleaned }));
    return;
  }

  if (action === "delete") {
    state.items = state.items.filter((item) => item.id !== id);
    saveItems();
    render();
  }
});

listEl.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const card = target.closest(".card");
  if (!card) {
    return;
  }

  const id = card.getAttribute("data-id");
  if (!id) {
    return;
  }

  const action = target.getAttribute("data-action");
  const numeric = Number.parseInt(target.value, 10);

  if (action === "set-limit") {
    if (!Number.isFinite(numeric)) {
      return;
    }
    const idx = state.items.findIndex((item) => item.id === id);
    if (idx === -1) {
      return;
    }

    state.items[idx] = normalizeItem({
      ...state.items[idx],
      limitPercent: clamp(numeric, 0, 100),
      lastUsed: Date.now()
    });

    const currentCard = target.closest(".card");
    if (!currentCard) {
      return;
    }
    const limitLabel = currentCard.querySelector("[data-role='limit-label']");
    const limitSummary = currentCard.querySelector("[data-role='limit-summary']");
    const summaryProgressFill = currentCard.querySelector("[data-role='summary-progress-fill']");
    if (limitLabel) {
      limitLabel.textContent = `${clamp(numeric, 0, 100)}%`;
    }
    if (limitSummary) {
      limitSummary.textContent = `${clamp(numeric, 0, 100)}%`;
    }
    if (summaryProgressFill) {
      summaryProgressFill.style.width = `${clamp(numeric, 0, 100)}%`;
    }
  }
});

listEl.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.getAttribute("data-action") !== "set-limit") {
    return;
  }
  const card = target.closest(".card");
  const id = card?.getAttribute("data-id");
  if (id) {
    draggingLimitIds.add(id);
  }
});

listEl.addEventListener("pointerup", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.getAttribute("data-action") !== "set-limit") {
    return;
  }
  const card = target.closest(".card");
  const id = card?.getAttribute("data-id");
  if (id) {
    draggingLimitIds.delete(id);
  }
  saveItems();
});

listEl.addEventListener("pointercancel", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.getAttribute("data-action") !== "set-limit") {
    return;
  }
  const card = target.closest(".card");
  const id = card?.getAttribute("data-id");
  if (id) {
    draggingLimitIds.delete(id);
  }
  saveItems();
});

listEl.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.getAttribute("data-action") !== "set-limit") {
    return;
  }
  const card = target.closest(".card");
  const id = card?.getAttribute("data-id");
  if (id) {
    draggingLimitIds.delete(id);
  }
  saveItems();
});

loadState();
render();
setInterval(() => {
  updateCountdownLabelsOnly();
  renderTokenStats(false);
}, REFRESH_MS);
