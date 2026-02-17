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
    lastPulls: []
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
  binderSearch: document.getElementById("binderSearch"),
  binderSort: document.getElementById("binderSort"),
  binderCondition: document.getElementById("binderCondition"),
  clearBinder: document.getElementById("clearBinder"),
  binderList: document.getElementById("binderList"),
  gachaSetSelect: document.getElementById("gachaSetSelect"),
  gachaPackCount: document.getElementById("gachaPackCount"),
  openPackBtn: document.getElementById("openPackBtn"),
  addPullsBtn: document.getElementById("addPullsBtn"),
  gachaPackCard: document.getElementById("gachaPackCard"),
  gachaPackSeries: document.getElementById("gachaPackSeries"),
  gachaPackLogo: document.getElementById("gachaPackLogo"),
  gachaPackName: document.getElementById("gachaPackName"),
  gachaStatus: document.getElementById("gachaStatus"),
  gachaResult: document.getElementById("gachaResult"),
  emptyStateTemplate: document.getElementById("emptyStateTemplate"),
  cardModal: document.getElementById("cardModal"),
  modalCardImage: document.getElementById("modalCardImage"),
  modalTiltStage: document.getElementById("modalTiltStage"),
  modalTiltCard: document.getElementById("modalTiltCard")
};

const tiltState = {
  isDragging: false,
  pointerId: null
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

function getBinderQuantity(cardId) {
  const entry = getBinderEntry(cardId);
  return entry ? toPositiveInt(entry.ownedQty, 1) : 0;
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

function resetTilt() {
  el.modalTiltCard.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  el.modalTiltCard.style.setProperty("--shine-x", "50%");
  el.modalTiltCard.style.setProperty("--shine-y", "50%");
  el.modalTiltCard.style.setProperty("--shine-strength", "0.24");
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
  tiltState.pointerId = event.pointerId;

  el.modalTiltStage.classList.add("is-grabbing");
  el.modalTiltCard.classList.add("is-dragging");

  if (el.modalTiltStage.setPointerCapture) {
    el.modalTiltStage.setPointerCapture(event.pointerId);
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
}

function openCardModal(card) {
  el.modalCardImage.src = card.images?.large || card.images?.small || "";
  el.modalCardImage.alt = `${card.name} card enlarged`;

  el.cardModal.classList.add("is-open");
  el.cardModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  resetTilt();
}

function closeCardModal() {
  if (!el.cardModal.classList.contains("is-open")) {
    return;
  }

  endTilt();
  el.cardModal.classList.remove("is-open");
  el.cardModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
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

function addCardToBinder(card) {
  upsertBinderCard(card, 1);
  saveBinder();
  renderCards();
  renderBinder();
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

  const currentQty = getBinderQuantity(card.id);
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent =
    currentQty > 0
      ? `Add to Binder (+1, have ${currentQty})`
      : "Add to Binder";
  addBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    addCardToBinder(card);
  });
  article.appendChild(addBtn);

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
    el.openPackBtn.disabled = true;
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
  updateGachaPackVisual();
}

function getSelectedGachaPack() {
  return (
    state.gacha.packs.find((pack) => pack.id === state.gacha.selectedSetId) || null
  );
}

function updateGachaPackVisual() {
  const selectedPack = getSelectedGachaPack();
  if (!selectedPack) {
    el.gachaPackSeries.textContent = "No Set";
    el.gachaPackName.textContent = "No pack selected";
    el.gachaPackLogo.style.display = "none";
    el.gachaPackCard.style.setProperty("--pack-from", "#4f46e5");
    el.gachaPackCard.style.setProperty("--pack-to", "#ef4444");
    el.openPackBtn.disabled = true;
    el.gachaPackCard.disabled = true;
    return;
  }

  const fromColor = selectedPack.visual?.gradientFrom || colorFromSetId(selectedPack.id);
  const toColor = selectedPack.visual?.gradientTo || colorFromSetId(selectedPack.id, 62);

  el.gachaPackCard.style.setProperty("--pack-from", fromColor);
  el.gachaPackCard.style.setProperty("--pack-to", toColor);
  el.gachaPackSeries.textContent = selectedPack.series || "Pokemon TCG";
  el.gachaPackName.textContent = selectedPack.name;

  if (selectedPack.visual?.logo) {
    el.gachaPackLogo.src = selectedPack.visual.logo;
    el.gachaPackLogo.style.display = "block";
  } else {
    el.gachaPackLogo.removeAttribute("src");
    el.gachaPackLogo.style.display = "none";
  }

  const hasSet = Boolean(state.gacha.selectedSetId);
  el.openPackBtn.disabled = !hasSet;
  el.gachaPackCard.disabled = !hasSet;
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
    el.gachaStatus.textContent = `Pulled ${allCards.length} cards from ${response.packCount} pack(s).`;
  }
}

async function openGachaPack() {
  if (state.gacha.opening || !state.gacha.selectedSetId) {
    return;
  }

  state.gacha.opening = true;
  el.openPackBtn.disabled = true;
  el.gachaPackCard.disabled = true;
  el.gachaPackCard.classList.add("is-opening");
  el.gachaStatus.textContent = "Ripping pack...";

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
    renderGachaPulls(payload);
  } catch (error) {
    el.gachaStatus.textContent = `Failed to open pack. ${error.message}`;
  } finally {
    window.setTimeout(() => {
      el.gachaPackCard.classList.remove("is-opening");
      state.gacha.opening = false;
      updateGachaPackVisual();
    }, 940);
  }
}

function addGachaPullsToBinder() {
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

  el.cardModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-modal")) {
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
    updateGachaPackVisual();
  });

  el.gachaPackCount.addEventListener("change", (event) => {
    state.gacha.packCount = toPositiveInt(event.target.value, 1);
  });

  el.openPackBtn.addEventListener("click", () => {
    openGachaPack();
  });

  el.gachaPackCard.addEventListener("click", () => {
    openGachaPack();
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
