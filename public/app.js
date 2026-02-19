const STORAGE_KEY_BINDER = "myPokemonBinder";
const STORAGE_KEY_BINDER_STATE = "pokemonBinderStateV2";
const LEGACY_STORAGE_KEY_DECK = "myPokemonDeck";
const DEFAULT_BINDER_NAME = "Main Binder";
const COLLECTION_PRESET_OPTIONS = ["all_set", "pokemon_151", "mega"];
const CONDITION_OPTIONS = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged"
];

const state = {
  cards: [],
  sets: [],
  binders: [],
  activeBinderId: "",
  binder: [],
  profile: {
    name: "",
    ign: "",
    avatar: ""
  },
  binderCollection: {
    preset: "all_set",
    setId: "",
    cards: [],
    loading: false,
    error: ""
  },
  totalCount: 0,
  page: 1,
  pageSize: 24,
  query: {
    search: "",
    setId: "",
    sort: "name_asc"
  },
  binderQuery: {
    search: "",
    sort: "number_asc",
    condition: ""
  },
  gacha: {
    packs: [],
    selectedSetId: "",
    packCount: 1,
    opening: false,
    revealing: false,
    lastPulls: [],
    lastPackCount: 0,
    revealQueue: [],
    revealIndex: 0,
    revealSetName: "",
    revealStage: "front",
    flipAllRevealed: false,
    popoutOpen: false,
    infoVisible: false,
    packChoicesSetId: "",
    packChoices: [],
    selectedPackChoiceId: "",
    packRevealPending: false,
    packRevealTimer: null,
    previewCache: {},
    ripActive: false,
    ripDone: false,
    ripPointerId: null,
    cutGuidePoints: [],
    showCutGuide: false,
    ripAligned: false,
    ripMinX: 0,
    ripMaxX: 0,
    ripPoints: [],
    ripStartX: 0,
    ripStartY: 0,
    ripDistance: 0,
    firstFlipAnimating: false,
    firstFlipTimer: null,
    reviewVisible: false,
    pullsAddedToBinder: false,
    rarestPullCardId: "",
    godPacksOpened: 0
  }
};

const el = {
  searchInput: document.getElementById("searchInput"),
  setFilter: document.getElementById("setFilter"),
  sortSelect: document.getElementById("sortSelect"),
  resultMeta: document.getElementById("resultMeta"),
  pageInfo: document.getElementById("pageInfo"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  cardGrid: document.getElementById("cardGrid"),
  binderStats: document.getElementById("binderStats"),
  workspaceTitle: document.getElementById("workspaceTitle"),
  workspaceSubtitle: document.getElementById("workspaceSubtitle"),
  trainerAvatarBtn: document.getElementById("trainerAvatarBtn"),
  trainerAvatarImage: document.getElementById("trainerAvatarImage"),
  trainerAvatarInitial: document.getElementById("trainerAvatarInitial"),
  trainerAvatarInput: document.getElementById("trainerAvatarInput"),
  trainerIgn: document.getElementById("trainerIgn"),
  dashboardCardsOwned: document.getElementById("dashboardCardsOwned"),
  dashboardUniqueOwned: document.getElementById("dashboardUniqueOwned"),
  dashboardNetWorth: document.getElementById("dashboardNetWorth"),
  dashboardGodPacks: document.getElementById("dashboardGodPacks"),
  dashboardTopMeta: document.getElementById("dashboardTopMeta"),
  dashboardTopCards: document.getElementById("dashboardTopCards"),
  binderPicker: document.getElementById("binderPicker"),
  addBinderBtn: document.getElementById("addBinderBtn"),
  renameBinderBtn: document.getElementById("renameBinderBtn"),
  deleteBinderBtn: document.getElementById("deleteBinderBtn"),
  binderCollectionPreset: document.getElementById("binderCollectionPreset"),
  binderCollectionSet: document.getElementById("binderCollectionSet"),
  binderSearch: document.getElementById("binderSearch"),
  binderSort: document.getElementById("binderSort"),
  binderCondition: document.getElementById("binderCondition"),
  clearBinder: document.getElementById("clearBinder"),
  binderList: document.getElementById("binderList"),
  gachaPopout: document.getElementById("gachaPopout"),
  gachaPopoutPanel: document.getElementById("gachaPopoutPanel"),
  gachaPopoutInfo: document.getElementById("gachaPopoutInfo"),
  gachaInfoToggleBtn: document.getElementById("gachaInfoToggleBtn"),
  gachaPackPicker: document.getElementById("gachaPackPicker"),
  gachaPackCard: document.getElementById("gachaPackCard"),
  gachaCutLayer: document.getElementById("gachaCutLayer"),
  gachaCutSvg: document.getElementById("gachaCutSvg"),
  gachaCutGuideRail: document.getElementById("gachaCutGuideRail"),
  gachaCutGuidePath: document.getElementById("gachaCutGuidePath"),
  gachaCutPath: document.getElementById("gachaCutPath"),
  gachaPackSeries: document.getElementById("gachaPackSeries"),
  gachaPackArt: document.getElementById("gachaPackArt"),
  gachaPackLogo: document.getElementById("gachaPackLogo"),
  gachaPackName: document.getElementById("gachaPackName"),
  gachaStatus: document.getElementById("gachaStatus"),
  gachaBounceLabel: document.getElementById("gachaBounceLabel"),
  gachaBounceCards: document.getElementById("gachaBounceCards"),
  gachaContentsPreview: document.getElementById("gachaContentsPreview"),
  gachaResult: document.getElementById("gachaResult"),
  gachaDrawReview: document.getElementById("gachaDrawReview"),
  gachaDrawReviewMeta: document.getElementById("gachaDrawReviewMeta"),
  gachaCloseReviewBtn: document.getElementById("gachaCloseReviewBtn"),
  gachaAddToBinderBtn: document.getElementById("gachaAddToBinderBtn"),
  emptyStateTemplate: document.getElementById("emptyStateTemplate"),
  cardModal: document.getElementById("cardModal"),
  modalFlipCard: document.getElementById("modalFlipCard"),
  modalNextCard: document.getElementById("modalNextCard"),
  modalNextCardImage: document.getElementById("modalNextCardImage"),
  modalCardFrontImage: document.getElementById("modalCardFrontImage"),
  modalCardBackImage: document.getElementById("modalCardBackImage"),
  modalHint: document.getElementById("modalHint"),
  modalTiltStage: document.getElementById("modalTiltStage"),
  modalTiltCard: document.getElementById("modalTiltCard"),
  modalRevealInfo: document.getElementById("modalRevealInfo"),
  modalRevealCounter: document.getElementById("modalRevealCounter"),
  modalRevealRarity: document.getElementById("modalRevealRarity"),
  modalRevealSkipBtn: document.getElementById("modalRevealSkipBtn")
};

const sidebarLinks = Array.from(document.querySelectorAll(".sidebar-link"));

const tiltState = {
  isDragging: false,
  mode: "tilt",
  pointerId: null,
  startX: 0,
  startY: 0,
  dragDistance: 0,
  deltaX: 0,
  deltaY: 0
};

const priceLookupState = {
  byId: new Map(),
  pendingIds: new Set(),
  batchTimer: null
};

function toPositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function isValidCondition(value) {
  return CONDITION_OPTIONS.includes(value);
}

function normalizeBinderEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const byId = new Map();

  for (const raw of entries) {
    const cardId = raw?.id;
    if (!cardId) {
      continue;
    }

    const normalizedQty = toPositiveInt(raw.ownedQty || raw.quantity || 1, 1);
    const condition = isValidCondition(raw.condition)
      ? raw.condition
      : "Near Mint";
    const baseEntry = {
      id: cardId,
      name: raw.name || "Unknown card",
      images: raw.images || {},
      hp: raw.hp,
      types: raw.types,
      rarity: raw.rarity,
      set: raw.set || {},
      number: raw.number,
      supertype: raw.supertype,
      subtypes: raw.subtypes,
      tcgplayer: raw.tcgplayer,
      cardmarket: raw.cardmarket,
      notes: raw.notes || "",
      condition,
      ownedQty: normalizedQty,
      addedAt: raw.addedAt || Date.now(),
      updatedAt: raw.updatedAt || Date.now()
    };

    if (!byId.has(cardId)) {
      byId.set(cardId, baseEntry);
      continue;
    }

    const existing = byId.get(cardId);
    existing.ownedQty += normalizedQty;
    existing.updatedAt = Math.max(existing.updatedAt || 0, baseEntry.updatedAt || 0);
    if (existing.notes.length < (baseEntry.notes || "").length) {
      existing.notes = baseEntry.notes;
    }
    if (existing.condition === "Near Mint" && baseEntry.condition !== "Near Mint") {
      existing.condition = baseEntry.condition;
    }
    if (!existing.cardmarket && baseEntry.cardmarket) {
      existing.cardmarket = baseEntry.cardmarket;
    }
    if (!existing.tcgplayer && baseEntry.tcgplayer) {
      existing.tcgplayer = baseEntry.tcgplayer;
    }
  }

  return [...byId.values()];
}

function generateBinderId() {
  return `binder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultBinderRecord(name = DEFAULT_BINDER_NAME, entries = []) {
  return {
    id: generateBinderId(),
    name,
    entries: normalizeBinderEntries(entries)
  };
}

function normalizeBinderRecord(raw, index) {
  const fallbackName = index === 0 ? DEFAULT_BINDER_NAME : `Binder ${index + 1}`;
  const name = String(raw?.name || fallbackName).trim() || fallbackName;
  return {
    id: raw?.id || generateBinderId(),
    name,
    entries: normalizeBinderEntries(raw?.entries)
  };
}

function getActiveBinderRecord() {
  return state.binders.find((binder) => binder.id === state.activeBinderId) || null;
}

function setActiveBinder(binderId) {
  const target =
    state.binders.find((binder) => binder.id === binderId) ||
    state.binders[0] ||
    createDefaultBinderRecord();

  if (!state.binders.length) {
    state.binders = [target];
  }

  state.activeBinderId = target.id;
  state.binder = target.entries;
}

function loadBinderState() {
  try {
    const stateRaw = localStorage.getItem(STORAGE_KEY_BINDER_STATE);
    if (stateRaw) {
      const parsed = JSON.parse(stateRaw);
      const binders = Array.isArray(parsed?.binders)
        ? parsed.binders.map((binder, index) => normalizeBinderRecord(binder, index))
        : [];

      state.binders = binders.length ? binders : [createDefaultBinderRecord()];
      state.profile.name = String(parsed?.profile?.name || "").slice(0, 40);
      state.profile.ign = String(parsed?.profile?.ign || "").slice(0, 30);
      state.profile.avatar = String(parsed?.profile?.avatar || "");
      state.gacha.godPacksOpened = Math.max(toPositiveInt(parsed?.godPacksOpened, 0), 0);
      if (COLLECTION_PRESET_OPTIONS.includes(parsed?.binderCollection?.preset)) {
        state.binderCollection.preset = parsed.binderCollection.preset;
      }
      state.binderCollection.setId = String(parsed?.binderCollection?.setId || "");
      setActiveBinder(parsed?.activeBinderId || state.binders[0].id);
      return;
    }

    const binderRaw = localStorage.getItem(STORAGE_KEY_BINDER);
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_DECK);
    const legacyEntries = binderRaw
      ? normalizeBinderEntries(JSON.parse(binderRaw))
      : legacyRaw
        ? normalizeBinderEntries(JSON.parse(legacyRaw))
        : [];

    state.binders = [createDefaultBinderRecord(DEFAULT_BINDER_NAME, legacyEntries)];
    setActiveBinder(state.binders[0].id);
  } catch {
    state.binders = [createDefaultBinderRecord()];
    setActiveBinder(state.binders[0].id);
  }
}

function saveBinder() {
  const active = getActiveBinderRecord();
  if (active) {
    active.entries = state.binder;
  }

  const payload = {
    binders: state.binders,
    activeBinderId: state.activeBinderId,
    profile: {
      name: state.profile.name,
      ign: state.profile.ign,
      avatar: state.profile.avatar
    },
    binderCollection: {
      preset: state.binderCollection.preset,
      setId: state.binderCollection.setId
    },
    godPacksOpened: state.gacha.godPacksOpened
  };

  localStorage.setItem(STORAGE_KEY_BINDER_STATE, JSON.stringify(payload));
  localStorage.setItem(STORAGE_KEY_BINDER, JSON.stringify(state.binder));
}

function getBinderEntry(cardId) {
  return state.binder.find((entry) => entry.id === cardId);
}

function formatPack(card) {
  const set = card.set || {};
  const series = set.series ? ` (${set.series})` : "";
  const release = set.releaseDate ? ` - ${set.releaseDate}` : "";
  return `${set.name || "Unknown pack"}${series}${release}`;
}

function colorFromSetId(setId, rotate = 0) {
  const value = String(setId || "pack-default");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }

  return `hsl(${(Math.abs(hash) + rotate) % 360} 86% 54%)`;
}

function rarityAccent(rarity) {
  const label = String(rarity || "").toLowerCase();

  if (label.includes("ultra") || label.includes("secret") || label.includes("rainbow")) {
    return {
      background: "linear-gradient(140deg, #7c3aed, #ec4899)",
      border: "rgba(255, 255, 255, 0.6)"
    };
  }

  if (label.includes("rare") || label.includes("holo")) {
    return {
      background: "linear-gradient(140deg, #f59e0b, #ef4444)",
      border: "rgba(255, 255, 255, 0.55)"
    };
  }

  if (label.includes("uncommon")) {
    return {
      background: "linear-gradient(140deg, #16a34a, #22c55e)",
      border: "rgba(255, 255, 255, 0.45)"
    };
  }

  return {
    background: "linear-gradient(140deg, #334155, #475569)",
    border: "rgba(255, 255, 255, 0.4)"
  };
}

function setActiveView(viewId, title, subtitle, activeLink = null) {
  const views = document.querySelectorAll(".view");
  for (const view of views) {
    view.classList.toggle("is-active", view.id === `view-${viewId}`);
  }

  if (activeLink) {
    for (const link of sidebarLinks) {
      link.classList.toggle("is-active", link === activeLink);
    }
  }

  if (title) {
    el.workspaceTitle.textContent = title;
  }

  if (subtitle) {
    el.workspaceSubtitle.textContent = subtitle;
  }

  if (viewId === "finder") {
    window.requestAnimationFrame(() => {
      el.searchInput.focus();
    });
  }
}

function resetTilt() {
  el.modalTiltCard.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  el.modalTiltCard.style.setProperty("--shine-x", "50%");
  el.modalTiltCard.style.setProperty("--shine-y", "50%");
  el.modalTiltCard.style.setProperty("--shine-strength", "0.24");
  el.modalTiltStage.classList.remove("is-tilting");
}

function setModalRevealMode(enabled) {
  el.cardModal.classList.toggle("is-reveal", enabled);
  el.modalRevealInfo.hidden = !enabled;
  el.modalHint.hidden = enabled;

  if (el.modalRevealSkipBtn) {
    el.modalRevealSkipBtn.disabled = !enabled;
  }

  if (!enabled) {
    el.modalRevealRarity.style.background = "";
    el.modalRevealRarity.style.borderColor = "";
  }
}

function setModalCardFace(card, showBackFirst = false) {
  el.modalCardFrontImage.src = card.images?.large || card.images?.small || "";
  el.modalCardFrontImage.alt = `${card.name} card preview`;
  el.modalCardBackImage.src = "/cardback.jpg";
  el.modalCardBackImage.alt = "Pokemon card back";
  el.modalFlipCard.classList.toggle("is-revealed", !showBackFirst);
}

function resetRevealSwipeTransform(useSnap = true) {
  if (useSnap) {
    el.modalFlipCard.classList.add("is-snap");
  } else {
    el.modalFlipCard.classList.remove("is-snap");
  }

  el.modalFlipCard.classList.remove("is-swipe-dragging", "is-swipe-out");
  el.modalTiltCard.classList.remove("is-swipe-active");
  el.modalNextCard.hidden = true;
  el.modalFlipCard.style.setProperty("--swipe-x", "0px");
  el.modalFlipCard.style.setProperty("--swipe-r", "0deg");

  if (useSnap) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        el.modalFlipCard.classList.remove("is-snap");
      });
    });
  }
}

function applyRevealSwipeTransform(deltaX) {
  const clampedX = Math.max(Math.min(deltaX, 240), -240);
  const rotation = clampedX * 0.055;
  const previewThreshold = 24;
  const shouldShowNextPreview = Math.abs(clampedX) >= previewThreshold;

  el.modalFlipCard.classList.add("is-swipe-dragging");
  el.modalTiltCard.classList.toggle("is-swipe-active", shouldShowNextPreview);
  el.modalNextCard.hidden = !shouldShowNextPreview;
  el.modalFlipCard.style.setProperty("--swipe-x", `${clampedX.toFixed(2)}px`);
  el.modalFlipCard.style.setProperty("--swipe-r", `${rotation.toFixed(2)}deg`);
}

function swipeRevealCardOut(direction) {
  const dir = direction >= 0 ? 1 : -1;
  el.modalFlipCard.classList.remove("is-swipe-dragging");
  el.modalTiltCard.classList.remove("is-swipe-active");
  el.modalFlipCard.classList.add("is-swipe-out");
  el.modalFlipCard.style.setProperty("--swipe-x", `${dir * 560}px`);
  el.modalFlipCard.style.setProperty("--swipe-r", `${dir * 22}deg`);

  let settled = false;
  const finishSwipe = () => {
    if (settled) {
      return;
    }
    settled = true;
    el.modalFlipCard.removeEventListener("transitionend", onTransitionEnd);
    advanceGachaReveal();
  };

  const onTransitionEnd = (event) => {
    if (event.propertyName !== "transform") {
      return;
    }
    finishSwipe();
  };

  el.modalFlipCard.addEventListener("transitionend", onTransitionEnd);
  window.setTimeout(finishSwipe, 320);
}

function hideNextRevealPreview() {
  el.modalNextCard.hidden = true;
  el.modalNextCardImage.removeAttribute("src");
  el.modalNextCard.classList.remove("is-back");
}

function rarityScore(rarity) {
  const label = String(rarity || "").toLowerCase();

  if (!label) {
    return 0;
  }

  if (
    label.includes("hyper") ||
    label.includes("secret") ||
    label.includes("illustration rare") ||
    label.includes("ultra") ||
    label.includes("rainbow")
  ) {
    return 6;
  }

  if (label.includes("double rare") || label.includes("special illustration")) {
    return 5;
  }

  if (label.includes("rare") || label.includes("holo")) {
    return 4;
  }

  if (label.includes("uncommon")) {
    return 2;
  }

  if (label.includes("common")) {
    return 1;
  }

  return 3;
}

function rarityGlowTier(rarity) {
  const label = String(rarity || "").toLowerCase();

  if (
    label.includes("hyper") ||
    label.includes("secret") ||
    label.includes("illustration rare") ||
    label.includes("ultra") ||
    label.includes("rainbow") ||
    label.includes("gold")
  ) {
    return "ultra";
  }

  if (label.includes("holo")) {
    return "holo";
  }

  if (label.includes("rare") || label.includes("promo")) {
    return "rare";
  }

  return "base";
}

function toFiniteNumber(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function getCardMarketBaseValue(card) {
  const cardId = card?.id;
  const cardmarket = card?.cardmarket?.prices || {};
  const tcgPrices = card?.tcgplayer?.prices || {};
  const tcgCandidates = [];

  for (const priceObj of Object.values(tcgPrices)) {
    if (!priceObj || typeof priceObj !== "object") {
      continue;
    }
    tcgCandidates.push(
      toFiniteNumber(priceObj.market),
      toFiniteNumber(priceObj.mid),
      toFiniteNumber(priceObj.low)
    );
  }

  const candidates = [
    toFiniteNumber(cardmarket.trendPrice),
    toFiniteNumber(cardmarket.averageSellPrice),
    toFiniteNumber(cardmarket.avg1),
    toFiniteNumber(cardmarket.avg7),
    ...tcgCandidates
  ].filter((value) => value > 0);

  if (candidates.length) {
    return candidates[0];
  }

  if (cardId && priceLookupState.byId.has(cardId)) {
    return toFiniteNumber(priceLookupState.byId.get(cardId));
  }

  return 0;
}

async function fetchCardPrices(cardIds) {
  const response = await fetch("/api/card-prices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ids: cardIds })
  });

  if (!response.ok) {
    throw new Error("Could not fetch card prices");
  }

  const payload = await response.json();
  return payload?.prices || {};
}

function queueCardPriceLookup(cards) {
  const queue = [];
  for (const card of cards) {
    const cardId = card?.id;
    if (!cardId) {
      continue;
    }

    const hasInlineValue = getCardMarketBaseValue({ ...card, id: "" }) > 0;
    if (hasInlineValue) {
      continue;
    }

    if (priceLookupState.byId.has(cardId) || priceLookupState.pendingIds.has(cardId)) {
      continue;
    }

    queue.push(cardId);
  }

  if (!queue.length) {
    return;
  }

  for (const cardId of queue) {
    priceLookupState.pendingIds.add(cardId);
  }

  if (priceLookupState.batchTimer) {
    return;
  }

  priceLookupState.batchTimer = window.setTimeout(async () => {
    priceLookupState.batchTimer = null;
    const ids = [...priceLookupState.pendingIds].slice(0, 120);
    ids.forEach((id) => priceLookupState.pendingIds.delete(id));

    try {
      const prices = await fetchCardPrices(ids);
      for (const id of ids) {
        priceLookupState.byId.set(id, toFiniteNumber(prices[id]));
      }
    } catch {
      for (const id of ids) {
        priceLookupState.byId.set(id, 0);
      }
    }

    renderDashboard();
    renderBinder();
  }, 90);
}

function getCardLastSoldValue(card) {
  const value = getCardMarketBaseValue(card);
  return toFiniteNumber(value);
}

function formatLastSoldValue(card) {
  const value = getCardLastSoldValue(card);
  if (value <= 0) {
    return "Last sold: N/A";
  }

  return `Last sold: ${formatCurrency(value)}`;
}

function formatCurrency(value) {
  return `$${toFiniteNumber(value).toFixed(2)}`;
}

function formatDate(value) {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) {
    return "-";
  }

  return new Date(time).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getRarestPulledCardId(cards) {
  let rarestCardId = "";
  let highestScore = -1;

  for (const card of cards) {
    const score = rarityScore(card.rarity);
    if (score > highestScore) {
      highestScore = score;
      rarestCardId = card.id;
    }
  }

  return rarestCardId;
}

function clearFirstFlipTimer() {
  if (state.gacha.firstFlipTimer) {
    window.clearTimeout(state.gacha.firstFlipTimer);
    state.gacha.firstFlipTimer = null;
  }
}

function updateNextRevealPreview() {
  const nextItem = state.gacha.revealQueue[state.gacha.revealIndex + 1];

  if (
    !state.gacha.revealing ||
    !nextItem ||
    !state.gacha.flipAllRevealed ||
    state.gacha.firstFlipAnimating
  ) {
    hideNextRevealPreview();
    return;
  }

  el.modalNextCard.classList.remove("is-back");
  el.modalNextCardImage.src = nextItem.card.images?.large || nextItem.card.images?.small || "";
  el.modalNextCardImage.alt = `${nextItem.card.name} next card`;
  el.modalNextCard.hidden = true;
}

function updateTilt(clientX, clientY) {
  const rect = el.modalTiltStage.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const percentX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const percentY = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
  const maxRange = 32;
  const rotateY = (percentX - 0.5) * maxRange;
  const rotateX = (0.5 - percentY) * maxRange;
  const distanceFromCenter = Math.hypot(percentX - 0.5, percentY - 0.5);
  const shineStrength = 0.24 + Math.min(distanceFromCenter * 0.9, 0.42);

  el.modalTiltCard.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.05)`;
  el.modalTiltCard.style.setProperty("--shine-x", `${Math.round(percentX * 100)}%`);
  el.modalTiltCard.style.setProperty("--shine-y", `${Math.round(percentY * 100)}%`);
  el.modalTiltCard.style.setProperty("--shine-strength", shineStrength.toFixed(3));
}

function startTilt(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  event.preventDefault();
  tiltState.isDragging = true;
  tiltState.mode =
    state.gacha.revealing && state.gacha.revealStage === "front" ? "swipe" : "tilt";
  tiltState.pointerId = event.pointerId;
  tiltState.startX = event.clientX;
  tiltState.startY = event.clientY;
  tiltState.dragDistance = 0;
  tiltState.deltaX = 0;
  tiltState.deltaY = 0;

  el.modalTiltStage.classList.add("is-grabbing");
  el.modalTiltCard.classList.add("is-dragging");

  if (el.modalTiltStage.setPointerCapture) {
    el.modalTiltStage.setPointerCapture(event.pointerId);
  }

  if (tiltState.mode === "swipe") {
    resetRevealSwipeTransform();
    return;
  }

  updateTilt(event.clientX, event.clientY);
}

function moveTilt(event) {
  if (!tiltState.isDragging) {
    return;
  }

  if (tiltState.pointerId !== null && event.pointerId !== tiltState.pointerId) {
    return;
  }

  const deltaX = event.clientX - tiltState.startX;
  const deltaY = event.clientY - tiltState.startY;
  tiltState.deltaX = deltaX;
  tiltState.deltaY = deltaY;
  tiltState.dragDistance = Math.max(
    tiltState.dragDistance,
    Math.hypot(deltaX, deltaY)
  );

  if (tiltState.mode === "swipe") {
    applyRevealSwipeTransform(deltaX);
    return;
  }

  if (tiltState.dragDistance > 8) {
    el.modalTiltStage.classList.add("is-tilting");
  }

  updateTilt(event.clientX, event.clientY);
}

function endTilt(event) {
  if (!tiltState.isDragging) {
    return;
  }

  if (
    event &&
    tiltState.pointerId !== null &&
    event.pointerId !== undefined &&
    event.pointerId !== tiltState.pointerId
  ) {
    return;
  }

  if (
    el.modalTiltStage.releasePointerCapture &&
    tiltState.pointerId !== null &&
    el.modalTiltStage.hasPointerCapture(tiltState.pointerId)
  ) {
    el.modalTiltStage.releasePointerCapture(tiltState.pointerId);
  }

  tiltState.isDragging = false;
  tiltState.pointerId = null;
  el.modalTiltStage.classList.remove("is-grabbing");
  el.modalTiltCard.classList.remove("is-dragging");

  if (tiltState.mode === "swipe") {
    const absX = Math.abs(tiltState.deltaX);
    const absY = Math.abs(tiltState.deltaY);
    const canSwipe = absX > 95 && absX > absY * 1.15;

    if (canSwipe) {
      swipeRevealCardOut(tiltState.deltaX);
    } else {
      resetRevealSwipeTransform();
    }

    tiltState.dragDistance = 0;
    tiltState.deltaX = 0;
    tiltState.deltaY = 0;
    tiltState.mode = "tilt";
    return;
  }

  if (
    state.gacha.revealing &&
    state.gacha.revealStage === "back" &&
    tiltState.dragDistance < 8
  ) {
    revealCurrentCardFront();
  }

  tiltState.dragDistance = 0;
  tiltState.deltaX = 0;
  tiltState.deltaY = 0;
  tiltState.mode = "tilt";
}

function openCardModal(card) {
  setModalCardFace(card, false);
  el.modalFlipCard.classList.remove("is-front-locked");
  resetRevealSwipeTransform();
  hideNextRevealPreview();

  setModalRevealMode(false);
  el.cardModal.classList.add("is-open");
  el.cardModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  resetTilt();
}

function closeCardModal() {
  if (!el.cardModal.classList.contains("is-open")) {
    return;
  }

  if (state.gacha.revealing) {
    return;
  }

  endTilt();
  el.cardModal.classList.remove("is-open");
  el.cardModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setModalRevealMode(false);
  el.modalTiltStage.classList.remove("is-grabbing", "is-tilting");
  el.modalFlipCard.classList.add("is-revealed");
  el.modalFlipCard.classList.remove("is-front-locked");
  resetRevealSwipeTransform();
  hideNextRevealPreview();
  resetTilt();
}

async function fetchSets() {
  const response = await fetch("/api/sets");
  if (!response.ok) {
    throw new Error("Could not fetch sets");
  }

  const data = await response.json();
  state.sets = data.sets || [];
}

async function fetchCards() {
  const params = new URLSearchParams({
    search: state.query.search,
    setId: state.query.setId,
    sort: state.query.sort,
    page: String(state.page),
    pageSize: String(state.pageSize)
  });

  const response = await fetch(`/api/cards?${params.toString()}`);

  if (!response.ok) {
    let details = "Could not fetch cards";
    try {
      const payload = await response.json();
      details = payload.details || payload.error || details;
    } catch {
      // ignore JSON parsing error
    }
    throw new Error(details);
  }

  const data = await response.json();
  state.cards = data.cards || [];
  state.totalCount = data.totalCount || 0;
}

async function fetchGachaPacks() {
  const response = await fetch("/api/gacha/packs");
  if (!response.ok) {
    throw new Error("Could not fetch gacha packs");
  }

  const data = await response.json();
  state.gacha.packs = data.packs || [];
}

async function fetchGachaPreview(setId) {
  const params = new URLSearchParams({ setId });
  const response = await fetch(`/api/gacha/preview?${params.toString()}`);

  if (!response.ok) {
    let message = "Could not load pack preview";
    try {
      const payload = await response.json();
      message = payload.details || payload.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

function formatOddsPercent(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function updateGachaInfoVisibility() {
  if (!el.gachaPopoutPanel || !el.gachaInfoToggleBtn) {
    return;
  }

  const infoVisible = Boolean(state.gacha.infoVisible);
  el.gachaPopoutPanel.classList.toggle("is-info-hidden", !infoVisible);
  el.gachaPopoutPanel.classList.toggle("is-info-visible", infoVisible);
  el.gachaInfoToggleBtn.setAttribute("aria-pressed", String(infoVisible));
  el.gachaInfoToggleBtn.setAttribute(
    "aria-label",
    infoVisible ? "Hide odds" : "Show odds"
  );
  el.gachaInfoToggleBtn.title = infoVisible ? "Hide odds" : "Show odds";
}

function hideGachaInfoPanel() {
  if (!state.gacha.infoVisible) {
    return;
  }

  state.gacha.infoVisible = false;
  updateGachaInfoVisibility();
}

function renderGachaPreviewLoading() {
  el.gachaContentsPreview.innerHTML = "";
  const loading = document.createElement("p");
  loading.className = "gacha-preview-empty";
  loading.textContent = "Loading pack details...";
  el.gachaContentsPreview.appendChild(loading);
}

function renderGachaPreviewError(message) {
  el.gachaContentsPreview.innerHTML = "";
  const warning = document.createElement("p");
  warning.className = "gacha-preview-empty";
  warning.textContent = `Could not load details. ${message}`;
  el.gachaContentsPreview.appendChild(warning);
}

function renderGachaPreview(payload) {
  const previewCards = payload?.contentsPreview || [];

  el.gachaContentsPreview.innerHTML = "";
  if (!previewCards.length) {
    const empty = document.createElement("p");
    empty.className = "gacha-preview-empty";
    empty.textContent = "No preview cards available for this set.";
    el.gachaContentsPreview.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const card of previewCards) {
      const item = document.createElement("article");
      item.className = "gacha-preview-card";

      const image = document.createElement("img");
      image.loading = "lazy";
      image.src = card.images?.small || card.images?.large || "";
      image.alt = `${card.name} preview card`;
      if (!image.src) {
        image.classList.add("is-missing");
      }
      item.appendChild(image);

      const name = document.createElement("p");
      name.className = "gacha-preview-card-name";
      name.textContent = card.name || "Unknown card";
      item.appendChild(name);

      const caption = document.createElement("p");
      caption.className = "gacha-preview-card-rarity";
      caption.textContent = card.rarity || "Unknown rarity";
      item.appendChild(caption);

      const chance = document.createElement("p");
      chance.className = "gacha-preview-card-odds";
      chance.textContent = `Odds: ${formatOddsPercent(card.estimatedOdds)}`;
      item.appendChild(chance);

      fragment.appendChild(item);
    }
    el.gachaContentsPreview.appendChild(fragment);
  }
}

function updateAddToBinderButtonState() {
  if (!el.gachaAddToBinderBtn) {
    return;
  }

  const hasPulls = state.gacha.lastPulls.some((packPull) => (packPull.cards || []).length);
  const disabled = state.gacha.pullsAddedToBinder || !hasPulls;
  el.gachaAddToBinderBtn.disabled = disabled;
  el.gachaAddToBinderBtn.textContent = state.gacha.pullsAddedToBinder
    ? "Added to Binder"
    : "Add to Binder";
}

function hideGachaDrawReview() {
  state.gacha.reviewVisible = false;
  if (!el.gachaDrawReview) {
    return;
  }

  el.gachaDrawReview.hidden = true;
}

function showGachaDrawReview() {
  state.gacha.reviewVisible = true;
  if (!el.gachaDrawReview) {
    return;
  }

  el.gachaDrawReview.hidden = false;
  updateAddToBinderButtonState();
}

function updateGachaBounceLabel() {
  if (!el.gachaBounceLabel) {
    return;
  }

  const remaining = state.gacha.packChoices.length;
  if (!state.gacha.selectedSetId) {
    el.gachaBounceLabel.textContent = "Choose a set to show 7 packs";
    return;
  }

  if (remaining <= 0) {
    el.gachaBounceLabel.textContent = "No packs left in this 7-pack spread";
    return;
  }

  el.gachaBounceLabel.textContent = `Choose 1 out of ${remaining} pack${remaining === 1 ? "" : "s"}`;
}

async function loadAndRenderGachaPreview(setId) {
  if (!setId) {
    el.gachaContentsPreview.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "gacha-preview-empty";
    empty.textContent = "Select a pack to view possible contents.";
    el.gachaContentsPreview.appendChild(empty);
    return;
  }

  if (state.gacha.previewCache[setId]) {
    renderGachaPreview(state.gacha.previewCache[setId]);
    return;
  }

  renderGachaPreviewLoading();

  try {
    const payload = await fetchGachaPreview(setId);
    state.gacha.previewCache[setId] = payload;
    if (state.gacha.selectedSetId === setId) {
      renderGachaPreview(payload);
    }
  } catch (error) {
    renderGachaPreviewError(error.message);
  }
}

function renderSetFilter() {
  el.setFilter.innerHTML = "";

  const allSetsOption = document.createElement("option");
  allSetsOption.value = "";
  allSetsOption.textContent = "All packs";
  el.setFilter.appendChild(allSetsOption);

  const fragment = document.createDocumentFragment();

  for (const set of state.sets) {
    const option = document.createElement("option");
    option.value = set.id;
    option.textContent = `${set.name} (${set.series || "Unknown series"})`;
    fragment.appendChild(option);
  }

  el.setFilter.appendChild(fragment);
  el.setFilter.value = state.query.setId || "";
  renderCollectionSetOptions();
}

function renderCollectionSetOptions() {
  if (!el.binderCollectionSet) {
    return;
  }

  el.binderCollectionSet.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a set";
  el.binderCollectionSet.appendChild(placeholder);

  const fragment = document.createDocumentFragment();
  for (const set of state.sets) {
    const option = document.createElement("option");
    option.value = set.id;
    option.textContent = `${set.name} (${set.series || "Series"})`;
    fragment.appendChild(option);
  }
  el.binderCollectionSet.appendChild(fragment);

  if (!state.binderCollection.setId && state.sets[0]) {
    state.binderCollection.setId = state.sets[0].id;
  }

  const hasSelectedSet = state.sets.some((set) => set.id === state.binderCollection.setId);
  if (!hasSelectedSet) {
    state.binderCollection.setId = state.sets[0]?.id || "";
  }

  el.binderCollectionSet.value = state.binderCollection.setId || "";
  const useSetPicker = state.binderCollection.preset === "all_set";
  el.binderCollectionSet.disabled = !useSetPicker;
}

function renderBinderPicker() {
  if (!el.binderPicker) {
    return;
  }

  el.binderPicker.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const binder of state.binders) {
    const option = document.createElement("option");
    option.value = binder.id;
    option.textContent = binder.name;
    if (binder.id === state.activeBinderId) {
      option.selected = true;
    }
    fragment.appendChild(option);
  }

  el.binderPicker.appendChild(fragment);

  if (el.deleteBinderBtn) {
    el.deleteBinderBtn.disabled = state.binders.length <= 1;
  }
}

function addNewBinder() {
  const input = window.prompt("New binder name", `Binder ${state.binders.length + 1}`);
  if (input === null) {
    return;
  }

  const name = input.trim().slice(0, 40);
  if (!name) {
    return;
  }

  const binder = createDefaultBinderRecord(name);
  state.binders.push(binder);
  setActiveBinder(binder.id);
  saveBinder();
  renderBinderPicker();
  renderBinder();
}

function renameActiveBinder() {
  const active = getActiveBinderRecord();
  if (!active) {
    return;
  }

  const input = window.prompt("Rename binder", active.name);
  if (input === null) {
    return;
  }

  const name = input.trim().slice(0, 40);
  if (!name) {
    return;
  }

  active.name = name;
  saveBinder();
  renderBinderPicker();
  renderBinder();
}

function deleteActiveBinder() {
  const active = getActiveBinderRecord();
  if (!active || state.binders.length <= 1) {
    return;
  }

  if (!window.confirm(`Delete binder \"${active.name}\"?`)) {
    return;
  }

  state.binders = state.binders.filter((binder) => binder.id !== active.id);
  setActiveBinder(state.binders[0]?.id || "");
  saveBinder();
  renderBinderPicker();
  renderBinder();
}

async function fetchAllCollectionCards({ search = "", setId = "", sort = "name_asc" }) {
  const pageSize = 40;
  let page = 1;
  let totalCount = Infinity;
  const cards = [];

  while (cards.length < totalCount) {
    const params = new URLSearchParams({
      search,
      setId,
      sort,
      page: String(page),
      pageSize: String(pageSize)
    });

    const response = await fetch(`/api/cards?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Could not load collection cards");
    }

    const payload = await response.json();
    const pageCards = payload.cards || [];
    totalCount = payload.totalCount || pageCards.length;
    cards.push(...pageCards);

    if (!pageCards.length) {
      break;
    }

    page += 1;
    if (page > 80) {
      break;
    }
  }

  return cards;
}

async function loadBinderCollectionCards() {
  state.binderCollection.loading = true;
  state.binderCollection.error = "";
  renderBinder();

  try {
    const preset = COLLECTION_PRESET_OPTIONS.includes(state.binderCollection.preset)
      ? state.binderCollection.preset
      : "all_set";
    state.binderCollection.preset = preset;

    let cards = [];

    if (preset === "all_set") {
      if (!state.binderCollection.setId) {
        state.binderCollection.cards = [];
        state.binderCollection.loading = false;
        renderBinder();
        return;
      }

      cards = await fetchAllCollectionCards({
        setId: state.binderCollection.setId,
        sort: "name_asc"
      });
    } else if (preset === "pokemon_151") {
      const set151 = state.sets.find((set) => (set.name || "").toLowerCase().includes("151"));
      if (!set151) {
        state.binderCollection.cards = [];
        state.binderCollection.error = "Pokemon 151 set is unavailable in this data source.";
        state.binderCollection.loading = false;
        renderBinder();
        return;
      }

      cards = await fetchAllCollectionCards({
        setId: set151.id,
        sort: "name_asc"
      });
    } else {
      const allMegaMatches = await fetchAllCollectionCards({
        search: "mega",
        sort: "name_asc"
      });
      cards = allMegaMatches.filter((card) => {
        const name = String(card.name || "").toLowerCase();
        const subtypes = Array.isArray(card.subtypes)
          ? card.subtypes.map((item) => String(item).toLowerCase())
          : [];
        return name.startsWith("mega ") || subtypes.includes("mega");
      });
    }

    const uniqueCards = new Map();
    for (const card of cards) {
      if (card?.id && !uniqueCards.has(card.id)) {
        uniqueCards.set(card.id, card);
      }
    }

    state.binderCollection.cards = [...uniqueCards.values()];
  } catch (error) {
    state.binderCollection.cards = [];
    state.binderCollection.error = error.message || "Unable to load binder collection.";
  } finally {
    state.binderCollection.loading = false;
    renderBinder();
  }
}

function renderDashboard() {
  if (!el.dashboardCardsOwned) {
    return;
  }

  const uniqueOwned = state.binder.length;
  const totalCopies = state.binder.reduce(
    (sum, entry) => sum + toPositiveInt(entry.ownedQty, 1),
    0
  );
  const netWorth = state.binder.reduce((sum, entry) => {
    const qty = toPositiveInt(entry.ownedQty, 1);
    return sum + getCardLastSoldValue(entry) * qty;
  }, 0);

  el.dashboardCardsOwned.textContent = String(totalCopies);
  el.dashboardUniqueOwned.textContent = `${uniqueOwned} unique card${uniqueOwned === 1 ? "" : "s"}`;
  el.dashboardNetWorth.textContent = formatCurrency(netWorth);
  el.dashboardGodPacks.textContent = String(state.gacha.godPacksOpened);

  if (el.dashboardTopMeta) {
    const active = getActiveBinderRecord();
    el.dashboardTopMeta.textContent = active
      ? `Highest last sold value cards in ${active.name}.`
      : "Highest last sold value cards in your active binder.";
  }

  if (el.trainerIgn && el.trainerIgn.value !== state.profile.ign) {
    el.trainerIgn.value = state.profile.ign;
  }
  renderTrainerAvatar();

  if (!el.dashboardTopCards) {
    return;
  }

  el.dashboardTopCards.innerHTML = "";
  queueCardPriceLookup(state.binder.slice(0, 120));
  const topCards = [...state.binder]
    .sort((left, right) => getCardLastSoldValue(right) - getCardLastSoldValue(left))
    .slice(0, 5);

  if (!topCards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No cards in this binder yet.";
    el.dashboardTopCards.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const card of topCards) {
    const article = document.createElement("article");
    article.className = "dashboard-top-card";

    const image = document.createElement("img");
    image.src = card.images?.small || "";
    image.alt = `${card.name} top card`;
    article.appendChild(image);

    const name = document.createElement("h4");
    name.textContent = card.name;
    article.appendChild(name);

    const meta = document.createElement("p");
    meta.textContent = `${card.set?.name || "Set"} | ${card.rarity || "Unknown"}`;
    article.appendChild(meta);

    const value = document.createElement("p");
    value.className = "dashboard-top-value";
    value.textContent = formatLastSoldValue(card);
    article.appendChild(value);

    fragment.appendChild(article);
  }

  el.dashboardTopCards.appendChild(fragment);
}

function renderTrainerAvatar() {
  if (!el.trainerAvatarImage || !el.trainerAvatarInitial) {
    return;
  }

  const hasAvatar = Boolean(state.profile.avatar);
  if (hasAvatar) {
    el.trainerAvatarImage.src = state.profile.avatar;
    el.trainerAvatarImage.hidden = false;
    el.trainerAvatarInitial.hidden = true;
    return;
  }

  el.trainerAvatarImage.hidden = true;
  el.trainerAvatarImage.removeAttribute("src");
  const ignInitial = String(state.profile.ign || "").trim().charAt(0).toUpperCase();
  el.trainerAvatarInitial.textContent = ignInitial || "?";
  el.trainerAvatarInitial.hidden = false;
}

function upsertBinderCard(card, quantity = 1) {
  const amount = Math.max(toPositiveInt(quantity, 1), 1);
  const existing = getBinderEntry(card.id);

  if (existing) {
    existing.ownedQty = Math.min(
      99,
      toPositiveInt(existing.ownedQty, 1) + amount
    );
    existing.updatedAt = Date.now();
    if (!existing.cardmarket && card.cardmarket) {
      existing.cardmarket = card.cardmarket;
    }
    if (!existing.tcgplayer && card.tcgplayer) {
      existing.tcgplayer = card.tcgplayer;
    }
    return;
  }

  state.binder.unshift({
    id: card.id,
    name: card.name,
    images: card.images,
    hp: card.hp,
    types: card.types,
    rarity: card.rarity,
    set: card.set,
    number: card.number,
    supertype: card.supertype,
    subtypes: card.subtypes,
    tcgplayer: card.tcgplayer,
    cardmarket: card.cardmarket,
    condition: "Near Mint",
    notes: "",
    ownedQty: Math.min(99, amount),
    addedAt: Date.now(),
    updatedAt: Date.now()
  });
}

function createCardElement(card) {
  const article = document.createElement("article");
  article.className = "card-item";
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", `Preview ${card.name} card`);

  article.addEventListener("click", (event) => {
    if (event.target.closest("button")) {
      return;
    }
    openCardModal(card);
  });

  article.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openCardModal(card);
  });

  const image = document.createElement("img");
  image.loading = "lazy";
  image.src = card.images?.small || "";
  image.alt = `${card.name} trading card`;
  article.appendChild(image);

  const name = document.createElement("h3");
  name.textContent = card.name;
  article.appendChild(name);

  const hp = document.createElement("p");
  hp.className = "meta-line";
  hp.textContent = `HP: ${card.hp || "N/A"} | Type: ${(card.types || []).join(", ") || "N/A"}`;
  article.appendChild(hp);

  const rarity = document.createElement("p");
  rarity.className = "meta-line";
  rarity.textContent = `Rarity: ${card.rarity || "Unknown"}`;
  article.appendChild(rarity);

  const pack = document.createElement("p");
  pack.className = "pack-chip";
  pack.textContent = card.set?.name || "Unknown pack";
  article.appendChild(pack);

  const packDetails = document.createElement("p");
  packDetails.className = "meta-line";
  packDetails.textContent = `From: ${formatPack(card)}`;
  article.appendChild(packDetails);

  return article;
}

function renderCards() {
  el.cardGrid.innerHTML = "";

  if (!state.cards.length) {
    el.cardGrid.appendChild(el.emptyStateTemplate.content.cloneNode(true));
  } else {
    const fragment = document.createDocumentFragment();
    for (const card of state.cards) {
      fragment.appendChild(createCardElement(card));
    }
    el.cardGrid.appendChild(fragment);
  }

  const start = state.totalCount ? (state.page - 1) * state.pageSize + 1 : 0;
  const end = Math.min(state.page * state.pageSize, state.totalCount);
  const totalPages = Math.max(Math.ceil(state.totalCount / state.pageSize), 1);

  el.resultMeta.textContent = `${start}-${end} of ${state.totalCount} cards`;
  el.pageInfo.textContent = `Page ${state.page} / ${totalPages}`;
  el.prevPage.disabled = state.page === 1;
  el.nextPage.disabled = state.page >= totalPages;
}

function renderGachaSetOptions() {
  el.gachaPackPicker.innerHTML = "";

  if (!state.gacha.packs.length) {
    const empty = document.createElement("p");
    empty.className = "gacha-pack-picker-empty";
    empty.textContent = "No sets available";
    el.gachaPackPicker.appendChild(empty);
    state.gacha.selectedSetId = "";
    resetGachaPackChoices();
    closeGachaPopout({ force: true });
    void loadAndRenderGachaPreview("");
    el.gachaPackCard.disabled = true;
    return;
  }

  const hasSelectedPack = state.gacha.packs.some((pack) => pack.id === state.gacha.selectedSetId);
  if (!hasSelectedPack) {
    state.gacha.selectedSetId = "";
    resetGachaPackChoices();
    closeGachaPopout({ force: true });
    void loadAndRenderGachaPreview("");
  }

  const fragment = document.createDocumentFragment();
  for (const pack of state.gacha.packs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gacha-pack-option";
    button.dataset.setId = pack.id;
    button.setAttribute("role", "option");

    if (pack.visual?.boosterArt) {
      const art = document.createElement("img");
      art.className = "gacha-pack-option-art";
      art.src = pack.visual.boosterArt;
      art.alt = `${pack.name} pack art`;
      art.loading = "lazy";
      button.appendChild(art);
    } else {
      const fallbackArt = document.createElement("span");
      fallbackArt.className = "gacha-pack-option-fallback";
      const fallbackLogoSrc = pack.visual?.logo || pack.visual?.symbol || "";
      if (fallbackLogoSrc) {
        const fallbackLogo = document.createElement("img");
        fallbackLogo.className = "gacha-pack-option-fallback-logo";
        fallbackLogo.src = fallbackLogoSrc;
        fallbackLogo.alt = `${pack.name} logo`;
        fallbackArt.appendChild(fallbackLogo);
      } else {
        const fallbackBadge = document.createElement("span");
        fallbackBadge.className = "gacha-pack-option-fallback-badge";
        fallbackBadge.textContent = "PK";
        fallbackArt.appendChild(fallbackBadge);
      }
      button.appendChild(fallbackArt);
    }

    const meta = document.createElement("span");
    meta.className = "gacha-pack-option-meta";

    const name = document.createElement("span");
    name.className = "gacha-pack-option-name";
    name.textContent = pack.name;

    const series = document.createElement("span");
    series.className = "gacha-pack-option-series";
    series.textContent = pack.series || "Series";

    meta.append(name, series);
    button.appendChild(meta);

    button.addEventListener("click", () => {
      if (state.gacha.opening || state.gacha.revealing) {
        return;
      }

      if (state.gacha.selectedSetId !== pack.id) {
        state.gacha.selectedSetId = pack.id;
        resetGachaPackChoices();
        updateGachaPackPickerState();
        resetPackRipState();
        updateGachaPackVisual();
      }

      openGachaPopout();
    });

    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      button.click();
    });

    button.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const offsetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const offsetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      button.style.setProperty("--tilt-x", `${(offsetX * 8).toFixed(2)}deg`);
      button.style.setProperty("--tilt-y", `${(-offsetY * 6).toFixed(2)}deg`);
      button.style.setProperty("--lift-y", `${(-4 - Math.abs(offsetX) * 1.8).toFixed(2)}px`);
      button.classList.add("is-popping");
    });

    const resetOptionTilt = () => {
      button.classList.remove("is-popping");
      button.style.removeProperty("--tilt-x");
      button.style.removeProperty("--tilt-y");
      button.style.removeProperty("--lift-y");
    };

    button.addEventListener("pointerleave", resetOptionTilt);
    button.addEventListener("pointerup", resetOptionTilt);
    button.addEventListener("pointercancel", resetOptionTilt);

    fragment.appendChild(button);
  }

  el.gachaPackPicker.appendChild(fragment);

  updateGachaPackPickerState();
  updateGachaPackVisual();
}

function updateGachaPackPickerState() {
  const isBusy = state.gacha.opening || state.gacha.revealing;
  const options = el.gachaPackPicker.querySelectorAll(".gacha-pack-option");

  options.forEach((option) => {
    const isSelected = option.dataset.setId === state.gacha.selectedSetId;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
    option.disabled = isBusy;
  });
}

function resetGachaPackChoices() {
  state.gacha.packChoicesSetId = "";
  state.gacha.packChoices = [];
  state.gacha.selectedPackChoiceId = "";
  state.gacha.packRevealPending = false;
  state.gacha.reviewVisible = false;
  if (state.gacha.packRevealTimer) {
    window.clearTimeout(state.gacha.packRevealTimer);
    state.gacha.packRevealTimer = null;
  }
  el.gachaPackCard.classList.remove("is-pack-popping");
  if (el.gachaBounceCards) {
    el.gachaBounceCards.innerHTML = "";
    el.gachaBounceCards.removeAttribute("data-set-id");
  }
  hideGachaDrawReview();
  updateGachaBounceLabel();
}

function ensureGachaPackChoices(selectedPack) {
  const setId = selectedPack?.id || "";
  if (!setId) {
    resetGachaPackChoices();
    return;
  }

  const needsRebuild =
    state.gacha.packChoicesSetId !== setId ||
    !state.gacha.packChoices.length;

  if (!needsRebuild) {
    return;
  }

  const allArts = [
    ...(selectedPack.visual?.boosterArts || []),
    selectedPack.visual?.boosterArt || ""
  ].filter(Boolean);
  const fallbackLogo = selectedPack.visual?.logo || selectedPack.visual?.symbol || "";

  state.gacha.packChoicesSetId = setId;
  state.gacha.packChoices = Array.from({ length: 7 }, (_value, index) => {
    const art = allArts.length ? allArts[index % allArts.length] : "";
    return {
      id: `${setId}-choice-${index + 1}`,
      label: `Pack ${index + 1}`,
      art,
      fallbackLogo,
      slotIndex: index
    };
  });

  state.gacha.selectedPackChoiceId = "";
  updateGachaBounceLabel();
}

function getSelectedGachaPackChoice() {
  return (
    state.gacha.packChoices.find((choice) => choice.id === state.gacha.selectedPackChoiceId) ||
    null
  );
}

function consumeSelectedGachaPackChoice() {
  const selectedChoiceId = state.gacha.selectedPackChoiceId;
  if (!selectedChoiceId) {
    return;
  }

  state.gacha.packChoices = state.gacha.packChoices.filter(
    (choice) => choice.id !== selectedChoiceId
  );
  state.gacha.selectedPackChoiceId = "";
  state.gacha.packRevealPending = false;

  if (state.gacha.packRevealTimer) {
    window.clearTimeout(state.gacha.packRevealTimer);
    state.gacha.packRevealTimer = null;
  }

  updateGachaBounceLabel();
}

function getBounceCardTransforms(count) {
  const presets = [
    "rotate(14deg) translate(-270px)",
    "rotate(9deg) translate(-180px)",
    "rotate(4deg) translate(-90px)",
    "rotate(0deg) translate(0px)",
    "rotate(-4deg) translate(90px)",
    "rotate(-9deg) translate(180px)",
    "rotate(-14deg) translate(270px)"
  ];

  if (count <= presets.length) {
    return presets.slice(0, count);
  }

  return Array.from({ length: count }, (_value, index) => {
    if (index < presets.length) {
      return presets[index];
    }
    const offset = (index - Math.floor(count / 2)) * 90;
    const rotation = Math.max(-16, Math.min(16, offset / -20));
    return `rotate(${rotation.toFixed(1)}deg) translate(${offset.toFixed(0)}px)`;
  });
}

function getNoRotationTransform(transformStr) {
  const hasRotate = /rotate\([\s\S]*?\)/.test(transformStr);
  if (hasRotate) {
    return transformStr.replace(/rotate\([\s\S]*?\)/, "rotate(0deg)");
  }

  if (transformStr === "none") {
    return "rotate(0deg)";
  }

  return `${transformStr} rotate(0deg)`;
}

function getPushedTransform(baseTransform, offsetX) {
  const translateRegex = /translate\(([-0-9.]+)px\)/;
  const match = baseTransform.match(translateRegex);
  if (match) {
    const currentX = Number.parseFloat(match[1]);
    const nextX = currentX + offsetX;
    return baseTransform.replace(translateRegex, `translate(${nextX}px)`);
  }

  if (baseTransform === "none") {
    return `translate(${offsetX}px)`;
  }

  return `${baseTransform} translate(${offsetX}px)`;
}

function pushBouncePackSiblings(hoveredIdx) {
  if (!el.gachaBounceCards) {
    return;
  }

  const cards = Array.from(el.gachaBounceCards.querySelectorAll(".card"));
  cards.forEach((card, index) => {
    const baseTransform = card.dataset.baseTransform || "none";
    const distance = Math.abs(hoveredIdx - index);
    card.style.transitionDelay = `${distance * 35}ms`;

    if (index === hoveredIdx) {
      card.style.transform = getNoRotationTransform(baseTransform);
      return;
    }

    const offsetX = index < hoveredIdx ? -160 : 160;
    card.style.transform = getPushedTransform(baseTransform, offsetX);
  });
}

function resetBouncePackSiblings() {
  if (!el.gachaBounceCards) {
    return;
  }

  const cards = Array.from(el.gachaBounceCards.querySelectorAll(".card"));
  cards.forEach((card) => {
    card.style.transitionDelay = "0ms";
    card.style.transform = card.dataset.baseTransform || "none";
  });
}

function updateGachaBounceCardsState() {
  if (!el.gachaBounceCards) {
    return;
  }

  const isBusy = state.gacha.opening || state.gacha.revealing;
  const cards = Array.from(el.gachaBounceCards.querySelectorAll(".card"));
  cards.forEach((card) => {
    const isSelected = card.dataset.choiceId === state.gacha.selectedPackChoiceId;
    card.classList.toggle("is-selected", isSelected);
    card.setAttribute("aria-selected", String(isSelected));
    card.disabled = isBusy;
  });
}

function renderGachaBounceCards(selectedPack) {
  if (!el.gachaBounceCards) {
    return;
  }

  el.gachaBounceCards.innerHTML = "";
  if (!selectedPack) {
    el.gachaBounceCards.removeAttribute("data-set-id");
    updateGachaBounceLabel();
    return;
  }

  el.gachaBounceCards.dataset.setId = selectedPack.id;

  ensureGachaPackChoices(selectedPack);
  const transforms = getBounceCardTransforms(7);

  if (!state.gacha.packChoices.length) {
    const empty = document.createElement("p");
    empty.className = "gacha-pack-picker-empty";
    empty.textContent = "No unopened packs left in this 7-pack spread.";
    el.gachaBounceCards.appendChild(empty);
    updateGachaBounceLabel();
    return;
  }

  const fragment = document.createDocumentFragment();

  state.gacha.packChoices.forEach((choice, index) => {
    const card = document.createElement("button");
    card.type = "button";
    const slotIndex = Number.isInteger(choice.slotIndex) ? choice.slotIndex : index;
    card.className = `card card-${slotIndex}`;
    card.dataset.choiceId = choice.id;
    card.setAttribute("role", "option");

    const baseTransform = transforms[slotIndex] || "none";
    card.dataset.baseTransform = baseTransform;
    card.style.transform = baseTransform;

    if (choice.art || choice.fallbackLogo) {
      const image = document.createElement("img");
      image.className = "image";
      image.loading = "lazy";
      image.src = choice.art || choice.fallbackLogo;
      image.alt = `${choice.label} option`;
      if (!choice.art) {
        image.classList.add("is-logo-art");
      }
      card.appendChild(image);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "bounce-pack-empty";
      fallback.textContent = choice.label;
      card.appendChild(fallback);
    }

    card.addEventListener("pointerenter", () => {
      card.classList.add("is-dragged");
    });

    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-dragged");
    });

    card.addEventListener("pointerdown", () => {
      card.classList.add("is-dragged");
    });

    const clearDraggedState = () => {
      card.classList.remove("is-dragged");
    };

    card.addEventListener("pointerup", clearDraggedState);
    card.addEventListener("pointercancel", clearDraggedState);

    card.addEventListener("click", () => {
      if (state.gacha.opening || state.gacha.revealing) {
        return;
      }

      Array.from(el.gachaBounceCards.querySelectorAll(".card")).forEach((node) => {
        node.classList.remove("is-dragged");
      });
      hideGachaInfoPanel();
      hideGachaDrawReview();
      state.gacha.selectedPackChoiceId = choice.id;
      state.gacha.packRevealPending = true;
      updateGachaBounceCardsState();
      resetPackRipState();
      updateGachaPackVisual();
    });

    fragment.appendChild(card);
  });

  el.gachaBounceCards.appendChild(fragment);
  updateGachaBounceLabel();
  updateGachaBounceCardsState();

  Array.from(el.gachaBounceCards.querySelectorAll(".card")).forEach((card, index) => {
    card.animate(
      [
        { transform: `${card.dataset.baseTransform} scale(0)` },
        { transform: `${card.dataset.baseTransform} scale(1)` }
      ],
      {
        duration: 640,
        delay: 300 + index * 60,
        easing: "cubic-bezier(0.22, 1.32, 0.42, 1)",
        fill: "both"
      }
    );
  });
}

function closeSelectedGachaPackChoice() {
  if (state.gacha.opening || state.gacha.revealing) {
    return;
  }

  hideGachaInfoPanel();
  state.gacha.selectedPackChoiceId = "";
  state.gacha.packRevealPending = false;

  if (state.gacha.packRevealTimer) {
    window.clearTimeout(state.gacha.packRevealTimer);
    state.gacha.packRevealTimer = null;
  }

  el.gachaPackCard.classList.remove("is-pack-popping");
  resetPackRipState();
  updateGachaBounceCardsState();
  updateGachaPackVisual();
}

function openGachaPopout() {
  if (!state.gacha.selectedSetId) {
    return;
  }

  state.gacha.popoutOpen = true;
  el.gachaPopout.classList.add("is-open");
  el.gachaPopout.setAttribute("aria-hidden", "false");
  void loadAndRenderGachaPreview(state.gacha.selectedSetId);
}

function closeGachaPopout(options = {}) {
  const force = Boolean(options.force);
  if (!force && (state.gacha.opening || state.gacha.revealing)) {
    return;
  }

  state.gacha.popoutOpen = false;
  hideGachaInfoPanel();
  hideGachaDrawReview();
  el.gachaPopout.classList.remove("is-open");
  el.gachaPopout.setAttribute("aria-hidden", "true");

  if (!state.gacha.revealing) {
    resetPackRipState();
  }

  if (!force) {
    updateGachaPackVisual();
  }
}

function getSelectedGachaPack() {
  return (
    state.gacha.packs.find((pack) => pack.id === state.gacha.selectedSetId) || null
  );
}

function syncCutSvgToPack() {
  const rect = el.gachaPackCard.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 1);
  const height = Math.max(Math.round(rect.height), 1);
  el.gachaCutSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
}

function buildCutGuidePoints(width, height) {
  const guideY = height * 0.06;
  return [
    { x: 0, y: guideY },
    { x: width, y: guideY }
  ];
}

function pointsToPath(points) {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function updateCutGuidePath() {
  const rect = el.gachaPackCard.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    state.gacha.cutGuidePoints = [];
    if (el.gachaCutGuideRail) {
      el.gachaCutGuideRail.setAttribute("d", "");
    }
    el.gachaCutGuidePath.setAttribute("d", "");
    return;
  }

  const guidePoints = buildCutGuidePoints(rect.width, rect.height);
  state.gacha.cutGuidePoints = guidePoints;
  const guidePath = pointsToPath(guidePoints);
  if (el.gachaCutGuideRail) {
    el.gachaCutGuideRail.setAttribute("d", guidePath);
  }
  el.gachaCutGuidePath.setAttribute("d", guidePath);
}

function setCutGuideVisibility(visible) {
  const nextValue = Boolean(visible);
  state.gacha.showCutGuide = nextValue;
  el.gachaPackCard.classList.toggle("is-cut-guide-visible", nextValue);
}

function setRipAlignment(isAligned, options = {}) {
  const nextValue = Boolean(isAligned);
  if (state.gacha.ripAligned === nextValue) {
    return;
  }

  state.gacha.ripAligned = nextValue;
  el.gachaPackCard.classList.toggle("is-rip-aligned", nextValue);

  if (!options.silent && state.gacha.ripActive) {
    el.gachaStatus.textContent = nextValue
      ? "Aligned. Keep tracing the line to the end."
      : "Off the line. Move back onto the guide.";
  }
}

function distanceBetweenPoints(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distancePointToSegment(point, segStart, segEnd) {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return distanceBetweenPoints(point, segStart);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq)
  );

  const proj = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy
  };

  return distanceBetweenPoints(point, proj);
}

function distancePointToPolyline(point, polyline) {
  if (polyline.length < 2) {
    return Infinity;
  }

  let minDistance = Infinity;
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const distance = distancePointToSegment(point, polyline[index], polyline[index + 1]);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function updatePackAspectRatioFromImage() {
  const imageWidth = el.gachaPackArt.naturalWidth;
  const imageHeight = el.gachaPackArt.naturalHeight;

  if (!imageWidth || !imageHeight) {
    el.gachaPackCard.style.setProperty("--pack-aspect", "0.73");
    return;
  }

  const ratio = imageWidth / imageHeight;
  const clampedRatio = Math.min(Math.max(ratio, 0.55), 0.9);
  el.gachaPackCard.style.setProperty("--pack-aspect", clampedRatio.toFixed(4));
  syncCutSvgToPack();
}

function updateGachaPackVisual() {
  const selectedPack = getSelectedGachaPack();
  const isBusy = state.gacha.opening || state.gacha.revealing;
  updateGachaPackPickerState();

  if (!selectedPack) {
    resetGachaPackChoices();
    renderGachaBounceCards(null);
    setCutGuideVisibility(false);
    el.gachaPackSeries.textContent = "No Set";
    el.gachaPackName.textContent = "No pack selected";
    el.gachaPackArt.style.display = "none";
    el.gachaPackLogo.style.display = "none";
    el.gachaPackCard.style.setProperty("--pack-from", "#4f46e5");
    el.gachaPackCard.style.setProperty("--pack-to", "#ef4444");
    el.gachaPackCard.style.setProperty("--pack-aspect", "0.73");
    el.gachaPackCard.classList.remove("has-pack-art", "is-logo-only");
    el.gachaPackCard.disabled = true;
    syncCutSvgToPack();
    updateCutGuidePath();
    el.gachaStatus.textContent = "Choose a pack tile to pop it out.";
    return;
  }

  ensureGachaPackChoices(selectedPack);
  const hasRenderedCurrentSet =
    el.gachaBounceCards &&
    el.gachaBounceCards.dataset.setId === selectedPack.id &&
    el.gachaBounceCards.childElementCount === state.gacha.packChoices.length;

  if (!hasRenderedCurrentSet) {
    renderGachaBounceCards(selectedPack);
  } else {
    updateGachaBounceCardsState();
  }

  const selectedChoice = getSelectedGachaPackChoice();
  const activePackArt = selectedChoice?.art || "";

  const fromColor = selectedPack.visual?.gradientFrom || colorFromSetId(selectedPack.id);
  const toColor = selectedPack.visual?.gradientTo || colorFromSetId(selectedPack.id, 62);

  el.gachaPackCard.style.setProperty("--pack-from", fromColor);
  el.gachaPackCard.style.setProperty("--pack-to", toColor);
  el.gachaPackSeries.textContent = selectedPack.series || "Pokemon TCG";
  el.gachaPackName.textContent = selectedPack.name;

  if (!selectedChoice) {
    setCutGuideVisibility(false);
    el.gachaPackCard.classList.add("is-pack-hidden");
    el.gachaPackCard.classList.remove("is-pack-popping", "has-pack-art", "is-logo-only");
    el.gachaPackArt.removeAttribute("src");
    el.gachaPackArt.style.display = "none";
    el.gachaPackLogo.removeAttribute("src");
    el.gachaPackLogo.style.display = "none";
    el.gachaPackCard.disabled = true;
    if (!state.gacha.packChoices.length) {
      el.gachaStatus.textContent = "All 7 packs were opened for this set. Pick a different set.";
    } else {
      el.gachaStatus.textContent = "Pick one of the 7 packs to bring it to center.";
    }
    return;
  }

  el.gachaPackCard.classList.remove("is-pack-hidden");

  if (state.gacha.packRevealPending) {
    if (state.gacha.packRevealTimer) {
      window.clearTimeout(state.gacha.packRevealTimer);
      state.gacha.packRevealTimer = null;
    }

    el.gachaPackCard.classList.remove("is-pack-popping");
    void el.gachaPackCard.offsetWidth;
    el.gachaPackCard.classList.add("is-pack-popping");
    state.gacha.packRevealPending = false;

    state.gacha.packRevealTimer = window.setTimeout(() => {
      el.gachaPackCard.classList.remove("is-pack-popping");
      state.gacha.packRevealTimer = null;
    }, 420);
  }

  if (activePackArt) {
    if (el.gachaPackArt.src !== activePackArt) {
      el.gachaPackArt.src = activePackArt;
    }
    el.gachaPackArt.style.display = "block";
    el.gachaPackCard.classList.add("has-pack-art");
    el.gachaPackCard.classList.remove("is-logo-only");
    if (el.gachaPackArt.complete) {
      updatePackAspectRatioFromImage();
    }
  } else {
    el.gachaPackArt.removeAttribute("src");
    el.gachaPackArt.style.display = "none";
    el.gachaPackCard.classList.remove("has-pack-art");
    el.gachaPackCard.classList.add("is-logo-only");
    el.gachaPackCard.style.setProperty("--pack-aspect", "0.73");
    syncCutSvgToPack();
  }

  const fallbackLogo = selectedPack.visual?.logo || selectedPack.visual?.symbol || "";
  if (!activePackArt && fallbackLogo) {
    el.gachaPackLogo.src = fallbackLogo;
    el.gachaPackLogo.style.display = "block";
  } else {
    el.gachaPackLogo.removeAttribute("src");
    el.gachaPackLogo.style.display = "none";
  }

  const hasSet = Boolean(state.gacha.selectedSetId);
  const hasPackChoice = Boolean(state.gacha.selectedPackChoiceId);
  el.gachaPackCard.disabled = !hasSet || !hasPackChoice || isBusy;

  syncCutSvgToPack();
  updateCutGuidePath();

  if (!state.gacha.ripDone && !isBusy) {
    el.gachaStatus.textContent = state.gacha.showCutGuide
      ? "Trace the dashed line to open this pack."
      : "Pick one pack card, then tap to show the cut guide.";
  }
}

function resetPackRipState() {
  state.gacha.ripActive = false;
  state.gacha.ripDone = false;
  state.gacha.ripPointerId = null;
  setCutGuideVisibility(false);
  state.gacha.ripAligned = false;
  state.gacha.ripDistance = 0;
  state.gacha.ripMinX = 0;
  state.gacha.ripMaxX = 0;
  state.gacha.ripPoints = [];
  state.gacha.ripStartX = 0;
  state.gacha.ripStartY = 0;

  el.gachaPackCard.classList.remove(
    "is-cutting",
    "is-cut",
    "is-ripped",
    "is-rip-aligned",
    "is-cut-guide-visible"
  );
  el.gachaCutPath.setAttribute("d", "");
  updateCutGuidePath();
}

function getLocalPackPoint(event) {
  const rect = el.gachaPackCard.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    width: rect.width,
    height: rect.height
  };
}

function renderCutPath() {
  if (state.gacha.ripPoints.length < 2) {
    el.gachaCutPath.setAttribute("d", "");
    return;
  }

  let pathData = "";
  state.gacha.ripPoints.forEach((point, index) => {
    pathData += `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
  });

  el.gachaCutPath.setAttribute("d", pathData.trim());
}

function beginPackRip(event) {
  if (
    state.gacha.opening ||
    state.gacha.revealing ||
    state.gacha.ripDone ||
    !state.gacha.selectedSetId ||
    !state.gacha.selectedPackChoiceId
  ) {
    if (!state.gacha.selectedPackChoiceId && !state.gacha.opening && !state.gacha.revealing) {
      el.gachaStatus.textContent = "Pick one of the 7 pack cards first.";
    }
    return;
  }

  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  syncCutSvgToPack();
  updateCutGuidePath();
  const point = getLocalPackPoint(event);

  if (!state.gacha.showCutGuide) {
    setCutGuideVisibility(true);
    el.gachaStatus.textContent = "Guide ready. Trace the dashed line from start to end.";
    return;
  }

  const guideStart = state.gacha.cutGuidePoints[0];
  if (!guideStart || distanceBetweenPoints(point, guideStart) > 34) {
    el.gachaStatus.textContent = "Start tracing near the beginning of the dashed line.";
    return;
  }

  state.gacha.ripActive = true;
  state.gacha.ripPointerId = event.pointerId;
  state.gacha.ripStartX = point.x;
  state.gacha.ripStartY = point.y;
  state.gacha.ripMinX = point.x;
  state.gacha.ripMaxX = point.x;
  state.gacha.ripPoints = [point];
  state.gacha.ripDistance = 0;
  setRipAlignment(true, { silent: true });

  el.gachaPackCard.classList.add("is-cutting");
  if (el.gachaCutLayer.setPointerCapture) {
    el.gachaCutLayer.setPointerCapture(event.pointerId);
  }

  el.gachaStatus.textContent = "Good. Keep tracing along the dashed path.";
  renderCutPath();
}

function movePackRip(event) {
  if (!state.gacha.ripActive) {
    return;
  }

  if (state.gacha.ripPointerId !== null && event.pointerId !== state.gacha.ripPointerId) {
    return;
  }

  const point = getLocalPackPoint(event);
  const lastPoint = state.gacha.ripPoints[state.gacha.ripPoints.length - 1];

  const deltaX = point.x - lastPoint.x;
  const deltaY = point.y - lastPoint.y;
  const segmentLength = Math.hypot(deltaX, deltaY);

  if (segmentLength < 1.6) {
    return;
  }

  state.gacha.ripPoints.push(point);
  state.gacha.ripDistance += segmentLength;
  state.gacha.ripMinX = Math.min(state.gacha.ripMinX, point.x);
  state.gacha.ripMaxX = Math.max(state.gacha.ripMaxX, point.x);

  const distanceToGuide = distancePointToPolyline(point, state.gacha.cutGuidePoints);
  setRipAlignment(distanceToGuide <= 16);

  renderCutPath();
}

function completePackRip() {
  state.gacha.ripActive = false;
  state.gacha.ripDone = true;
  state.gacha.ripPointerId = null;
  setRipAlignment(true, { silent: true });

  el.gachaPackCard.classList.remove("is-cutting");
  el.gachaPackCard.classList.add("is-cut", "is-ripped");
  el.gachaStatus.textContent = "Cut complete. Opening pack...";

  window.setTimeout(() => {
    openGachaPack();
  }, 360);
}

function endPackRip(event) {
  if (!state.gacha.ripActive) {
    return;
  }

  if (
    el.gachaCutLayer.releasePointerCapture &&
    event &&
    event.pointerId !== undefined &&
    el.gachaCutLayer.hasPointerCapture(event.pointerId)
  ) {
    el.gachaCutLayer.releasePointerCapture(event.pointerId);
  }

  const packWidth = el.gachaPackCard.getBoundingClientRect().width;
  const guide = state.gacha.cutGuidePoints;
  const userPoints = state.gacha.ripPoints;
  const horizontalSpan = Math.max(state.gacha.ripMaxX - state.gacha.ripMinX, 0);

  let avgDistance = Infinity;
  let maxDistance = Infinity;

  if (guide.length > 1 && userPoints.length) {
    let sum = 0;
    let max = 0;
    let samples = 0;

    for (let index = 0; index < userPoints.length; index += 2) {
      const point = userPoints[index];
      const distance = distancePointToPolyline(point, guide);
      sum += distance;
      max = Math.max(max, distance);
      samples += 1;
    }

    if (samples > 0) {
      avgDistance = sum / samples;
      maxDistance = max;
    }
  }

  const startNear =
    guide[0] && userPoints[0]
      ? distanceBetweenPoints(userPoints[0], guide[0]) <= 34
      : false;
  const endNear =
    guide[guide.length - 1] && userPoints[userPoints.length - 1]
      ? distanceBetweenPoints(userPoints[userPoints.length - 1], guide[guide.length - 1]) <= 36
      : false;
  const crossedThreshold =
    startNear &&
    endNear &&
    userPoints.length >= 9 &&
    state.gacha.ripDistance > packWidth * 0.6 &&
    horizontalSpan > packWidth * 0.64 &&
    avgDistance <= 18 &&
    maxDistance <= 34;

  if (crossedThreshold) {
    completePackRip();
    return;
  }

  state.gacha.ripActive = false;
  state.gacha.ripPointerId = null;
  setRipAlignment(false, { silent: true });
  state.gacha.ripDistance = 0;
  state.gacha.ripMinX = 0;
  state.gacha.ripMaxX = 0;
  state.gacha.ripPoints = [];
  el.gachaPackCard.classList.remove("is-cutting");
  renderCutPath();
  el.gachaStatus.textContent = "Trace closer to the dashed line from start to end.";
}

function createGachaCardElement(card, options = {}) {
  const isRarest = Boolean(options.isRarest);
  const glowTier = rarityGlowTier(card.rarity);
  const container = document.createElement("article");
  container.className = "gacha-card";
  container.classList.add(`rarity-${glowTier}`);
  if (isRarest) {
    container.classList.add("is-rarest");
  }

  if (glowTier !== "base") {
    const glare = document.createElement("span");
    glare.className = `gacha-card-glare glare-${glowTier}`;
    glare.setAttribute("aria-hidden", "true");
    container.appendChild(glare);
  }

  const image = document.createElement("img");
  image.loading = "lazy";
  image.src = card.images?.small || "";
  image.alt = `${card.name} pull result`;
  container.appendChild(image);

  const name = document.createElement("p");
  name.className = "gacha-card-name";
  name.textContent = card.name;
  container.appendChild(name);

  const rarity = document.createElement("p");
  rarity.className = "gacha-card-rarity";
  rarity.textContent = card.rarity || "Unknown rarity";
  container.appendChild(rarity);

  return container;
}

function renderGachaPulls(response) {
  state.gacha.lastPulls = response.pulls || [];
  state.gacha.lastPackCount = toPositiveInt(response.packCount, 1);

  const allCards = [];
  for (const packPull of state.gacha.lastPulls) {
    for (const card of packPull.cards || []) {
      allCards.push(card);
    }
  }

  const rarestCardId = getRarestPulledCardId(allCards);
  state.gacha.rarestPullCardId = rarestCardId;

  if (el.gachaResult) {
    el.gachaResult.innerHTML = "";

    for (const packPull of state.gacha.lastPulls) {
      const section = document.createElement("section");
      section.className = "gacha-pack-result";
      if (packPull.godPack) {
        section.classList.add("is-god-pack");
      }

      const title = document.createElement("h3");
      title.textContent = packPull.godPack
        ? `God Pack ${packPull.packNumber} - ${response.set?.name || "Set"}`
        : `Pack ${packPull.packNumber} - ${response.set?.name || "Set"}`;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "gacha-cards-grid";
      for (const card of packPull.cards || []) {
        grid.appendChild(
          createGachaCardElement(card, {
            isRarest: Boolean(rarestCardId) && card.id === rarestCardId
          })
        );
      }

      section.appendChild(grid);
      el.gachaResult.appendChild(section);
    }
  }

  if (allCards.length) {
    el.gachaStatus.textContent = `Pulled ${allCards.length} cards from ${state.gacha.lastPackCount} pack(s).`;
  }

  if (el.gachaDrawReviewMeta) {
    el.gachaDrawReviewMeta.textContent = allCards.length
      ? `${allCards.length} cards pulled from ${state.gacha.lastPackCount} pack(s).`
      : "No cards pulled.";
  }

  updateAddToBinderButtonState();
}

function buildGachaRevealQueue(pulls) {
  const queue = [];
  for (const packPull of pulls) {
    const cards = packPull.cards || [];
    const totalInPack = cards.length;
    for (let index = 0; index < cards.length; index += 1) {
      queue.push({
        card: cards[index],
        packNumber: packPull.packNumber,
        slotIndex: index + 1,
        totalInPack
      });
    }
  }

  return queue;
}

function showRevealCard() {
  const item = state.gacha.revealQueue[state.gacha.revealIndex];
  if (!item) {
    return;
  }

  clearFirstFlipTimer();
  state.gacha.firstFlipAnimating = false;
  el.modalFlipCard.classList.remove("is-first-flip");

  const showBackFace = false;
  state.gacha.revealStage = "front";

  setModalCardFace(item.card, showBackFace);
  el.modalFlipCard.classList.add("is-front-locked");
  resetRevealSwipeTransform();
  updateNextRevealPreview();

  el.modalRevealCounter.textContent = `${state.gacha.revealSetName} • ${item.slotIndex}/${item.totalInPack}`;

  const isRarestCard =
    Boolean(state.gacha.rarestPullCardId) && item.card.id === state.gacha.rarestPullCardId;
  const revealTier = rarityGlowTier(item.card.rarity);

  el.modalFlipCard.classList.remove("reveal-tier-rare", "reveal-tier-holo", "reveal-tier-ultra");
  if (revealTier !== "base") {
    el.modalFlipCard.classList.add(`reveal-tier-${revealTier}`);
  }

  el.modalTiltCard.classList.toggle("is-rarest-reveal", isRarestCard);
  el.modalFlipCard.classList.toggle("is-rarest-reveal", isRarestCard);

  const accent = rarityAccent(item.card.rarity);
  el.modalRevealRarity.textContent = item.card.rarity || "Unknown rarity";
  el.modalRevealRarity.style.background = accent.background;
  el.modalRevealRarity.style.borderColor = accent.border;
  el.gachaStatus.textContent = "Swipe this card away to reveal the next card.";

  setModalRevealMode(true);
  el.cardModal.classList.add("is-open");
  el.cardModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  resetTilt();
}

function revealCurrentCardFront() {
  if (!state.gacha.revealing || state.gacha.revealStage !== "back") {
    return;
  }

  const item = state.gacha.revealQueue[state.gacha.revealIndex];
  if (!item) {
    return;
  }

  state.gacha.flipAllRevealed = true;
  state.gacha.revealStage = "front";
  state.gacha.firstFlipAnimating = state.gacha.revealIndex === 0;
  el.modalFlipCard.classList.add("is-revealed");
  el.modalFlipCard.classList.add("is-front-locked");

  if (state.gacha.firstFlipAnimating) {
    hideNextRevealPreview();
    el.modalFlipCard.classList.add("is-first-flip");
    clearFirstFlipTimer();
    state.gacha.firstFlipTimer = window.setTimeout(() => {
      if (!state.gacha.revealing || state.gacha.revealIndex !== 0) {
        return;
      }

      state.gacha.firstFlipAnimating = false;
      el.modalFlipCard.classList.remove("is-first-flip");
      updateNextRevealPreview();
      state.gacha.firstFlipTimer = null;
    }, 780);
  } else {
    updateNextRevealPreview();
  }

  const accent = rarityAccent(item.card.rarity);
  el.modalRevealRarity.textContent = item.card.rarity || "Unknown rarity";
  el.modalRevealRarity.style.background = accent.background;
  el.modalRevealRarity.style.borderColor = accent.border;
  el.gachaStatus.textContent = "Great. Now swipe cards away for each next reveal.";
}

function finishGachaReveal() {
  clearFirstFlipTimer();
  state.gacha.firstFlipAnimating = false;
  state.gacha.revealing = false;
  state.gacha.flipAllRevealed = false;
  state.gacha.revealQueue = [];
  state.gacha.revealIndex = 0;
  state.gacha.revealStage = "front";

  endTilt();
  el.cardModal.classList.remove("is-open");
  el.cardModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setModalRevealMode(false);
  el.modalTiltStage.classList.remove("is-grabbing", "is-tilting");
  el.modalTiltCard.classList.remove("is-rarest-reveal");
  el.modalFlipCard.classList.remove("is-rarest-reveal");
  el.modalFlipCard.classList.remove("reveal-tier-rare", "reveal-tier-holo", "reveal-tier-ultra");
  el.modalFlipCard.classList.remove("is-front-locked");
  el.modalFlipCard.classList.remove("is-first-flip");
  resetRevealSwipeTransform();
  hideNextRevealPreview();
  resetTilt();

  renderGachaPulls({
    pulls: state.gacha.lastPulls,
    packCount: state.gacha.lastPackCount,
    set: { name: state.gacha.revealSetName }
  });

  consumeSelectedGachaPackChoice();
  showGachaDrawReview();
  renderGachaBounceCards(getSelectedGachaPack());

  resetPackRipState();
  updateGachaPackVisual();
}

function advanceGachaReveal() {
  if (!state.gacha.revealing) {
    return;
  }

  if (state.gacha.revealStage === "back") {
    revealCurrentCardFront();
    return;
  }

  if (state.gacha.revealIndex >= state.gacha.revealQueue.length - 1) {
    finishGachaReveal();
    return;
  }

  state.gacha.revealIndex += 1;
  showRevealCard();
}

function skipGachaReveal() {
  if (!state.gacha.revealing) {
    return;
  }

  clearFirstFlipTimer();
  state.gacha.firstFlipAnimating = false;
  el.modalFlipCard.classList.remove("is-first-flip");
  el.gachaStatus.textContent = "Skipped reveal animation. Showing full draw review.";
  finishGachaReveal();
}

function startGachaReveal(payload) {
  clearFirstFlipTimer();
  state.gacha.firstFlipAnimating = false;
  state.gacha.lastPulls = payload.pulls || [];
  state.gacha.lastPackCount = toPositiveInt(payload.packCount, 1);
  const godPackHits = state.gacha.lastPulls.filter((packPull) => packPull.godPack).length;
  if (godPackHits > 0) {
    state.gacha.godPacksOpened += godPackHits;
    saveBinder();
  }
  state.gacha.revealSetName = payload.set?.name || "Set";
  state.gacha.revealQueue = buildGachaRevealQueue(state.gacha.lastPulls);
  state.gacha.rarestPullCardId = getRarestPulledCardId(state.gacha.revealQueue.map((item) => item.card));
  state.gacha.revealIndex = 0;
  state.gacha.flipAllRevealed = true;
  state.gacha.revealing = state.gacha.revealQueue.length > 0;
  state.gacha.pullsAddedToBinder = false;
  hideGachaDrawReview();
  el.modalTiltCard.classList.remove("is-rarest-reveal");
  el.modalFlipCard.classList.remove("is-rarest-reveal");
  el.modalFlipCard.classList.remove("reveal-tier-rare", "reveal-tier-holo", "reveal-tier-ultra");
  el.modalFlipCard.classList.remove("is-front-locked", "is-first-flip");
  hideNextRevealPreview();
  if (el.gachaResult) {
    el.gachaResult.innerHTML = "";
  }

  if (!state.gacha.revealing) {
    el.gachaStatus.textContent = "No cards pulled from this pack.";
    resetPackRipState();
    updateGachaPackVisual();
    return;
  }

  el.gachaStatus.textContent = "Cards are face-up. Swipe each card to reveal the next one.";
  showRevealCard();
  updateGachaPackVisual();
}

async function openGachaPack() {
  if (
    state.gacha.opening ||
    state.gacha.revealing ||
    !state.gacha.selectedSetId ||
    !state.gacha.ripDone
  ) {
    if (!state.gacha.ripDone && !state.gacha.opening && !state.gacha.revealing) {
      el.gachaStatus.textContent = "Trace the dashed line first to open this pack.";
    }
    return;
  }

  state.gacha.opening = true;
  updateGachaPackVisual();
  el.gachaStatus.textContent = "Wrapper opened. Dealing cards...";

  try {
    const response = await fetch("/api/gacha/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        setId: state.gacha.selectedSetId,
        packCount: state.gacha.packCount
      })
    });

    if (!response.ok) {
      let message = "Could not open pack";
      try {
        const payload = await response.json();
        message = payload.details || payload.error || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const payload = await response.json();
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    startGachaReveal(payload);
  } catch (error) {
    el.gachaStatus.textContent = `Failed to open pack. ${error.message}`;
    resetPackRipState();
  } finally {
    state.gacha.opening = false;
    updateGachaPackVisual();
  }
}

function addGachaPullsToBinder() {
  if (state.gacha.revealing) {
    return 0;
  }

  const pulledCards = [];

  for (const packPull of state.gacha.lastPulls) {
    for (const card of packPull.cards || []) {
      pulledCards.push(card);
    }
  }

  if (!pulledCards.length) {
    return 0;
  }

  if (state.gacha.pullsAddedToBinder) {
    return pulledCards.length;
  }

  for (const card of pulledCards) {
    upsertBinderCard(card, 1);
  }

  saveBinder();
  renderCards();
  renderBinder();
  state.gacha.pullsAddedToBinder = true;
  updateAddToBinderButtonState();
  el.gachaStatus.textContent = `${pulledCards.length} pulled cards added to your binder.`;
  return pulledCards.length;
}

function getFilteredBinder() {
  const search = state.binderQuery.search.trim().toLowerCase();
  const conditionFilter = state.binderQuery.condition;

  const filtered = state.binderCollection.cards.filter((card) => {
    const entry = getBinderEntry(card.id);
    const textMatches =
      !search ||
      String(card.name || "").toLowerCase().includes(search) ||
      String(card.set?.name || "").toLowerCase().includes(search) ||
      String(card.number || "").toLowerCase().includes(search) ||
      String(entry?.notes || "").toLowerCase().includes(search);

    const conditionMatches =
      !conditionFilter || (entry && entry.condition === conditionFilter);

    return textMatches && conditionMatches;
  });

  const parseCardNumber = (value) => {
    const raw = String(value || "");
    const numeric = Number.parseInt(raw.match(/\d+/)?.[0] || "0", 10);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  filtered.sort((left, right) => {
    const leftEntry = getBinderEntry(left.id);
    const rightEntry = getBinderEntry(right.id);

    switch (state.binderQuery.sort) {
      case "name_asc":
        return left.name.localeCompare(right.name);
      case "name_desc":
        return right.name.localeCompare(left.name);
      case "value_desc":
        return getCardLastSoldValue(right) - getCardLastSoldValue(left);
      case "updated_desc":
        return (rightEntry?.updatedAt || 0) - (leftEntry?.updatedAt || 0);
      case "date_obtained_desc":
        return (rightEntry?.addedAt || 0) - (leftEntry?.addedAt || 0);
      case "number_asc":
      default:
        return parseCardNumber(left.number) - parseCardNumber(right.number);
    }
  });

  return filtered;
}

function createBinderItem(card, entry) {
  const item = document.createElement("article");
  item.className = "binder-slot";
  item.classList.toggle("is-obtained", Boolean(entry));
  item.classList.toggle("is-unobtained", !entry);

  item.addEventListener("click", (event) => {
    if (event.target.closest("button, input, select, textarea")) {
      return;
    }
    openCardModal(card);
  });

  if (entry && toPositiveInt(entry.ownedQty, 1) > 1) {
    const dupe = document.createElement("span");
    dupe.className = "binder-slot-dupe";
    dupe.textContent = `x${toPositiveInt(entry.ownedQty, 1)}`;
    item.appendChild(dupe);
  }

  const numberBadge = document.createElement("span");
  numberBadge.className = "binder-slot-number";
  numberBadge.textContent = `#${card.number || "?"}`;
  item.appendChild(numberBadge);

  const imageWrap = document.createElement("div");
  imageWrap.className = "binder-slot-image-wrap";

  const image = document.createElement("img");
  image.src = card.images?.small || "";
  image.alt = `${card.name} card`;
  imageWrap.appendChild(image);
  item.appendChild(imageWrap);

  const meta = document.createElement("div");
  meta.className = "binder-slot-meta";

  const title = document.createElement("h4");
  title.textContent = card.name;
  meta.appendChild(title);

  const lineOne = document.createElement("p");
  lineOne.textContent = `${card.set?.name || "Unknown set"} | ${card.rarity || "Unknown rarity"}`;
  meta.appendChild(lineOne);

  const lineTwo = document.createElement("p");
  lineTwo.textContent = entry
    ? `Obtained: ${formatDate(entry.addedAt)} | Condition: ${entry.condition}`
    : "Unobtained slot";
  meta.appendChild(lineTwo);

  const valueLine = document.createElement("p");
  valueLine.className = "binder-slot-value";
  valueLine.textContent = formatLastSoldValue(card);
  meta.appendChild(valueLine);

  const actions = document.createElement("div");
  actions.className = "binder-slot-actions";

  if (entry) {
    const qty = document.createElement("span");
    qty.className = "binder-slot-qty";
    qty.textContent = `Copies owned: ${toPositiveInt(entry.ownedQty, 1)}`;
    actions.appendChild(qty);
    meta.appendChild(actions);
  }

  item.appendChild(meta);

  return item;
}

function renderBinder() {
  const visibleCards = getFilteredBinder();
  el.binderList.innerHTML = "";
  queueCardPriceLookup(visibleCards.slice(0, 140));

  if (state.binderCollection.loading) {
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading collection cards...";
    el.binderList.appendChild(loading);
  } else if (state.binderCollection.error) {
    const error = document.createElement("div");
    error.className = "empty-state";
    error.textContent = state.binderCollection.error;
    el.binderList.appendChild(error);
  } else if (!state.binderCollection.cards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No cards found for this collection preset.";
    el.binderList.appendChild(empty);
  } else if (!visibleCards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No cards match your binder filters.";
    el.binderList.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const card of visibleCards) {
      const entry = getBinderEntry(card.id);
      fragment.appendChild(createBinderItem(card, entry));
    }
    el.binderList.appendChild(fragment);
  }

  const ownedInCollection = state.binderCollection.cards.filter((card) => getBinderEntry(card.id)).length;
  const totalSlots = state.binderCollection.cards.length;
  const totalCopies = state.binder.reduce(
    (sum, entry) => sum + toPositiveInt(entry.ownedQty, 1),
    0
  );
  const active = getActiveBinderRecord();
  el.binderStats.textContent = `${ownedInCollection} / ${totalSlots} obtained | ${totalCopies} total copies${active ? ` | ${active.name}` : ""}`;

  renderDashboard();
}

function removeBinderEntry(cardId) {
  state.binder = state.binder.filter((entry) => entry.id !== cardId);
  saveBinder();
  renderCards();
  renderBinder();
}

function updateBinderQuantity(cardId, nextQty) {
  const qty = Number.parseInt(nextQty, 10);
  if (Number.isNaN(qty) || qty <= 0) {
    removeBinderEntry(cardId);
    return;
  }

  const entry = getBinderEntry(cardId);
  if (!entry) {
    return;
  }

  entry.ownedQty = Math.min(99, qty);
  entry.updatedAt = Date.now();
  saveBinder();
  renderCards();
  renderBinder();
}

function updateBinderCondition(cardId, condition) {
  const entry = getBinderEntry(cardId);
  if (!entry || !isValidCondition(condition)) {
    return;
  }

  entry.condition = condition;
  entry.updatedAt = Date.now();
  saveBinder();
  renderBinder();
}

function updateBinderNotes(cardId, notes) {
  const entry = getBinderEntry(cardId);
  if (!entry) {
    return;
  }

  entry.notes = String(notes || "").trim();
  entry.updatedAt = Date.now();
  saveBinder();
}

/* legacy binder list renderer removed */

async function refreshCards() {
  el.resultMeta.textContent = "Loading cards...";

  try {
    await fetchCards();
    renderCards();
  } catch (error) {
    el.cardGrid.innerHTML = "";
    const warning = document.createElement("div");
    warning.className = "empty-state";
    warning.textContent = `Unable to load cards right now. ${error.message}`;
    el.cardGrid.appendChild(warning);
    el.resultMeta.textContent = "Failed to load cards";
  }
}

function attachEvents() {
  let searchTimer = null;

  for (const link of sidebarLinks) {
    link.addEventListener("click", () => {
      const targetView = link.dataset.view;
      const title = link.dataset.title;
      const subtitle = link.dataset.subtitle;
      setActiveView(targetView, title, subtitle, link);
    });
  }

  el.cardModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-modal")) {
      if (state.gacha.revealing) {
        el.gachaStatus.textContent =
          state.gacha.revealStage === "back"
            ? "Tap card to flip all first."
            : "Swipe the card away to reveal the next one.";
        return;
      }

      closeCardModal();
    }
  });

  el.gachaPopout.addEventListener("click", (event) => {
    if (!event.target.hasAttribute("data-close-gacha-popout")) {
      return;
    }

    closeGachaPopout();
  });

  if (el.gachaPopoutPanel) {
    el.gachaPopoutPanel.addEventListener("pointerdown", (event) => {
      if (!state.gacha.popoutOpen || !state.gacha.selectedPackChoiceId) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (el.gachaPackCard.contains(target)) {
        return;
      }

      if (el.gachaDrawReview?.contains(target)) {
        return;
      }

      closeSelectedGachaPackChoice();
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (!state.gacha.popoutOpen || !state.gacha.infoVisible) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (el.gachaPopoutInfo?.contains(target) || el.gachaInfoToggleBtn?.contains(target)) {
      return;
    }

    hideGachaInfoPanel();
  });

  if (el.gachaInfoToggleBtn) {
    el.gachaInfoToggleBtn.addEventListener("click", () => {
      state.gacha.infoVisible = !state.gacha.infoVisible;
      updateGachaInfoVisibility();
    });
  }

  if (el.gachaCloseReviewBtn) {
    el.gachaCloseReviewBtn.addEventListener("click", () => {
      hideGachaDrawReview();
    });
  }

  if (el.gachaAddToBinderBtn) {
    el.gachaAddToBinderBtn.addEventListener("click", () => {
      const addedCount = addGachaPullsToBinder();
      if (addedCount) {
        el.gachaStatus.textContent = `${addedCount} pulled cards added to your binder.`;
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCardModal();
    }
  });

  el.modalTiltStage.addEventListener("pointerdown", startTilt);
  el.modalTiltStage.addEventListener("pointermove", moveTilt);
  el.modalTiltStage.addEventListener("pointerup", endTilt);
  el.modalTiltStage.addEventListener("pointercancel", endTilt);
  el.modalFlipCard.addEventListener("transitionend", (event) => {
    if (
      event.propertyName !== "transform" ||
      !state.gacha.firstFlipAnimating ||
      state.gacha.revealIndex !== 0 ||
      !state.gacha.revealing
    ) {
      return;
    }

    clearFirstFlipTimer();
    state.gacha.firstFlipAnimating = false;
    el.modalFlipCard.classList.remove("is-first-flip");
    updateNextRevealPreview();
  });
  el.modalFlipCard.addEventListener("click", () => {
    if (state.gacha.revealing && state.gacha.revealStage === "back") {
      revealCurrentCardFront();
    }
  });
  if (el.modalRevealSkipBtn) {
    el.modalRevealSkipBtn.addEventListener("click", () => {
      skipGachaReveal();
    });
  }
  el.modalTiltStage.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  el.modalTiltStage.addEventListener("dblclick", () => {
    endTilt();
    resetTilt();
  });

  el.searchInput.addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query.search = event.target.value;
      state.page = 1;
      refreshCards();
    }, 300);
  });

  el.setFilter.addEventListener("change", (event) => {
    state.query.setId = event.target.value;
    state.page = 1;
    refreshCards();
  });

  el.sortSelect.addEventListener("change", (event) => {
    state.query.sort = event.target.value;
    state.page = 1;
    refreshCards();
  });

  el.prevPage.addEventListener("click", () => {
    if (state.page <= 1) {
      return;
    }

    state.page -= 1;
    refreshCards();
  });

  el.nextPage.addEventListener("click", () => {
    const totalPages = Math.max(Math.ceil(state.totalCount / state.pageSize), 1);
    if (state.page >= totalPages) {
      return;
    }

    state.page += 1;
    refreshCards();
  });

  if (el.trainerAvatarBtn && el.trainerAvatarInput) {
    el.trainerAvatarBtn.addEventListener("click", () => {
      el.trainerAvatarInput.click();
    });
  }

  if (el.trainerAvatarInput) {
    el.trainerAvatarInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.profile.avatar = String(reader.result || "");
        saveBinder();
        renderDashboard();
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    });
  }

  if (el.trainerIgn) {
    el.trainerIgn.addEventListener("input", (event) => {
      state.profile.ign = String(event.target.value || "").slice(0, 30);
      saveBinder();
      renderDashboard();
    });
  }

  if (el.binderPicker) {
    el.binderPicker.addEventListener("change", (event) => {
      setActiveBinder(event.target.value);
      saveBinder();
      renderBinderPicker();
      renderBinder();
    });
  }

  if (el.addBinderBtn) {
    el.addBinderBtn.addEventListener("click", () => {
      addNewBinder();
    });
  }

  if (el.renameBinderBtn) {
    el.renameBinderBtn.addEventListener("click", () => {
      renameActiveBinder();
    });
  }

  if (el.deleteBinderBtn) {
    el.deleteBinderBtn.addEventListener("click", () => {
      deleteActiveBinder();
    });
  }

  if (el.binderCollectionPreset) {
    el.binderCollectionPreset.addEventListener("change", (event) => {
      state.binderCollection.preset = event.target.value;
      renderCollectionSetOptions();
      void loadBinderCollectionCards();
    });
  }

  if (el.binderCollectionSet) {
    el.binderCollectionSet.addEventListener("change", (event) => {
      state.binderCollection.setId = event.target.value;
      void loadBinderCollectionCards();
    });
  }

  el.binderSearch.addEventListener("input", (event) => {
    state.binderQuery.search = event.target.value;
    renderBinder();
  });

  el.binderSort.addEventListener("change", (event) => {
    state.binderQuery.sort = event.target.value;
    renderBinder();
  });

  el.binderCondition.addEventListener("change", (event) => {
    state.binderQuery.condition = event.target.value;
    renderBinder();
  });

  el.gachaCutLayer.addEventListener("pointerdown", beginPackRip);
  el.gachaCutLayer.addEventListener("pointermove", movePackRip);
  el.gachaCutLayer.addEventListener("pointerup", endPackRip);
  el.gachaCutLayer.addEventListener("pointercancel", endPackRip);
  el.gachaCutLayer.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  el.gachaCutLayer.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  el.gachaPackArt.addEventListener("load", () => {
    updatePackAspectRatioFromImage();
    updateCutGuidePath();
  });
  window.addEventListener("resize", () => {
    syncCutSvgToPack();
    updateCutGuidePath();
  });

  el.gachaPackCard.addEventListener("click", () => {
    hideGachaInfoPanel();
    if (!state.gacha.ripDone && !state.gacha.opening && !state.gacha.revealing) {
      if (!state.gacha.showCutGuide) {
        setCutGuideVisibility(true);
        el.gachaStatus.textContent = "Guide ready. Trace the dashed line to open the pack.";
        return;
      }

      el.gachaStatus.textContent = "Trace the dashed cut path to open the pack.";
    }
  });

  el.clearBinder.addEventListener("click", () => {
    if (!state.binder.length) {
      return;
    }

    if (!window.confirm("Clear all cards from the active binder?")) {
      return;
    }

    state.binder = [];
    saveBinder();
    renderCards();
    renderBinder();
  });
}

async function initialize() {
  loadBinderState();
  state.gacha.packCount = 1;
  attachEvents();
  updateGachaInfoVisibility();
  hideGachaDrawReview();
  updateAddToBinderButtonState();
  updateGachaBounceLabel();
  renderBinderPicker();
  renderDashboard();

  if (el.binderCollectionPreset) {
    el.binderCollectionPreset.value = state.binderCollection.preset;
  }

  const defaultLink =
    sidebarLinks.find((link) => link.classList.contains("is-active")) ||
    sidebarLinks[0] ||
    null;
  if (defaultLink) {
    setActiveView(
      defaultLink.dataset.view,
      defaultLink.dataset.title,
      defaultLink.dataset.subtitle,
      defaultLink
    );
  }

  try {
    await fetchSets();
    renderSetFilter();
    if (state.binderCollection.preset === "all_set" && !state.binderCollection.setId && state.sets[0]) {
      state.binderCollection.setId = state.sets[0].id;
    }
  } catch {
    const fallbackOption = document.createElement("option");
    fallbackOption.value = "";
    fallbackOption.textContent = "Sets unavailable";
    el.setFilter.appendChild(fallbackOption);
  }

  if (el.binderCollectionPreset) {
    el.binderCollectionPreset.value = state.binderCollection.preset;
  }
  renderCollectionSetOptions();
  void loadBinderCollectionCards();

  try {
    await fetchGachaPacks();
    renderGachaSetOptions();
  } catch {
    state.gacha.packs = [];
    renderGachaSetOptions();
    el.gachaStatus.textContent =
      "Could not load pack list. Check your data source and try again.";
  }

  await refreshCards();
  renderBinder();
}

initialize();
