const STORAGE_KEY_BINDER = "myPokemonBinder";
const LEGACY_STORAGE_KEY_DECK = "myPokemonDeck";
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
  binder: [],
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
    sort: "updated_desc",
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
    ripActive: false,
    ripDone: false,
    ripPointerId: null,
    cutGuidePoints: [],
    ripAligned: false,
    ripMinX: 0,
    ripMaxX: 0,
    ripPoints: [],
    ripStartX: 0,
    ripStartY: 0,
    ripDistance: 0
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
  binderSearch: document.getElementById("binderSearch"),
  binderSort: document.getElementById("binderSort"),
  binderCondition: document.getElementById("binderCondition"),
  clearBinder: document.getElementById("clearBinder"),
  binderList: document.getElementById("binderList"),
  gachaSetSelect: document.getElementById("gachaSetSelect"),
  gachaPackCount: document.getElementById("gachaPackCount"),
  addPullsBtn: document.getElementById("addPullsBtn"),
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
  gachaResult: document.getElementById("gachaResult"),
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
  modalRevealRarity: document.getElementById("modalRevealRarity")
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
  }

  return [...byId.values()];
}

function loadBinder() {
  try {
    const binderRaw = localStorage.getItem(STORAGE_KEY_BINDER);
    if (binderRaw) {
      return normalizeBinderEntries(JSON.parse(binderRaw));
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_DECK);
    if (!legacyRaw) {
      return [];
    }

    return normalizeBinderEntries(JSON.parse(legacyRaw));
  } catch {
    return [];
  }
}

function saveBinder() {
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
  el.modalFlipCard.style.setProperty("--swipe-x", "0px");
  el.modalFlipCard.style.setProperty("--swipe-r", "0deg");

  if (useSnap) {
    window.requestAnimationFrame(() => {
      el.modalFlipCard.classList.remove("is-snap");
    });
  }
}

function applyRevealSwipeTransform(deltaX) {
  const clampedX = Math.max(Math.min(deltaX, 240), -240);
  const rotation = clampedX * 0.055;

  el.modalFlipCard.classList.add("is-swipe-dragging");
  el.modalTiltCard.classList.add("is-swipe-active");
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

  window.setTimeout(() => {
    resetRevealSwipeTransform();
    advanceGachaReveal();
  }, 220);
}

function hideNextRevealPreview() {
  el.modalNextCard.hidden = true;
  el.modalNextCardImage.removeAttribute("src");
  el.modalNextCard.classList.remove("is-back");
}

function updateNextRevealPreview() {
  const nextItem = state.gacha.revealQueue[state.gacha.revealIndex + 1];

  if (!state.gacha.revealing || !nextItem || !state.gacha.flipAllRevealed) {
    hideNextRevealPreview();
    return;
  }

  el.modalNextCard.hidden = false;
  el.modalNextCard.classList.remove("is-back");
  el.modalNextCardImage.src = nextItem.card.images?.large || nextItem.card.images?.small || "";
  el.modalNextCardImage.alt = `${nextItem.card.name} next card`;
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

function renderSetFilter() {
  const fragment = document.createDocumentFragment();

  for (const set of state.sets) {
    const option = document.createElement("option");
    option.value = set.id;
    option.textContent = `${set.name} (${set.series || "Unknown series"})`;
    fragment.appendChild(option);
  }

  el.setFilter.appendChild(fragment);
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
  el.gachaSetSelect.innerHTML = "";

  if (!state.gacha.packs.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No sets available";
    el.gachaSetSelect.appendChild(option);
    state.gacha.selectedSetId = "";
    el.gachaPackCard.disabled = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const pack of state.gacha.packs) {
    const option = document.createElement("option");
    option.value = pack.id;
    option.textContent = `${pack.name} (${pack.series || "Series"})`;
    fragment.appendChild(option);
  }

  el.gachaSetSelect.appendChild(fragment);

  if (!state.gacha.selectedSetId) {
    state.gacha.selectedSetId = state.gacha.packs[0].id;
  }

  el.gachaSetSelect.value = state.gacha.selectedSetId;
  resetPackRipState();
  updateGachaPackVisual();
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
    { x: width * 0.1, y: guideY },
    { x: width * 0.9, y: guideY }
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
  el.gachaSetSelect.disabled = isBusy;
  el.gachaPackCount.disabled = isBusy;
  if (!selectedPack) {
    el.gachaPackSeries.textContent = "No Set";
    el.gachaPackName.textContent = "No pack selected";
    el.gachaPackArt.style.display = "none";
    el.gachaPackLogo.style.display = "none";
    el.gachaPackCard.style.setProperty("--pack-from", "#4f46e5");
    el.gachaPackCard.style.setProperty("--pack-to", "#ef4444");
    el.gachaPackCard.style.setProperty("--pack-aspect", "0.73");
    el.gachaPackCard.classList.remove("has-pack-art");
    el.gachaPackCard.disabled = true;
    syncCutSvgToPack();
    updateCutGuidePath();
    return;
  }

  const fromColor = selectedPack.visual?.gradientFrom || colorFromSetId(selectedPack.id);
  const toColor = selectedPack.visual?.gradientTo || colorFromSetId(selectedPack.id, 62);

  el.gachaPackCard.style.setProperty("--pack-from", fromColor);
  el.gachaPackCard.style.setProperty("--pack-to", toColor);
  el.gachaPackSeries.textContent = selectedPack.series || "Pokemon TCG";
  el.gachaPackName.textContent = selectedPack.name;

  if (selectedPack.visual?.boosterArt) {
    if (el.gachaPackArt.src !== selectedPack.visual.boosterArt) {
      el.gachaPackArt.src = selectedPack.visual.boosterArt;
    }
    el.gachaPackArt.style.display = "block";
    el.gachaPackCard.classList.add("has-pack-art");
    if (el.gachaPackArt.complete) {
      updatePackAspectRatioFromImage();
    }
  } else {
    el.gachaPackArt.removeAttribute("src");
    el.gachaPackArt.style.display = "none";
    el.gachaPackCard.classList.remove("has-pack-art");
    el.gachaPackCard.style.setProperty("--pack-aspect", "0.73");
    syncCutSvgToPack();
  }

  if (!selectedPack.visual?.boosterArt && selectedPack.visual?.logo) {
    el.gachaPackLogo.src = selectedPack.visual.logo;
    el.gachaPackLogo.style.display = "block";
  } else {
    el.gachaPackLogo.removeAttribute("src");
    el.gachaPackLogo.style.display = "none";
  }

  const hasSet = Boolean(state.gacha.selectedSetId);
  el.gachaPackCard.disabled = !hasSet || isBusy;

  syncCutSvgToPack();
  updateCutGuidePath();

  if (!state.gacha.ripDone && !isBusy) {
    el.gachaStatus.textContent = "Trace the dashed line to open this pack.";
  }
}

function resetPackRipState() {
  state.gacha.ripActive = false;
  state.gacha.ripDone = false;
  state.gacha.ripPointerId = null;
  state.gacha.ripAligned = false;
  state.gacha.ripDistance = 0;
  state.gacha.ripMinX = 0;
  state.gacha.ripMaxX = 0;
  state.gacha.ripPoints = [];
  state.gacha.ripStartX = 0;
  state.gacha.ripStartY = 0;

  el.gachaPackCard.classList.remove("is-cutting", "is-cut", "is-ripped", "is-rip-aligned");
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
    !state.gacha.selectedSetId
  ) {
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

function createGachaCardElement(card) {
  const container = document.createElement("article");
  container.className = "gacha-card";

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
  rarity.textContent = card.rarity || "Unknown rarity";
  container.appendChild(rarity);

  return container;
}

function renderGachaPulls(response) {
  state.gacha.lastPulls = response.pulls || [];
  state.gacha.lastPackCount = toPositiveInt(response.packCount, 1);
  el.gachaResult.innerHTML = "";

  const allCards = [];

  for (const packPull of state.gacha.lastPulls) {
    const section = document.createElement("section");
    section.className = "gacha-pack-result";

    const title = document.createElement("h3");
    title.textContent = `Pack ${packPull.packNumber} - ${response.set?.name || "Set"}`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "gacha-cards-grid";
    for (const card of packPull.cards || []) {
      grid.appendChild(createGachaCardElement(card));
      allCards.push(card);
    }

    section.appendChild(grid);
    el.gachaResult.appendChild(section);
  }

  el.addPullsBtn.disabled = !allCards.length;
  if (allCards.length) {
    el.gachaStatus.textContent = `Pulled ${allCards.length} cards from ${state.gacha.lastPackCount} pack(s).`;
  }
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

  const showBackFace = state.gacha.revealIndex === 0 && !state.gacha.flipAllRevealed;
  state.gacha.revealStage = showBackFace ? "back" : "front";

  setModalCardFace(item.card, showBackFace);
  if (showBackFace) {
    el.modalFlipCard.classList.remove("is-front-locked");
  } else {
    el.modalFlipCard.classList.add("is-front-locked");
  }
  resetRevealSwipeTransform();
  updateNextRevealPreview();

  el.modalRevealCounter.textContent = `Pack ${item.packNumber} • ${item.slotIndex}/${item.totalInPack}`;

  if (showBackFace) {
    el.modalRevealRarity.textContent = "Hidden";
    el.modalRevealRarity.style.background = "linear-gradient(140deg, #334155, #475569)";
    el.modalRevealRarity.style.borderColor = "rgba(255, 255, 255, 0.4)";
    el.gachaStatus.textContent = "Tap this back card once to reveal all cards front-side.";
  } else {
    const accent = rarityAccent(item.card.rarity);
    el.modalRevealRarity.textContent = item.card.rarity || "Unknown rarity";
    el.modalRevealRarity.style.background = accent.background;
    el.modalRevealRarity.style.borderColor = accent.border;
    el.gachaStatus.textContent = "Swipe this card away to reveal the next card.";
  }

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
  el.modalFlipCard.classList.add("is-revealed");
  el.modalFlipCard.classList.add("is-front-locked");
  updateNextRevealPreview();

  const accent = rarityAccent(item.card.rarity);
  el.modalRevealRarity.textContent = item.card.rarity || "Unknown rarity";
  el.modalRevealRarity.style.background = accent.background;
  el.modalRevealRarity.style.borderColor = accent.border;
  el.gachaStatus.textContent = "Great. Now swipe cards away for each next reveal.";
}

function finishGachaReveal() {
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
  el.modalFlipCard.classList.remove("is-front-locked");
  resetRevealSwipeTransform();
  hideNextRevealPreview();
  resetTilt();

  renderGachaPulls({
    pulls: state.gacha.lastPulls,
    packCount: state.gacha.lastPackCount,
    set: { name: state.gacha.revealSetName }
  });

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

function startGachaReveal(payload) {
  state.gacha.lastPulls = payload.pulls || [];
  state.gacha.lastPackCount = toPositiveInt(payload.packCount, 1);
  state.gacha.revealSetName = payload.set?.name || "Set";
  state.gacha.revealQueue = buildGachaRevealQueue(state.gacha.lastPulls);
  state.gacha.revealIndex = 0;
  state.gacha.flipAllRevealed = false;
  state.gacha.revealing = state.gacha.revealQueue.length > 0;
  el.modalFlipCard.classList.remove("is-front-locked");
  hideNextRevealPreview();
  el.addPullsBtn.disabled = true;
  el.gachaResult.innerHTML = "";

  if (!state.gacha.revealing) {
    el.gachaStatus.textContent = "No cards pulled from this pack.";
    resetPackRipState();
    updateGachaPackVisual();
    return;
  }

  el.gachaStatus.textContent =
    "You will see one back card first. Tap once, then swipe cards with next card visible behind.";
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
  el.addPullsBtn.disabled = true;

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
    return;
  }

  const pulledCards = [];

  for (const packPull of state.gacha.lastPulls) {
    for (const card of packPull.cards || []) {
      pulledCards.push(card);
    }
  }

  if (!pulledCards.length) {
    return;
  }

  for (const card of pulledCards) {
    upsertBinderCard(card, 1);
  }

  saveBinder();
  renderCards();
  renderBinder();
  el.gachaStatus.textContent = `${pulledCards.length} pulled cards added to your binder.`;
}

function getFilteredBinder() {
  const search = state.binderQuery.search.trim().toLowerCase();
  const conditionFilter = state.binderQuery.condition;

  const filtered = state.binder.filter((entry) => {
    const textMatches =
      !search ||
      entry.name.toLowerCase().includes(search) ||
      (entry.set?.name || "").toLowerCase().includes(search) ||
      (entry.notes || "").toLowerCase().includes(search);

    const conditionMatches =
      !conditionFilter || entry.condition === conditionFilter;

    return textMatches && conditionMatches;
  });

  filtered.sort((left, right) => {
    switch (state.binderQuery.sort) {
      case "updated_asc":
        return (left.updatedAt || 0) - (right.updatedAt || 0);
      case "name_asc":
        return left.name.localeCompare(right.name);
      case "name_desc":
        return right.name.localeCompare(left.name);
      case "qty_desc":
        return toPositiveInt(right.ownedQty, 1) - toPositiveInt(left.ownedQty, 1);
      case "set_asc":
        return (left.set?.name || "").localeCompare(right.set?.name || "");
      case "updated_desc":
      default:
        return (right.updatedAt || 0) - (left.updatedAt || 0);
    }
  });

  return filtered;
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

function createBinderItem(entry) {
  const item = document.createElement("article");
  item.className = "binder-item";

  item.addEventListener("click", (event) => {
    if (event.target.closest("button, input, select, textarea")) {
      return;
    }
    openCardModal(entry);
  });

  const image = document.createElement("img");
  image.src = entry.images?.small || "";
  image.alt = `${entry.name} card`;
  item.appendChild(image);

  const main = document.createElement("div");
  main.className = "binder-main";

  const title = document.createElement("h4");
  title.textContent = entry.name;
  main.appendChild(title);

  const lineOne = document.createElement("p");
  lineOne.textContent = `${entry.set?.name || "Unknown pack"} | #${entry.number || "?"} | ${entry.rarity || "Unknown rarity"}`;
  main.appendChild(lineOne);

  const lineTwo = document.createElement("p");
  lineTwo.textContent = `Owned: ${toPositiveInt(entry.ownedQty, 1)} | Condition: ${entry.condition}`;
  main.appendChild(lineTwo);

  const lineThree = document.createElement("p");
  lineThree.textContent = `From: ${formatPack(entry)}`;
  main.appendChild(lineThree);

  const actions = document.createElement("div");
  actions.className = "binder-actions";

  const qtyControl = document.createElement("div");
  qtyControl.className = "qty-control";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.textContent = "-";
  minusBtn.addEventListener("click", () => {
    updateBinderQuantity(entry.id, toPositiveInt(entry.ownedQty, 1) - 1);
  });
  qtyControl.appendChild(minusBtn);

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.max = "99";
  qtyInput.value = String(toPositiveInt(entry.ownedQty, 1));
  qtyInput.addEventListener("change", () => {
    updateBinderQuantity(entry.id, qtyInput.value);
  });
  qtyControl.appendChild(qtyInput);

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.textContent = "+";
  plusBtn.addEventListener("click", () => {
    updateBinderQuantity(entry.id, toPositiveInt(entry.ownedQty, 1) + 1);
  });
  qtyControl.appendChild(plusBtn);

  actions.appendChild(qtyControl);

  const conditionSelect = document.createElement("select");
  conditionSelect.className = "condition-select";
  for (const optionLabel of CONDITION_OPTIONS) {
    const option = document.createElement("option");
    option.value = optionLabel;
    option.textContent = optionLabel;
    if (optionLabel === entry.condition) {
      option.selected = true;
    }
    conditionSelect.appendChild(option);
  }

  conditionSelect.addEventListener("change", () => {
    updateBinderCondition(entry.id, conditionSelect.value);
  });

  actions.appendChild(conditionSelect);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-btn";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    removeBinderEntry(entry.id);
  });
  actions.appendChild(removeButton);

  main.appendChild(actions);

  const notes = document.createElement("textarea");
  notes.className = "binder-notes";
  notes.placeholder = "Notes (binder slot, trade status, grading plans...)";
  notes.value = entry.notes || "";
  notes.addEventListener("change", () => {
    updateBinderNotes(entry.id, notes.value);
    renderBinder();
  });
  notes.addEventListener("blur", () => {
    updateBinderNotes(entry.id, notes.value);
  });
  main.appendChild(notes);

  item.appendChild(main);
  return item;
}

function renderBinder() {
  const visibleEntries = getFilteredBinder();
  el.binderList.innerHTML = "";

  if (!visibleEntries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const message = document.createElement("p");
    message.textContent =
      "Your binder is empty for this filter. Add cards from Card Finder.";
    empty.appendChild(message);
    el.binderList.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const entry of visibleEntries) {
      fragment.appendChild(createBinderItem(entry));
    }
    el.binderList.appendChild(fragment);
  }

  const totalCopies = state.binder.reduce(
    (sum, entry) => sum + toPositiveInt(entry.ownedQty, 1),
    0
  );
  el.binderStats.textContent = `${state.binder.length} unique | ${totalCopies} total cards`;
}

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCardModal();
    }
  });

  el.modalTiltStage.addEventListener("pointerdown", startTilt);
  el.modalTiltStage.addEventListener("pointermove", moveTilt);
  el.modalTiltStage.addEventListener("pointerup", endTilt);
  el.modalTiltStage.addEventListener("pointercancel", endTilt);
  el.modalFlipCard.addEventListener("click", () => {
    if (state.gacha.revealing && state.gacha.revealStage === "back") {
      revealCurrentCardFront();
    }
  });
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

  el.gachaSetSelect.addEventListener("change", (event) => {
    state.gacha.selectedSetId = event.target.value;
    resetPackRipState();
    updateGachaPackVisual();
  });

  el.gachaPackCount.addEventListener("change", (event) => {
    state.gacha.packCount = toPositiveInt(event.target.value, 1);
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
    if (!state.gacha.ripDone && !state.gacha.opening && !state.gacha.revealing) {
      el.gachaStatus.textContent = "Trace the dashed cut path to open the pack.";
    }
  });

  el.addPullsBtn.addEventListener("click", () => {
    addGachaPullsToBinder();
  });

  el.clearBinder.addEventListener("click", () => {
    if (!state.binder.length) {
      return;
    }

    if (!window.confirm("Clear your entire binder collection?")) {
      return;
    }

    state.binder = [];
    saveBinder();
    renderCards();
    renderBinder();
  });
}

async function initialize() {
  state.binder = loadBinder();
  state.gacha.packCount = toPositiveInt(el.gachaPackCount.value, 1);
  attachEvents();

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
  } catch {
    const fallbackOption = document.createElement("option");
    fallbackOption.value = "";
    fallbackOption.textContent = "Sets unavailable";
    el.setFilter.appendChild(fallbackOption);
  }

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
