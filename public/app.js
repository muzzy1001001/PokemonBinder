const STORAGE_KEY_BINDER = "myPokemonBinder";
const STORAGE_KEY_BINDER_STATE = "pokemonBinderStateV2";
const LEGACY_STORAGE_KEY_DECK = "myPokemonDeck";
const STORAGE_KEY_POKEAPI_SPECIES = "pokemonSpeciesDexCacheV1";
const STORAGE_KEY_SPECIAL_TRAINER_RESET = "pokemonTrainerResetOnceV2";
const STORAGE_KEY_PLAYER_DATA_WIPE_VERSION = "pokemonPlayerDataWipeVersion";
const PLAYER_DATA_WIPE_VERSION = "2026-02-21-full-reset";
const PLAYER_STATE_API_PATH = "/api/player-state";
const AUTH_API_BASE_PATH = "/api/auth";
const STORAGE_KEY_AUTH_TOKEN = "deckAuthTokenV1";
const STORAGE_KEY_AUTH_USER = "deckAuthUserV1";
const CLOUD_SAVE_DEBOUNCE_MS = 900;
const DEFAULT_BINDER_NAME = "Main Binder";
const COLLECTION_PRESET_OPTIONS = ["all_set", "pokemon_151", "mega"];
const POKEDEX_SORT_OPTIONS = [
  "generation_asc",
  "generation_desc",
  "name_asc",
  "name_desc",
  "rarity_desc",
  "rarity_asc",
  "owned_first",
  "missing_first",
  "set_newest",
  "set_oldest"
];
const POKEDEX_OWNERSHIP_FILTER_OPTIONS = ["all", "owned", "missing"];
const MAX_SHOWCASE_BADGES = 8;
const MAX_FRIENDS = 60;
const FULL_COLLECTION_TRAINER_UID = "PK-3610-2243";
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
    avatar: "",
    uid: "",
    favoriteCardIds: [],
    wishlistCardIds: [],
    badgeShowcaseIds: [],
    friends: []
  },
  collectionGoals: [],
  goalProgressCache: new Map(),
  goalOpenIds: [],
  inventory: {
    search: "",
    sort: "qty_desc",
    rarity: ""
  },
  binderCollection: {
    preset: "all_set",
    setId: "",
    cards: [],
    loading: false,
    error: ""
  },
  pokedex: {
    entries: [],
    loading: false,
    loaded: false,
    error: "",
    sort: "generation_asc",
    searchQuery: "",
    ownershipFilter: "all",
    speciesDexByName: {},
    speciesDexByCompact: {},
    speciesMapLoaded: false,
    galleryBySpecies: {},
    selectedSpeciesKey: "",
    previewCardBySpecies: {}
  },
  achievementsSearch: "",
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
    setSearch: "",
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
    packsOpened: 0,
    godPacksOpened: 0
  }
};

const el = {
  appShell: document.getElementById("appShell"),
  authUserLabel: document.getElementById("authUserLabel"),
  authLogoutBtn: document.getElementById("authLogoutBtn"),
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
  broadcastBanner: document.getElementById("broadcastBanner"),
  trainerAvatarBtn: document.getElementById("trainerAvatarBtn"),
  trainerAvatarImage: document.getElementById("trainerAvatarImage"),
  trainerAvatarInitial: document.getElementById("trainerAvatarInitial"),
  trainerAvatarInput: document.getElementById("trainerAvatarInput"),
  trainerIgnDisplay: document.getElementById("trainerIgnDisplay"),
  trainerIgnEditBtn: document.getElementById("trainerIgnEditBtn"),
  trainerUid: document.getElementById("trainerUid"),
  trainerFriendCount: document.getElementById("trainerFriendCount"),
  friendTrainerIdInput: document.getElementById("friendTrainerIdInput"),
  friendIgnInput: document.getElementById("friendIgnInput"),
  addFriendBtn: document.getElementById("addFriendBtn"),
  trainerFriendList: document.getElementById("trainerFriendList"),
  dashboardFavoriteMeta: document.getElementById("dashboardFavoriteMeta"),
  dashboardFavoriteCards: document.getElementById("dashboardFavoriteCards"),
  dashboardCardsOwned: document.getElementById("dashboardCardsOwned"),
  dashboardUniqueOwned: document.getElementById("dashboardUniqueOwned"),
  dashboardNetWorth: document.getElementById("dashboardNetWorth"),
  dashboardNetWorthValue: document.getElementById("dashboardNetWorthValue"),
  dashboardPacksOpened: document.getElementById("dashboardPacksOpened"),
  dashboardGodPacks: document.getElementById("dashboardGodPacks"),
  dashboardTopMeta: document.getElementById("dashboardTopMeta"),
  dashboardTopCards: document.getElementById("dashboardTopCards"),
  dashboardBadgeMeta: document.getElementById("dashboardBadgeMeta"),
  dashboardBadgeGrid: document.getElementById("dashboardBadgeGrid"),
  dashboardBadgeCustomizeBtn: document.getElementById("dashboardBadgeCustomizeBtn"),
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
  goalTitleInput: document.getElementById("goalTitleInput"),
  goalTypeSelect: document.getElementById("goalTypeSelect"),
  goalKeywordInput: document.getElementById("goalKeywordInput"),
  goalSetSelect: document.getElementById("goalSetSelect"),
  addGoalBtn: document.getElementById("addGoalBtn"),
  goalGrid: document.getElementById("goalGrid"),
  inventoryMeta: document.getElementById("inventoryMeta"),
  inventorySearch: document.getElementById("inventorySearch"),
  inventorySort: document.getElementById("inventorySort"),
  inventoryRarityFilter: document.getElementById("inventoryRarityFilter"),
  inventoryList: document.getElementById("inventoryList"),
  pokedexLayout: document.getElementById("pokedexLayout"),
  pokedexMeta: document.getElementById("pokedexMeta"),
  pokedexSearch: document.getElementById("pokedexSearch"),
  pokedexSort: document.getElementById("pokedexSort"),
  pokedexOwnershipFilter: document.getElementById("pokedexOwnershipFilter"),
  pokedexGrid: document.getElementById("pokedexGrid"),
  pokedexGalleryPanel: document.getElementById("pokedexGalleryPanel"),
  pokedexGalleryTitle: document.getElementById("pokedexGalleryTitle"),
  pokedexGalleryMeta: document.getElementById("pokedexGalleryMeta"),
  pokedexGalleryGrid: document.getElementById("pokedexGalleryGrid"),
  pokedexGalleryCloseBtn: document.getElementById("pokedexGalleryCloseBtn"),
  achievementsMeta: document.getElementById("achievementsMeta"),
  achievementsSearchInput: document.getElementById("achievementsSearchInput"),
  achievementBadgeGrid: document.getElementById("achievementBadgeGrid"),
  achievementSpecialGrid: document.getElementById("achievementSpecialGrid"),
  developerCard: document.getElementById("developerCard"),
  gachaPopout: document.getElementById("gachaPopout"),
  gachaPopoutPanel: document.getElementById("gachaPopoutPanel"),
  gachaPopoutInfo: document.getElementById("gachaPopoutInfo"),
  gachaInfoToggleBtn: document.getElementById("gachaInfoToggleBtn"),
  gachaSetSearchInput: document.getElementById("gachaSetSearchInput"),
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

let cloudSaveTimer = null;
let cloudSaveInFlight = false;
let cloudSaveQueued = false;
let isHydratingCloudState = false;
let cloudSyncUnavailable = false;
let appInitialized = false;
let authToken = "";
let authUser = null;
let broadcastRefreshTimer = null;

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

function generateTrainerUid() {
  const block = () => Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `PK-${block()}-${block()}`;
}

function normalizeFavoriteCardIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const item of value) {
    const cardId = String(item || "").trim();
    if (!cardId) {
      continue;
    }
    unique.add(cardId);
  }

  return [...unique].slice(0, 60);
}

function normalizeWishlistCardIds(value) {
  return normalizeFavoriteCardIds(value);
}

function normalizeBadgeShowcaseIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const item of value) {
    const badgeId = String(item || "").trim();
    if (!badgeId) {
      continue;
    }
    unique.add(badgeId);
  }

  return [...unique].slice(0, MAX_SHOWCASE_BADGES);
}

function normalizeTrainerCode(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();

  if (!raw) {
    return "";
  }

  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (/^PK\d{8}$/.test(compact)) {
    return `PK-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
  }

  if (/^\d{8}$/.test(compact)) {
    return `PK-${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
  }

  return raw.replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

function normalizeFriends(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const byUid = new Map();
  for (const raw of value) {
    const uid = normalizeTrainerCode(raw?.uid || raw?.id || "");
    if (!uid) {
      continue;
    }

    const ign = String(raw?.ign || raw?.name || "").trim().slice(0, 30);
    const addedAt = Number(raw?.addedAt) || Date.now();

    if (!byUid.has(uid)) {
      byUid.set(uid, {
        uid,
        ign,
        addedAt
      });
      continue;
    }

    const existing = byUid.get(uid);
    if (!existing.ign && ign) {
      existing.ign = ign;
    }
    existing.addedAt = Math.min(existing.addedAt, addedAt);
  }

  return [...byUid.values()]
    .sort((left, right) => (right.addedAt || 0) - (left.addedAt || 0))
    .slice(0, MAX_FRIENDS);
}

function generateCollectionGoalId() {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCollectionGoal(raw) {
  const type = ["pokemon", "set", "custom"].includes(raw?.type) ? raw.type : "pokemon";
  return {
    id: raw?.id || generateCollectionGoalId(),
    title: String(raw?.title || "Collection Goal").trim().slice(0, 50) || "Collection Goal",
    type,
    keyword: String(raw?.keyword || "").trim().slice(0, 40),
    setId: String(raw?.setId || "").trim(),
    boardImage: String(raw?.boardImage || ""),
    updatedAt: Number(raw?.updatedAt) || Date.now()
  };
}

function invalidateGoalProgressCache() {
  state.goalProgressCache.clear();
}

function isGoalOpen(goalId) {
  return state.goalOpenIds.includes(goalId);
}

function setGoalOpen(goalId, isOpen) {
  if (isOpen) {
    if (!state.goalOpenIds.includes(goalId)) {
      state.goalOpenIds = [...state.goalOpenIds, goalId];
    }
    return;
  }

  state.goalOpenIds = state.goalOpenIds.filter((id) => id !== goalId);
}

function isFavoriteCard(cardId) {
  return state.profile.favoriteCardIds.includes(String(cardId || ""));
}

function toggleFavoriteCard(card) {
  const cardId = String(card?.id || "").trim();
  if (!cardId) {
    return;
  }

  if (isFavoriteCard(cardId)) {
    state.profile.favoriteCardIds = state.profile.favoriteCardIds.filter((id) => id !== cardId);
  } else {
    state.profile.favoriteCardIds = [cardId, ...state.profile.favoriteCardIds].slice(0, 60);
  }

  saveBinder();
  renderCards();
  renderBinder();
  renderDashboard();
  renderPokedexGallery();
}

function isWishlistCard(cardId) {
  return state.profile.wishlistCardIds.includes(String(cardId || ""));
}

function toggleWishlistCard(card) {
  const cardId = String(card?.id || "").trim();
  if (!cardId) {
    return;
  }

  if (isWishlistCard(cardId)) {
    state.profile.wishlistCardIds = state.profile.wishlistCardIds.filter((id) => id !== cardId);
  } else {
    state.profile.wishlistCardIds = [cardId, ...state.profile.wishlistCardIds].slice(0, 60);
  }

  saveBinder();
  renderCards();
}

function removeFriend(uid) {
  const normalizedUid = normalizeTrainerCode(uid);
  if (!normalizedUid) {
    return;
  }

  state.profile.friends = state.profile.friends.filter((friend) => friend.uid !== normalizedUid);
  saveBinder();
  renderDashboard();
}

function addFriendFromInputs() {
  if (!el.friendTrainerIdInput) {
    return;
  }

  const uid = normalizeTrainerCode(el.friendTrainerIdInput.value);
  const ign = String(el.friendIgnInput?.value || "").trim().slice(0, 30);

  if (!uid) {
    window.alert("Please enter a friend Trainer ID.");
    return;
  }

  if (uid === normalizeTrainerCode(state.profile.uid)) {
    window.alert("You already are this Trainer ID.");
    return;
  }

  const existing = state.profile.friends.find((friend) => friend.uid === uid);
  if (existing) {
    if (ign) {
      existing.ign = ign;
    }
  } else {
    state.profile.friends = normalizeFriends([
      {
        uid,
        ign,
        addedAt: Date.now()
      },
      ...state.profile.friends
    ]);
  }

  if (el.friendTrainerIdInput) {
    el.friendTrainerIdInput.value = "";
  }
  if (el.friendIgnInput) {
    el.friendIgnInput.value = "";
  }

  saveBinder();
  renderDashboard();
}

function renderTrainerFriends() {
  if (!el.trainerFriendList || !el.trainerFriendCount) {
    return;
  }

  const friends = normalizeFriends(state.profile.friends).filter(
    (friend) => friend.uid !== normalizeTrainerCode(state.profile.uid)
  );
  state.profile.friends = friends;

  el.trainerFriendCount.textContent = `${friends.length} added`;
  el.trainerFriendList.innerHTML = "";

  if (!friends.length) {
    const empty = document.createElement("p");
    empty.className = "trainer-friend-empty";
    empty.textContent = "No friends yet. Add Trainer IDs to start your friends list.";
    el.trainerFriendList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const friend of friends) {
    const item = document.createElement("article");
    item.className = "trainer-friend-item";

    const meta = document.createElement("div");
    meta.className = "trainer-friend-meta";

    const ign = document.createElement("p");
    ign.className = "trainer-friend-ign";
    ign.textContent = friend.ign || "Unknown Trainer";
    meta.appendChild(ign);

    const uid = document.createElement("p");
    uid.className = "trainer-friend-id";
    uid.textContent = friend.uid;
    meta.appendChild(uid);

    item.appendChild(meta);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "trainer-friend-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      removeFriend(friend.uid);
    });
    item.appendChild(removeBtn);

    fragment.appendChild(item);
  }

  el.trainerFriendList.appendChild(fragment);
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

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function persistAuthSession(token, user) {
  authToken = String(token || "").trim();
  authUser = user && typeof user === "object" ? user : null;

  try {
    if (authToken) {
      localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, authToken);
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    }

    if (authUser) {
      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(authUser));
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    }
  } catch {
    // ignore storage write errors
  }
}

function clearAuthSession() {
  authToken = "";
  authUser = null;
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
  } catch {
    // ignore storage write errors
  }
}

function updateAuthUserLabel() {
  if (!el.authUserLabel) {
    return;
  }

  if (!authUser) {
    el.authUserLabel.textContent = "";
    return;
  }

  const username = String(authUser.username || "").trim();
  const ingame = String(authUser.ingameName || "").trim();
  el.authUserLabel.textContent = ingame ? `${ingame} (@${username})` : `@${username}`;
}

function renderBroadcastBanner(payload) {
  if (!el.broadcastBanner) {
    return;
  }

  const active = Boolean(payload?.active);
  const message = String(payload?.message || "").trim();
  if (!active || !message) {
    el.broadcastBanner.hidden = true;
    el.broadcastBanner.textContent = "";
    return;
  }

  el.broadcastBanner.hidden = false;
  el.broadcastBanner.textContent = message;
}

async function refreshBroadcastBanner() {
  try {
    const response = await fetch("/api/broadcast/current");
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    renderBroadcastBanner(payload);
  } catch {
    // ignore broadcast fetch errors
  }
}

function startBroadcastPolling() {
  if (broadcastRefreshTimer) {
    window.clearInterval(broadcastRefreshTimer);
    broadcastRefreshTimer = null;
  }

  void refreshBroadcastBanner();
  broadcastRefreshTimer = window.setInterval(() => {
    void refreshBroadcastBanner();
  }, 45000);
}

function showAppShell() {
  if (el.appShell) {
    el.appShell.hidden = false;
  }
  updateAuthUserLabel();
  startBroadcastPolling();
}

async function authRequest(endpoint, options = {}) {
  const response = await fetch(`${AUTH_API_BASE_PATH}${endpoint}`, {
    ...options,
    headers: getAuthHeaders(options.headers || {})
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function restoreAuthFromStorage() {
  try {
    const token = String(localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || "").trim();
    if (!token) {
      return false;
    }

    authToken = token;

    const payload = await authRequest("/me");
    persistAuthSession(token, payload.user || null);
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

function attachSessionEvents() {
  el.authLogoutBtn?.addEventListener("click", () => {
    clearAuthSession();
    window.location.replace("/login.html");
  });
}

function applyPersistedBinderState(parsed) {
  const binders = Array.isArray(parsed?.binders)
    ? parsed.binders.map((binder, index) => normalizeBinderRecord(binder, index))
    : [];

  state.binders = binders.length ? binders : [createDefaultBinderRecord()];
  state.profile.name = String(parsed?.profile?.name || "").slice(0, 40);
  state.profile.ign = String(parsed?.profile?.ign || "").slice(0, 30);
  state.profile.avatar = String(parsed?.profile?.avatar || "");
  state.profile.uid = String(parsed?.profile?.uid || "").slice(0, 20) || generateTrainerUid();
  state.profile.favoriteCardIds = normalizeFavoriteCardIds(parsed?.profile?.favoriteCardIds);
  state.profile.wishlistCardIds = normalizeWishlistCardIds(parsed?.profile?.wishlistCardIds);
  state.profile.badgeShowcaseIds = normalizeBadgeShowcaseIds(parsed?.profile?.badgeShowcaseIds);
  state.profile.friends = normalizeFriends(parsed?.profile?.friends);
  state.collectionGoals = Array.isArray(parsed?.collectionGoals)
    ? parsed.collectionGoals.map((goal) => normalizeCollectionGoal(goal))
    : [];
  state.gacha.packsOpened = Math.max(toPositiveInt(parsed?.packsOpened, 0), 0);
  state.gacha.godPacksOpened = Math.max(toPositiveInt(parsed?.godPacksOpened, 0), 0);
  if (COLLECTION_PRESET_OPTIONS.includes(parsed?.binderCollection?.preset)) {
    state.binderCollection.preset = parsed.binderCollection.preset;
  }
  state.binderCollection.setId = String(parsed?.binderCollection?.setId || "");
  if (POKEDEX_SORT_OPTIONS.includes(parsed?.pokedex?.sort)) {
    state.pokedex.sort = parsed.pokedex.sort;
  }
  state.pokedex.searchQuery = String(parsed?.pokedex?.searchQuery || "").slice(0, 50);
  if (POKEDEX_OWNERSHIP_FILTER_OPTIONS.includes(parsed?.pokedex?.ownershipFilter)) {
    state.pokedex.ownershipFilter = parsed.pokedex.ownershipFilter;
  }
  state.achievementsSearch = String(parsed?.achievementsSearch || "").slice(0, 60);
  state.gacha.setSearch = String(parsed?.gacha?.setSearch || "").slice(0, 60);
  if (parsed?.pokedex?.previewCardBySpecies && typeof parsed.pokedex.previewCardBySpecies === "object") {
    state.pokedex.previewCardBySpecies = Object.fromEntries(
      Object.entries(parsed.pokedex.previewCardBySpecies)
        .filter(([key, value]) => Boolean(String(key || "").trim()) && Boolean(String(value || "").trim()))
        .map(([key, value]) => [String(key), String(value)])
    );
  }
  setActiveBinder(parsed?.activeBinderId || state.binders[0].id);
}

function buildPersistedBinderPayload() {
  return {
    binders: state.binders,
    activeBinderId: state.activeBinderId,
    profile: {
      name: state.profile.name,
      ign: state.profile.ign,
      avatar: state.profile.avatar,
      uid: state.profile.uid,
      favoriteCardIds: state.profile.favoriteCardIds,
      wishlistCardIds: state.profile.wishlistCardIds,
      badgeShowcaseIds: state.profile.badgeShowcaseIds,
      friends: state.profile.friends
    },
    collectionGoals: state.collectionGoals,
    binderCollection: {
      preset: state.binderCollection.preset,
      setId: state.binderCollection.setId
    },
    pokedex: {
      sort: state.pokedex.sort,
      searchQuery: state.pokedex.searchQuery,
      ownershipFilter: state.pokedex.ownershipFilter,
      previewCardBySpecies: state.pokedex.previewCardBySpecies
    },
    achievementsSearch: state.achievementsSearch,
    gacha: {
      setSearch: state.gacha.setSearch
    },
    packsOpened: state.gacha.packsOpened,
    godPacksOpened: state.gacha.godPacksOpened
  };
}

function loadBinderState() {
  try {
    const stateRaw = localStorage.getItem(STORAGE_KEY_BINDER_STATE);
    if (stateRaw) {
      applyPersistedBinderState(JSON.parse(stateRaw));
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
    state.profile.uid = generateTrainerUid();
    state.profile.favoriteCardIds = [];
    state.profile.wishlistCardIds = [];
    state.profile.badgeShowcaseIds = [];
    state.profile.friends = [];
    state.collectionGoals = [];
    setActiveBinder(state.binders[0].id);
  } catch {
    state.binders = [createDefaultBinderRecord()];
    state.profile.uid = generateTrainerUid();
    state.profile.favoriteCardIds = [];
    state.profile.wishlistCardIds = [];
    state.profile.badgeShowcaseIds = [];
    state.profile.friends = [];
    state.collectionGoals = [];
    setActiveBinder(state.binders[0].id);
  }
}

function clearAllPlayerDataOnce() {
  try {
    if (localStorage.getItem(STORAGE_KEY_PLAYER_DATA_WIPE_VERSION) === PLAYER_DATA_WIPE_VERSION) {
      return;
    }

    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const normalizedKey = String(key || "").toLowerCase();
      if (normalizedKey.startsWith("pokemon") || normalizedKey.startsWith("mypokemon")) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      if (key) {
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(STORAGE_KEY_PLAYER_DATA_WIPE_VERSION, PLAYER_DATA_WIPE_VERSION);
  } catch (_error) {
    // ignore storage access errors
  }
}

async function loadPlayerStateFromCloud() {
  if (cloudSyncUnavailable) {
    return false;
  }

  if (!authToken) {
    return false;
  }

  try {
    const response = await fetch(PLAYER_STATE_API_PATH, {
      headers: getAuthHeaders()
    });
    if (response.status === 503) {
      cloudSyncUnavailable = true;
      return false;
    }

    if (response.status === 401) {
      clearAuthSession();
      cloudSyncUnavailable = true;
      return false;
    }

    if (!response.ok) {
      throw new Error(`Cloud load failed (${response.status})`);
    }

    const payload = await response.json();
    if (!payload?.state || typeof payload.state !== "object") {
      return false;
    }

    isHydratingCloudState = true;
    applyPersistedBinderState(payload.state);
    saveBinder({ skipCloud: true });
    return true;
  } catch (error) {
    console.warn("Unable to load player state from Supabase", error);
    return false;
  } finally {
    isHydratingCloudState = false;
  }
}

async function savePlayerStateToCloud() {
  if (cloudSyncUnavailable) {
    return;
  }

  if (cloudSaveInFlight) {
    cloudSaveQueued = true;
    return;
  }

  const uid = normalizeTrainerCode(state.profile.uid);
  if (!uid || !authToken) {
    return;
  }

  cloudSaveInFlight = true;
  try {
    const response = await fetch(PLAYER_STATE_API_PATH, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        state: buildPersistedBinderPayload()
      })
    });

    if (response.status === 503) {
      cloudSyncUnavailable = true;
      return;
    }

    if (response.status === 401) {
      clearAuthSession();
      cloudSyncUnavailable = true;
      return;
    }

    if (!response.ok) {
      throw new Error(`Cloud save failed (${response.status})`);
    }
  } catch (error) {
    console.warn("Unable to save player state to Supabase", error);
  } finally {
    cloudSaveInFlight = false;
    if (cloudSaveQueued) {
      cloudSaveQueued = false;
      void savePlayerStateToCloud();
    }
  }
}

function queuePlayerStateCloudSave() {
  if (isHydratingCloudState || cloudSyncUnavailable) {
    return;
  }

  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
  }

  cloudSaveTimer = window.setTimeout(() => {
    cloudSaveTimer = null;
    void savePlayerStateToCloud();
  }, CLOUD_SAVE_DEBOUNCE_MS);
}

function saveBinder(options = {}) {
  const active = getActiveBinderRecord();
  if (active) {
    active.entries = state.binder;
  }

  const payload = buildPersistedBinderPayload();

  try {
    localStorage.setItem(STORAGE_KEY_BINDER_STATE, JSON.stringify(payload));
    localStorage.setItem(STORAGE_KEY_BINDER, JSON.stringify(state.binder));
  } catch (error) {
    console.warn("Unable to persist binder state", error);
  }

  if (!options.skipCloud) {
    queuePlayerStateCloudSave();
  }
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

  el.workspaceSubtitle.textContent = typeof subtitle === "string" ? subtitle : "";

  if (viewId === "finder") {
    window.requestAnimationFrame(() => {
      el.searchInput.focus();
    });
  }

  if (viewId === "pokedex") {
    void ensurePokedexLoaded();
    renderPokedex();
  }

  if (viewId === "achievements") {
    void ensurePokedexLoaded();
    renderAchievements();
    if (el.achievementsSearchInput) {
      window.requestAnimationFrame(() => {
        el.achievementsSearchInput.focus();
      });
    }
  }

  if (viewId === "inventory") {
    renderInventory();
  }

  if (viewId === "developer") {
    initializeDeveloperCardInteraction();
    resetDeveloperCardToBack();
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

function cardImageCandidateUrls(card, preferLarge = true) {
  const large = String(card?.images?.large || "").trim();
  const small = String(card?.images?.small || "").trim();
  return preferLarge ? [large, small].filter(Boolean) : [small, large].filter(Boolean);
}

function applyCardImageSource(imageElement, card, options = {}) {
  const preferLarge = options.preferLarge !== false;
  const [primaryUrl = "", fallbackUrl = ""] = cardImageCandidateUrls(card, preferLarge);

  imageElement.onerror = null;
  if (!primaryUrl) {
    imageElement.removeAttribute("src");
    return;
  }

  if (fallbackUrl && fallbackUrl !== primaryUrl) {
    imageElement.onerror = () => {
      if (imageElement.src !== fallbackUrl) {
        imageElement.src = fallbackUrl;
        return;
      }

      imageElement.onerror = null;
    };
  }

  imageElement.src = primaryUrl;
}

function setModalCardFace(card, showBackFirst = false, options = {}) {
  applyCardImageSource(el.modalCardFrontImage, card);
  el.modalCardFrontImage.alt = `${card.name} card preview`;
  el.modalCardFrontImage.classList.toggle("is-unobtained-preview", Boolean(options.grayscale));
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

function rarityValueTier(card) {
  const rarity = String(card?.rarity || "").toLowerCase();

  if (
    rarity.includes("secret") ||
    rarity.includes("hyper") ||
    rarity.includes("gold") ||
    rarity.includes("rainbow") ||
    rarity.includes("special illustration")
  ) {
    return "chase";
  }

  if (
    rarity.includes("illustration") ||
    rarity.includes("ultra") ||
    rarity.includes("rare holo v") ||
    rarity.includes("double rare")
  ) {
    return "ultra";
  }

  if (rarity.includes("holo") || rarity.includes("rare")) {
    return "rare";
  }

  if (rarity.includes("uncommon")) {
    return "uncommon";
  }

  return "common";
}

function stableCardVariance(cardId) {
  const text = String(cardId || "");
  if (!text) {
    return 1;
  }

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 100000;
  }

  return 0.86 + ((hash % 31) / 100);
}

function parseCollectorNumber(card) {
  const text = String(card?.number || "").trim();
  const slash = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (slash) {
    return {
      number: Number.parseInt(slash[1], 10) || 0,
      total: Number.parseInt(slash[2], 10) || 0
    };
  }

  const plain = text.match(/(\d+)/);
  return {
    number: plain ? Number.parseInt(plain[1], 10) || 0 : 0,
    total: Number.parseInt(card?.set?.printedTotal || card?.set?.total || 0, 10) || 0
  };
}

function isBasicEnergyCardForValue(card) {
  const supertype = String(card?.supertype || "").toLowerCase();
  const name = String(card?.name || "").toLowerCase();
  const subtypes = Array.isArray(card?.subtypes)
    ? card.subtypes.map((item) => String(item || "").toLowerCase())
    : [];

  if (supertype !== "energy" && !name.includes("energy")) {
    return false;
  }

  if (subtypes.includes("basic")) {
    return true;
  }

  const basicEnergyNames = new Set([
    "grass energy",
    "fire energy",
    "water energy",
    "lightning energy",
    "psychic energy",
    "fighting energy",
    "darkness energy",
    "metal energy",
    "fairy energy"
  ]);

  return basicEnergyNames.has(name);
}

function getCardMarketBaseValue(card) {
  const rarity = String(card?.rarity || "").toLowerCase();
  if (isBasicEnergyCardForValue(card) && rarity.includes("hyper rare")) {
    const commonBaseValue = Math.round(24 * stableCardVariance(card?.id));
    return Math.max(commonBaseValue, 12);
  }

  const tier = rarityValueTier(card);
  const baseByTier = {
    common: 24,
    uncommon: 52,
    rare: 150,
    ultra: 520,
    chase: 1450
  };

  let value = baseByTier[tier] || 100;

  const subtypes = Array.isArray(card?.subtypes)
    ? card.subtypes.map((item) => String(item || "").toLowerCase())
    : [];
  const name = String(card?.name || "").toLowerCase();
  const setName = String(card?.set?.name || "").toLowerCase();

  if (subtypes.includes("vstar")) {
    value += 120;
  }
  if (subtypes.includes("vmax")) {
    value += 150;
  }
  if (subtypes.includes("gx")) {
    value += 96;
  }
  if (subtypes.includes("ex")) {
    value += 85;
  }
  if (subtypes.includes("v")) {
    value += 74;
  }

  if (name.includes("charizard")) {
    value += 330;
  } else if (name.includes("pikachu") || name.includes("mew") || name.includes("rayquaza")) {
    value += 190;
  } else if (name.includes("lugia") || name.includes("giratina") || name.includes("umbreon")) {
    value += 155;
  }

  const collectorInfo = parseCollectorNumber(card);
  if (collectorInfo.total > 0 && collectorInfo.number > collectorInfo.total) {
    value += 620;
  }

  if (rarity.includes("promo")) {
    value += 62;
  }

  const releaseYear = Number.parseInt(String(card?.set?.releaseDate || "").slice(0, 4), 10);
  if (Number.isFinite(releaseYear) && releaseYear > 0) {
    const age = Math.max(new Date().getFullYear() - releaseYear, 0);
    value += Math.min(age * 14, 150);
  }

  if (setName.includes("151") || setName.includes("evolving skies")) {
    value += 70;
  }

  const finalValue = Math.round(value * stableCardVariance(card?.id));
  return Math.max(finalValue, 12);
}

function getCardLastSoldValue(card) {
  const value = getCardMarketBaseValue(card);
  return toFiniteNumber(value);
}

function formatLastSoldValue(card) {
  const value = getCardLastSoldValue(card);
  return `Value: ${formatPokeCoins(value)}`;
}

function formatPokeCoins(value) {
  return `${Math.round(toFiniteNumber(value)).toLocaleString()} POKECOINS`;
}

function formatPokeCoinCount(value) {
  return Math.round(toFiniteNumber(value)).toLocaleString();
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
  applyCardImageSource(el.modalNextCardImage, nextItem.card);
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
  const isLastFrontCard =
    state.gacha.revealing &&
    state.gacha.revealStage === "front" &&
    state.gacha.revealIndex >= state.gacha.revealQueue.length - 1;

  tiltState.mode =
    state.gacha.revealing && state.gacha.revealStage === "front" && !isLastFrontCard
      ? "swipe"
      : "tilt";
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

function openCardModal(card, options = {}) {
  clearFirstFlipTimer();
  state.gacha.firstFlipAnimating = false;

  setModalCardFace(card, false, options);
  el.modalFlipCard.classList.add("is-front-locked");
  el.modalFlipCard.classList.remove(
    "is-first-flip",
    "is-swipe-dragging",
    "is-swipe-out",
    "reveal-tier-rare",
    "reveal-tier-holo",
    "reveal-tier-ultra",
    "is-rarest-reveal"
  );
  el.modalTiltCard.classList.remove("is-rarest-reveal", "is-swipe-active");
  resetRevealSwipeTransform();
  hideNextRevealPreview();

  setModalRevealMode(false);
  if (el.modalRevealInfo) {
    el.modalRevealInfo.hidden = true;
  }
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
  if (el.modalRevealInfo) {
    el.modalRevealInfo.hidden = true;
  }
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
  const serverSort = state.query.sort === "wishlist_first"
    ? "name_asc"
    : state.query.sort;

  const params = new URLSearchParams({
    search: state.query.search,
    setId: state.query.setId,
    sort: serverSort,
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

  const percent = value * 100;
  if (percent <= 0) {
    return "0%";
  }

  if (percent < 0.1) {
    return "<0.1%";
  }

  return `${percent.toFixed(1)}%`;
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
      applyCardImageSource(image, card, { preferLarge: false });
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

  renderGoalSetOptions();
}

function renderGoalSetOptions() {
  if (!el.goalSetSelect) {
    return;
  }

  const currentValue = String(el.goalSetSelect.value || "");
  el.goalSetSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All sets";
  el.goalSetSelect.appendChild(allOption);

  const fragment = document.createDocumentFragment();
  for (const set of state.sets) {
    const option = document.createElement("option");
    option.value = set.id;
    option.textContent = `${set.name} (${set.series || "Series"})`;
    fragment.appendChild(option);
  }
  el.goalSetSelect.appendChild(fragment);

  const hasCurrent = state.sets.some((set) => set.id === currentValue);
  el.goalSetSelect.value = hasCurrent ? currentValue : "";
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

async function fetchAllCollectionCards({
  search = "",
  setId = "",
  sort = "name_asc",
  pageSize = 40,
  maxPages = 80
}) {
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
    if (page > maxPages) {
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
  if (el.dashboardNetWorthValue) {
    el.dashboardNetWorthValue.textContent = Math.round(netWorth).toLocaleString();
  } else {
    el.dashboardNetWorth.textContent = formatPokeCoins(netWorth);
  }
  if (el.dashboardPacksOpened) {
    el.dashboardPacksOpened.textContent = String(state.gacha.packsOpened);
  }
  el.dashboardGodPacks.textContent = String(state.gacha.godPacksOpened);

  if (el.dashboardTopMeta) {
    const active = getActiveBinderRecord();
    el.dashboardTopMeta.textContent = active
      ? `Highest POKECOIN value cards in ${active.name}.`
      : "Highest POKECOIN value cards in your active binder.";
  }

  if (el.trainerIgnDisplay) {
    el.trainerIgnDisplay.textContent = state.profile.ign || "Unknown Trainer";
  }

  if (el.trainerUid) {
    el.trainerUid.textContent = state.profile.uid || "PK-0000-0000";
  }

  renderTrainerAvatar();
  renderTrainerFriends();

  if (!el.dashboardTopCards) {
    renderDashboardBadgeShowcase();
    return;
  }

  const createDashboardCard = (card) => {
    const article = document.createElement("article");
    article.className = "dashboard-top-card";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "favorite-toggle";
    favoriteBtn.classList.toggle("is-active", isFavoriteCard(card.id));
    favoriteBtn.textContent = isFavoriteCard(card.id) ? "★" : "☆";
    favoriteBtn.setAttribute(
      "aria-label",
      isFavoriteCard(card.id) ? `Remove ${card.name} from favorites` : `Add ${card.name} to favorites`
    );
    favoriteBtn.addEventListener("click", () => {
      toggleFavoriteCard(card);
    });
    article.appendChild(favoriteBtn);

    const image = document.createElement("img");
    applyCardImageSource(image, card, { preferLarge: false });
    image.alt = `${card.name} card`;
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

    return article;
  };

  const binderById = new Map(state.binder.map((card) => [card.id, card]));
  const favoriteCards = state.profile.favoriteCardIds
    .map((cardId) => binderById.get(cardId))
    .filter(Boolean)
    .slice(0, 6);

  if (el.dashboardFavoriteMeta) {
    el.dashboardFavoriteMeta.textContent = favoriteCards.length
      ? `${favoriteCards.length} favorite card${favoriteCards.length === 1 ? "" : "s"} pinned.`
      : "No favorites yet. Tap ☆ on cards to pin favorites.";
  }

  if (el.dashboardFavoriteCards) {
    el.dashboardFavoriteCards.innerHTML = "";
    if (!favoriteCards.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No favorite cards pinned yet.";
      el.dashboardFavoriteCards.appendChild(empty);
    } else {
      const favoritesFragment = document.createDocumentFragment();
      for (const card of favoriteCards) {
        favoritesFragment.appendChild(createDashboardCard(card));
      }
      el.dashboardFavoriteCards.appendChild(favoritesFragment);
    }
  }

  el.dashboardTopCards.innerHTML = "";
  const topCards = [...state.binder]
    .sort((left, right) => getCardLastSoldValue(right) - getCardLastSoldValue(left))
    .slice(0, 5);

  if (!topCards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No cards in this binder yet.";
    el.dashboardTopCards.appendChild(empty);
    renderDashboardBadgeShowcase();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const card of topCards) {
    fragment.appendChild(createDashboardCard(card));
  }

  el.dashboardTopCards.appendChild(fragment);
  renderDashboardBadgeShowcase();

}

function renderInventory() {
  if (!el.inventoryList || !el.inventoryMeta) {
    return;
  }

  el.inventoryList.innerHTML = "";

  if (el.inventorySearch && el.inventorySearch.value !== state.inventory.search) {
    el.inventorySearch.value = state.inventory.search;
  }
  if (el.inventorySort && el.inventorySort.value !== state.inventory.sort) {
    el.inventorySort.value = state.inventory.sort;
  }

  const rarityOptions = [...new Set(state.binder.map((card) => String(card.rarity || "Unknown")))].sort(
    (left, right) => left.localeCompare(right)
  );
  if (el.inventoryRarityFilter) {
    const currentValue = state.inventory.rarity;
    const currentOptions = ["", ...rarityOptions];
    const existingOptions = Array.from(el.inventoryRarityFilter.options).map((option) => option.value);
    const needsRefresh =
      existingOptions.length !== currentOptions.length ||
      existingOptions.some((value, index) => value !== currentOptions[index]);

    if (needsRefresh) {
      el.inventoryRarityFilter.innerHTML = "";
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = "All rarities";
      el.inventoryRarityFilter.appendChild(allOption);

      for (const rarity of rarityOptions) {
        const option = document.createElement("option");
        option.value = rarity;
        option.textContent = rarity;
        el.inventoryRarityFilter.appendChild(option);
      }
    }
    if (el.inventoryRarityFilter.value !== currentValue) {
      el.inventoryRarityFilter.value = currentValue;
    }
  }

  const search = state.inventory.search.trim().toLowerCase();
  let ownedCards = [...state.binder].filter((card) => {
    if (state.inventory.rarity && String(card.rarity || "Unknown") !== state.inventory.rarity) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = `${card.name || ""} ${card.set?.name || ""}`.toLowerCase();
    return haystack.includes(search);
  });

  ownedCards.sort((left, right) => {
    const leftQty = toPositiveInt(left.ownedQty, 1);
    const rightQty = toPositiveInt(right.ownedQty, 1);

    switch (state.inventory.sort) {
      case "qty_asc": {
        const byQty = leftQty - rightQty;
        if (byQty) {
          return byQty;
        }
        return String(left.name || "").localeCompare(String(right.name || ""));
      }
      case "value_desc": {
        const byValue = getCardLastSoldValue(right) - getCardLastSoldValue(left);
        if (byValue) {
          return byValue;
        }
        return String(left.name || "").localeCompare(String(right.name || ""));
      }
      case "name_asc":
        return String(left.name || "").localeCompare(String(right.name || ""));
      case "name_desc":
        return String(right.name || "").localeCompare(String(left.name || ""));
      case "newest":
        return (right.addedAt || 0) - (left.addedAt || 0);
      case "qty_desc":
      default: {
        const byQty = rightQty - leftQty;
        if (byQty) {
          return byQty;
        }
        return String(left.name || "").localeCompare(String(right.name || ""));
      }
    }
  });

  const totalCopies = ownedCards.reduce(
    (sum, card) => sum + toPositiveInt(card.ownedQty, 1),
    0
  );
  el.inventoryMeta.textContent = `${ownedCards.length} cards • ${totalCopies} copies`;

  if (!ownedCards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No owned cards yet.";
    el.inventoryList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const card of ownedCards) {
    const item = document.createElement("article");
    item.className = "inventory-item";
    item.addEventListener("click", () => {
      openCardModal(card);
    });

    const image = document.createElement("img");
    image.loading = "lazy";
    applyCardImageSource(image, card, { preferLarge: false });
    image.alt = `${card.name} card`;
    item.appendChild(image);

    const meta = document.createElement("div");
    meta.className = "inventory-item-meta";

    const name = document.createElement("h3");
    name.textContent = card.name;
    meta.appendChild(name);

    const line = document.createElement("p");
    line.textContent = `${card.set?.name || "Unknown set"} • ${card.rarity || "Unknown"}`;
    meta.appendChild(line);

    item.appendChild(meta);

    const qty = document.createElement("p");
    qty.className = "inventory-item-qty";
    qty.textContent = `x${toPositiveInt(card.ownedQty, 1)}`;
    item.appendChild(qty);

    fragment.appendChild(item);
  }

  el.inventoryList.appendChild(fragment);
}

function initializeDeveloperCardInteraction() {
  if (!el.developerCard || el.developerCard.dataset.bound === "true") {
    return;
  }

  el.developerCard.dataset.bound = "true";
  let glowTimer = null;

  const updateFromPointer = (event) => {
    const rect = el.developerCard.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
    const px = rect.width ? (x / rect.width) * 100 : 50;
    const py = rect.height ? (y / rect.height) * 100 : 50;

    el.developerCard.style.setProperty("--dev-x", `${px}%`);
    el.developerCard.style.setProperty("--dev-y", `${py}%`);

    const rotateY = ((px - 50) / 50) * 7;
    const rotateX = -((py - 50) / 50) * 7;
    el.developerCard.style.setProperty("--dev-rot-x", `${rotateX.toFixed(2)}deg`);
    el.developerCard.style.setProperty("--dev-rot-y", `${rotateY.toFixed(2)}deg`);
  };

  el.developerCard.addEventListener("pointermove", updateFromPointer);
  el.developerCard.addEventListener("pointerleave", () => {
    el.developerCard.style.setProperty("--dev-x", "50%");
    el.developerCard.style.setProperty("--dev-y", "50%");
    el.developerCard.style.setProperty("--dev-rot-x", "0deg");
    el.developerCard.style.setProperty("--dev-rot-y", "0deg");
  });
  el.developerCard.addEventListener("click", () => {
    const willShowBack = !el.developerCard.classList.contains("is-flipped");
    el.developerCard.classList.toggle("is-flipped");

    if (glowTimer) {
      window.clearTimeout(glowTimer);
      glowTimer = null;
    }

    if (willShowBack) {
      el.developerCard.classList.remove("is-glow-active");
      return;
    }

    el.developerCard.classList.remove("is-glow-active");
    glowTimer = window.setTimeout(() => {
      if (!el.developerCard.classList.contains("is-flipped")) {
        el.developerCard.classList.add("is-glow-active");
      }
    }, 640);
  });

  el.developerCard.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  el.developerCard.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  el.developerCard.addEventListener("copy", (event) => {
    event.preventDefault();
  });
  el.developerCard.addEventListener("cut", (event) => {
    event.preventDefault();
  });
  el.developerCard.addEventListener("paste", (event) => {
    event.preventDefault();
  });
}

function resetDeveloperCardToBack() {
  if (!el.developerCard) {
    return;
  }

  el.developerCard.classList.add("is-flipped");
  el.developerCard.classList.remove("is-glow-active");
  el.developerCard.style.setProperty("--dev-x", "50%");
  el.developerCard.style.setProperty("--dev-y", "50%");
  el.developerCard.style.setProperty("--dev-rot-x", "0deg");
  el.developerCard.style.setProperty("--dev-rot-y", "0deg");
}

function normalizePokemonKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDexNumberFromUrl(url) {
  const match = String(url || "").match(/\/pokemon-species\/(\d+)\/?$/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function getGenerationFromDexNumber(dexNumber) {
  if (!dexNumber) {
    return 99;
  }

  if (dexNumber <= 151) return 1;
  if (dexNumber <= 251) return 2;
  if (dexNumber <= 386) return 3;
  if (dexNumber <= 493) return 4;
  if (dexNumber <= 649) return 5;
  if (dexNumber <= 721) return 6;
  if (dexNumber <= 809) return 7;
  if (dexNumber <= 905) return 8;
  return 9;
}

function getSetReleaseTimestamp(set) {
  const stamp = Date.parse(String(set?.releaseDate || ""));
  return Number.isFinite(stamp) ? stamp : 0;
}

function formatSpeciesNameFromSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toCompactPokemonKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildCompactSpeciesMap(speciesDexByName) {
  const compactMap = {};
  for (const [slug, dexNumber] of Object.entries(speciesDexByName || {})) {
    const compactKey = toCompactPokemonKey(slug);
    if (compactKey && dexNumber && !compactMap[compactKey]) {
      compactMap[compactKey] = dexNumber;
    }
  }
  return compactMap;
}

function buildPokemonSlugCandidates(rawName) {
  const normalized = normalizePokemonKey(
    String(rawName || "")
      .replace(/♀/g, " female ")
      .replace(/♂/g, " male ")
  );
  if (!normalized) {
    return [];
  }

  let working = normalized.replace(/^[a-z0-9 .-]+['’]s\s+/, "");
  working = working.replace(/\([^)]*\)/g, " ");
  working = working.replace(/\b(delta species|ex|gx|vmax|vstar|v-union|v|lv\.?x|break|prime|legend|radiant|star)\b/g, " ");
  working = working.replace(/^(alolan|galarian|hisuian|paldean)\s+/, "");
  working = working.replace(/\s+/g, " ").trim();

  const tokens = working.split(" ").filter(Boolean);
  if (!tokens.length) {
    return [];
  }

  const candidates = new Set();
  const joined = tokens.join("-");
  candidates.add(joined);
  candidates.add(joined.replace(/-/g, ""));
  candidates.add(tokens[tokens.length - 1]);
  candidates.add(tokens[0]);

  if (tokens[0] === "mega" || tokens[0] === "m") {
    candidates.add(tokens.slice(1).join("-"));
  }

  if (tokens.length > 1) {
    candidates.add(tokens.slice(0, 2).join("-"));
  }

  return [...candidates].filter(Boolean);
}

function lookupSpeciesFromName(name, speciesDexByName) {
  const compactSpeciesMap = state.pokedex.speciesDexByCompact || {};
  const candidates = buildPokemonSlugCandidates(name);
  for (const slug of candidates) {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) {
      continue;
    }

    const dexNumber =
      speciesDexByName[normalizedSlug] ||
      compactSpeciesMap[toCompactPokemonKey(normalizedSlug)];

    if (dexNumber) {
      return {
        slug: normalizedSlug,
        dexNumber,
        generation: getGenerationFromDexNumber(dexNumber),
        displayName: formatSpeciesNameFromSlug(normalizedSlug)
      };
    }
  }

  return null;
}

function buildPokedexEntries(cards, speciesDexByName) {
  const uniqueBySpecies = new Map();
  const galleryBySpecies = {};

  for (const card of cards) {
    if (normalizePokemonKey(card?.supertype) !== "pokemon") {
      continue;
    }

    const species = lookupSpeciesFromName(card?.name, speciesDexByName);
    const fallbackName = String(card?.name || "").trim();
    const fallbackSlug =
      buildPokemonSlugCandidates(fallbackName)[0] ||
      normalizePokemonKey(fallbackName).replace(/\s+/g, "-");
    const speciesSlug = species?.slug || fallbackSlug;
    const speciesKey = species?.dexNumber ? `dex-${species.dexNumber}` : speciesSlug;

    if (!speciesKey) {
      continue;
    }

    const existing = uniqueBySpecies.get(speciesKey);
    const cardRarityScore = rarityScore(card?.rarity);
    const releaseStamp = getSetReleaseTimestamp(card?.set);

    if (!existing) {
      uniqueBySpecies.set(speciesKey, {
        id: card.id,
        speciesKey,
        speciesSlug,
        name: species?.displayName || fallbackName,
        images: card.images,
        rarity: card.rarity,
        rarityScoreValue: cardRarityScore,
        typeHints: Array.isArray(card.types) ? [...card.types] : [],
        set: card.set,
        number: card.number,
        supertype: card.supertype,
        dexNumber: species?.dexNumber || 0,
        generation: species?.generation || 99,
        latestSetRelease: releaseStamp,
        earliestSetRelease: releaseStamp
      });
    } else {
      existing.latestSetRelease = Math.max(existing.latestSetRelease || 0, releaseStamp || 0);
      if (!existing.earliestSetRelease || (releaseStamp && releaseStamp < existing.earliestSetRelease)) {
        existing.earliestSetRelease = releaseStamp;
      }

      if (cardRarityScore > existing.rarityScoreValue) {
        existing.rarity = card.rarity;
        existing.rarityScoreValue = cardRarityScore;
        existing.images = card.images || existing.images;
        existing.set = card.set || existing.set;
        existing.number = card.number || existing.number;
        existing.id = card.id || existing.id;
      }

      if (!existing.speciesSlug && speciesSlug) {
        existing.speciesSlug = speciesSlug;
      }

      if (Array.isArray(card.types)) {
        const seenTypes = new Set((existing.typeHints || []).map((item) => String(item)));
        for (const type of card.types) {
          const normalizedType = String(type || "").trim();
          if (normalizedType && !seenTypes.has(normalizedType)) {
            seenTypes.add(normalizedType);
            existing.typeHints = existing.typeHints || [];
            existing.typeHints.push(normalizedType);
          }
        }
      }
    }

    if (!galleryBySpecies[speciesKey]) {
      galleryBySpecies[speciesKey] = [];
    }

    const gallery = galleryBySpecies[speciesKey];
    if (!gallery.some((item) => item.id === card.id)) {
      gallery.push({
        id: card.id,
        name: card.name,
        images: card.images,
        types: Array.isArray(card.types) ? [...card.types] : [],
        rarity: card.rarity,
        set: card.set,
        number: card.number,
        supertype: card.supertype,
        latestSetRelease: releaseStamp
      });
    }
  }

  for (const speciesKey of Object.keys(galleryBySpecies)) {
    galleryBySpecies[speciesKey].sort((left, right) => {
      const bySet = (right.latestSetRelease || 0) - (left.latestSetRelease || 0);
      if (bySet) {
        return bySet;
      }

      const byRarity = rarityScore(right.rarity) - rarityScore(left.rarity);
      if (byRarity) {
        return byRarity;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }

  return {
    entries: [...uniqueBySpecies.values()].sort((left, right) => left.name.localeCompare(right.name)),
    galleryBySpecies
  };
}

async function ensureSpeciesDexMapLoaded() {
  if (state.pokedex.speciesMapLoaded) {
    return;
  }

  const now = Date.now();
  try {
    const cachedRaw = localStorage.getItem(STORAGE_KEY_POKEAPI_SPECIES);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      const map = cached?.map;
      const fetchedAt = Number(cached?.fetchedAt || 0);
      const isFresh = now - fetchedAt < 1000 * 60 * 60 * 24 * 14;
      if (map && typeof map === "object" && isFresh) {
        state.pokedex.speciesDexByName = map;
        state.pokedex.speciesDexByCompact = buildCompactSpeciesMap(map);
        state.pokedex.speciesMapLoaded = true;
        return;
      }
    }
  } catch {
    // ignore cache parse errors
  }

  try {
    const localResponse = await fetch("/assets/pokemon/species-dex.json", { cache: "no-store" });
    if (localResponse.ok) {
      const localMap = await localResponse.json();
      if (localMap && typeof localMap === "object") {
        state.pokedex.speciesDexByName = localMap;
        state.pokedex.speciesDexByCompact = buildCompactSpeciesMap(localMap);
        try {
          localStorage.setItem(
            STORAGE_KEY_POKEAPI_SPECIES,
            JSON.stringify({
              fetchedAt: now,
              map: localMap
            })
          );
        } catch {
          // ignore storage quota errors
        }
        state.pokedex.speciesMapLoaded = true;
        return;
      }
    }
  } catch {
    // fall back to empty local map
  }

  state.pokedex.speciesDexByName = {};
  state.pokedex.speciesDexByCompact = {};
  state.pokedex.speciesMapLoaded = true;
}

function getOwnedPokedexSpeciesSet() {
  const ownedCardIds = new Set(state.binder.map((item) => item.id));
  const owned = new Set();
  for (const entry of state.pokedex.entries) {
    const speciesCards = state.pokedex.galleryBySpecies[entry.speciesKey] || [];
    if (speciesCards.some((card) => ownedCardIds.has(card.id))) {
      owned.add(entry.speciesKey);
    }
  }
  return owned;
}

function sortPokedexEntries(entries, ownedSpecies) {
  const list = [...entries];
  const sortMode = state.pokedex.sort;

  list.sort((left, right) => {
    const leftOwned = ownedSpecies.has(left.speciesKey) ? 1 : 0;
    const rightOwned = ownedSpecies.has(right.speciesKey) ? 1 : 0;

    switch (sortMode) {
      case "generation_asc":
        return (
          (left.generation || 99) - (right.generation || 99) ||
          (left.dexNumber || 9999) - (right.dexNumber || 9999) ||
          left.name.localeCompare(right.name)
        );
      case "generation_desc":
        return (
          (right.generation || 0) - (left.generation || 0) ||
          (right.dexNumber || 0) - (left.dexNumber || 0) ||
          left.name.localeCompare(right.name)
        );
      case "name_desc":
        return right.name.localeCompare(left.name);
      case "rarity_desc":
        return (right.rarityScoreValue || 0) - (left.rarityScoreValue || 0) || left.name.localeCompare(right.name);
      case "rarity_asc":
        return (left.rarityScoreValue || 0) - (right.rarityScoreValue || 0) || left.name.localeCompare(right.name);
      case "owned_first":
        return rightOwned - leftOwned || left.name.localeCompare(right.name);
      case "missing_first":
        return leftOwned - rightOwned || left.name.localeCompare(right.name);
      case "set_newest":
        return (right.latestSetRelease || 0) - (left.latestSetRelease || 0) || left.name.localeCompare(right.name);
      case "set_oldest":
        return (left.earliestSetRelease || Number.MAX_SAFE_INTEGER) - (right.earliestSetRelease || Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name);
      case "name_asc":
      default:
        return left.name.localeCompare(right.name);
    }
  });

  return list;
}

function pokemonDbPixelBadgeUrl(speciesKey) {
  const slug = String(speciesKey || "").trim().toLowerCase();
  if (!slug) {
    return "";
  }

  const dexNumber = state.pokedex.speciesDexByName?.[slug];
  if (Number.isFinite(dexNumber) && dexNumber > 0) {
    return `/assets/pokemon/sprites/${dexNumber}.png`;
  }

  return "";
}

function pokemonSpriteFallbackUrl(dexNumber) {
  const dex = Number.parseInt(dexNumber, 10);
  if (Number.isFinite(dex) && dex > 0) {
    return `/assets/pokemon/sprites/${dex}.png`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#e7edf7"/><circle cx="32" cy="32" r="18" fill="#c7d4ea"/><circle cx="32" cy="32" r="8" fill="#9cb1d1"/></svg>'
  )}`;
}

function bindAchievementSpriteFallback(imageElement, badge) {
  const fallbackUrl = pokemonSpriteFallbackUrl(badge?.dexNumber || 0);
  let attemptedFallback = false;

  imageElement.addEventListener("error", () => {
    if (!attemptedFallback) {
      attemptedFallback = true;
      if (fallbackUrl) {
        imageElement.src = fallbackUrl;
        return;
      }
    }

    imageElement.src = "";
  });
}

function getAchievementData() {
  if (!state.pokedex.loaded || !state.pokedex.entries.length) {
    return null;
  }

  const ownedCardIds = new Set(state.binder.map((item) => item.id));
  const allCardsById = new Map();
  const rawSpeciesBadges = [];

  for (const entry of state.pokedex.entries) {
    const gallery = state.pokedex.galleryBySpecies[entry.speciesKey] || [];
    if (!gallery.length) {
      continue;
    }

    let ownedCount = 0;
    let hasWaterType = false;

    for (const card of gallery) {
      if (card?.id && !allCardsById.has(card.id)) {
        allCardsById.set(card.id, card);
      }

      if (ownedCardIds.has(card.id)) {
        ownedCount += 1;
      }

      const types = Array.isArray(card?.types) ? card.types : [];
      if (types.some((type) => String(type || "").toLowerCase() === "water")) {
        hasWaterType = true;
      }
    }

    const unlocked = ownedCount === gallery.length;

    rawSpeciesBadges.push({
      id: `species:${entry.speciesKey}`,
      kind: "species",
      speciesKey: entry.speciesKey,
      title: entry.name,
      unlocked,
      ownedCount,
      totalCount: gallery.length,
      spriteUrl: pokemonDbPixelBadgeUrl(entry.speciesSlug || entry.speciesKey),
      hasWaterType,
      dexNumber: entry.dexNumber || 9999
    });
  }

  const speciesByKey = new Map();
  for (const badge of rawSpeciesBadges) {
    const dedupeKey =
      badge.dexNumber && badge.dexNumber !== 9999
        ? `dex:${badge.dexNumber}`
        : `name:${normalizePokemonKey(badge.title)}`;

    if (!speciesByKey.has(dedupeKey)) {
      speciesByKey.set(dedupeKey, { ...badge });
      continue;
    }

    const existing = speciesByKey.get(dedupeKey);
    existing.ownedCount += badge.ownedCount;
    existing.totalCount += badge.totalCount;
    existing.unlocked = existing.totalCount > 0 && existing.ownedCount >= existing.totalCount;
    existing.hasWaterType = existing.hasWaterType || badge.hasWaterType;

    if ((!existing.spriteUrl || existing.spriteUrl === "") && badge.spriteUrl) {
      existing.spriteUrl = badge.spriteUrl;
      existing.speciesKey = badge.speciesKey;
      existing.id = badge.id;
    }
  }

  const speciesBadges = [...speciesByKey.values()];
  const waterSpeciesTotal = speciesBadges.filter((badge) => badge.hasWaterType).length;
  const waterSpeciesCompleted = speciesBadges.filter(
    (badge) => badge.hasWaterType && badge.unlocked
  ).length;

  speciesBadges.sort((left, right) => {
    const byDex = (left.dexNumber || 9999) - (right.dexNumber || 9999);
    if (byDex) {
      return byDex;
    }

    return String(left.title || "").localeCompare(String(right.title || ""));
  });

  const allCards = [...allCardsById.values()];
  const allCardsCount = allCards.length;
  const allCardsOwnedCount = allCards.filter((card) => ownedCardIds.has(card.id)).length;

  const surgingSet = state.sets.find((set) =>
    String(set?.name || "").toLowerCase().includes("surging sparks")
  );
  const surgingCards = allCards.filter((card) => {
    const setId = String(card?.set?.id || "").toLowerCase();
    const setName = String(card?.set?.name || "").toLowerCase();
    if (surgingSet?.id && setId === String(surgingSet.id).toLowerCase()) {
      return true;
    }

    return setName.includes("surging sparks");
  });
  const surgingOwnedCount = surgingCards.filter((card) => ownedCardIds.has(card.id)).length;

  const specialAchievements = [
    {
      id: "special:all-water-species",
      kind: "special",
      title: "Tidal Curator",
      description: `Complete all Water-type species (${waterSpeciesCompleted}/${waterSpeciesTotal})`,
      unlocked: waterSpeciesTotal > 0 && waterSpeciesCompleted === waterSpeciesTotal,
      secret: true,
      spriteUrl: pokemonDbPixelBadgeUrl("squirtle"),
      dexNumber: 7
    },
    {
      id: "special:surging-sparks-master",
      kind: "special",
      title: "Storm Vault",
      description: `Complete Surging Sparks set (${surgingOwnedCount}/${surgingCards.length})`,
      unlocked: surgingCards.length > 0 && surgingOwnedCount === surgingCards.length,
      secret: true,
      spriteUrl: pokemonDbPixelBadgeUrl("pikachu"),
      dexNumber: 25
    },
    {
      id: "special:all-pokemon-cards",
      kind: "special",
      title: "Pokecards Absolute",
      description: `Obtain all Pokemon cards (${allCardsOwnedCount}/${allCardsCount})`,
      unlocked: allCardsCount > 0 && allCardsOwnedCount === allCardsCount,
      secret: false,
      spriteUrl: pokemonDbPixelBadgeUrl("mew"),
      dexNumber: 151
    }
  ];

  const allAchievements = [...speciesBadges, ...specialAchievements];

  return {
    totalSpecies: speciesBadges.length,
    unlockedSpeciesCount: speciesBadges.filter((badge) => badge.unlocked).length,
    unlockedSpecialCount: specialAchievements.filter((badge) => badge.unlocked).length,
    speciesBadges,
    specialAchievements,
    allAchievements
  };
}

function toggleBadgeShowcase(badgeId, achievementData = null) {
  const normalizedId = String(badgeId || "").trim();
  if (!normalizedId) {
    return;
  }

  const data = achievementData || getAchievementData();
  const unlockedById = new Map(
    (data?.allAchievements || [])
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => [achievement.id, achievement])
  );

  if (!unlockedById.has(normalizedId)) {
    return;
  }

  const nextIds = normalizeBadgeShowcaseIds(state.profile.badgeShowcaseIds);
  const existingIndex = nextIds.indexOf(normalizedId);
  if (existingIndex >= 0) {
    nextIds.splice(existingIndex, 1);
  } else {
    if (nextIds.length >= MAX_SHOWCASE_BADGES) {
      nextIds.shift();
    }
    nextIds.push(normalizedId);
  }

  state.profile.badgeShowcaseIds = nextIds;
  saveBinder();
  renderAchievements();
  renderDashboardBadgeShowcase();
}

function renderDashboardBadgeShowcase() {
  if (!el.dashboardBadgeMeta || !el.dashboardBadgeGrid) {
    return;
  }

  el.dashboardBadgeGrid.innerHTML = "";

  if (!state.pokedex.loaded || !state.pokedex.entries.length) {
    el.dashboardBadgeMeta.textContent = "Open Achievements to load and pin badges.";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No badge showcase yet.";
    el.dashboardBadgeGrid.appendChild(empty);
    return;
  }

  const data = getAchievementData();
  if (!data) {
    el.dashboardBadgeMeta.textContent = "No achievements available yet.";
    return;
  }

  const unlockedById = new Map(
    data.allAchievements
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => [achievement.id, achievement])
  );

  const pinnedIds = normalizeBadgeShowcaseIds(state.profile.badgeShowcaseIds).filter((id) =>
    unlockedById.has(id)
  );

  if (pinnedIds.join("|") !== state.profile.badgeShowcaseIds.join("|")) {
    state.profile.badgeShowcaseIds = pinnedIds;
    saveBinder();
  }

  el.dashboardBadgeMeta.textContent = `${pinnedIds.length}/${MAX_SHOWCASE_BADGES} badges pinned`;

  if (!pinnedIds.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No badges pinned yet. Use Customize to pick your dashboard badges.";
    el.dashboardBadgeGrid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const badgeId of pinnedIds) {
    const badge = unlockedById.get(badgeId);
    if (!badge) {
      continue;
    }

    const item = document.createElement("article");
    item.className = "dashboard-badge-item";

    const sprite = document.createElement("img");
    sprite.className = "dashboard-badge-sprite";
    sprite.loading = "lazy";
    sprite.src = badge.spriteUrl || "";
    sprite.alt = `${badge.title} badge`;
    sprite.referrerPolicy = "no-referrer";
    bindAchievementSpriteFallback(sprite, badge);
    item.appendChild(sprite);

    const title = document.createElement("p");
    title.textContent = badge.title;
    item.appendChild(title);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "dashboard-badge-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      toggleBadgeShowcase(badge.id, data);
    });
    item.appendChild(removeBtn);

    fragment.appendChild(item);
  }

  el.dashboardBadgeGrid.appendChild(fragment);
}

function renderAchievements() {
  if (!el.achievementsMeta || !el.achievementBadgeGrid || !el.achievementSpecialGrid) {
    return;
  }

  el.achievementBadgeGrid.innerHTML = "";
  el.achievementSpecialGrid.innerHTML = "";

  if (state.pokedex.loading && !state.pokedex.loaded) {
    el.achievementsMeta.textContent = "Loading achievements from your Pokecards progress...";
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading achievements...";
    el.achievementBadgeGrid.appendChild(loading);
    return;
  }

  if (state.pokedex.error) {
    el.achievementsMeta.textContent = "Achievements unavailable.";
    const error = document.createElement("div");
    error.className = "empty-state";
    error.textContent = state.pokedex.error;
    el.achievementBadgeGrid.appendChild(error);
    return;
  }

  const data = getAchievementData();
  if (!data) {
    el.achievementsMeta.textContent = "Load your Pokecards to unlock achievements.";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No achievement data yet.";
    el.achievementBadgeGrid.appendChild(empty);
    return;
  }

  const pinnedSet = new Set(state.profile.badgeShowcaseIds);
  const searchQuery = normalizePokemonKey(state.achievementsSearch);
  const filteredSpeciesBadges = searchQuery
    ? data.speciesBadges.filter((badge) => {
      const haystack = normalizePokemonKey(`${badge.title} ${badge.id}`);
      return haystack.includes(searchQuery);
    })
    : data.speciesBadges;
  const filteredSpecialAchievements = searchQuery
    ? data.specialAchievements.filter((achievement) => {
      const haystack = normalizePokemonKey(
        `${achievement.title} ${achievement.description} ${achievement.id}`
      );
      return haystack.includes(searchQuery);
    })
    : data.specialAchievements;
  const filteredTotalCount = filteredSpeciesBadges.length + filteredSpecialAchievements.length;

  el.achievementsMeta.textContent =
    `${data.unlockedSpeciesCount}/${data.totalSpecies} species unlocked • ` +
    `${data.unlockedSpecialCount}/3 special unlocked` +
    (searchQuery ? ` • ${filteredTotalCount} match${filteredTotalCount === 1 ? "" : "es"}` : "");

  const badgeFragment = document.createDocumentFragment();
  for (const badge of filteredSpeciesBadges) {
    const card = document.createElement("article");
    card.className = "achievement-badge-card";
    card.classList.toggle("is-locked", !badge.unlocked);
    card.classList.toggle("is-pinned", pinnedSet.has(badge.id));

    const sprite = document.createElement("img");
    sprite.className = "achievement-badge-sprite";
    sprite.loading = "lazy";
    sprite.src = badge.spriteUrl;
    sprite.alt = `${badge.title} pixel badge`;
    sprite.referrerPolicy = "no-referrer";
    bindAchievementSpriteFallback(sprite, badge);
    card.appendChild(sprite);

    const title = document.createElement("h4");
    title.textContent = badge.title;
    card.appendChild(title);

    const progress = document.createElement("p");
    progress.textContent = `${badge.ownedCount}/${badge.totalCount}`;
    card.appendChild(progress);

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "achievement-pin-btn";
    if (!badge.unlocked) {
      pinBtn.textContent = "Locked";
      pinBtn.disabled = true;
    } else {
      pinBtn.textContent = pinnedSet.has(badge.id) ? "Pinned" : "Pin";
      pinBtn.classList.toggle("is-active", pinnedSet.has(badge.id));
      pinBtn.addEventListener("click", () => {
        toggleBadgeShowcase(badge.id, data);
      });
    }
    card.appendChild(pinBtn);

    badgeFragment.appendChild(card);
  }

  if (!filteredSpeciesBadges.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = searchQuery
      ? "No Pokemon mastery badges match your search."
      : "No Pokemon mastery badges available.";
    el.achievementBadgeGrid.appendChild(empty);
  } else {
    el.achievementBadgeGrid.appendChild(badgeFragment);
  }

  const specialFragment = document.createDocumentFragment();
  for (const achievement of filteredSpecialAchievements) {
    const item = document.createElement("article");
    item.className = "achievement-special-card";
    item.classList.toggle("is-unlocked", achievement.unlocked);
    item.classList.toggle("is-secret", achievement.secret && !achievement.unlocked);
    item.classList.toggle("is-pinned", pinnedSet.has(achievement.id));

    if (achievement.secret && !achievement.unlocked) {
      const mask = document.createElement("div");
      mask.className = "achievement-secret-mask";
      mask.textContent = "?";
      item.appendChild(mask);
    } else {
      const sprite = document.createElement("img");
      sprite.className = "achievement-special-sprite";
      sprite.loading = "lazy";
      sprite.src = achievement.spriteUrl;
      sprite.alt = `${achievement.title} icon`;
      sprite.referrerPolicy = "no-referrer";
      bindAchievementSpriteFallback(sprite, achievement);
      item.appendChild(sprite);
    }

    const title = document.createElement("h4");
    title.textContent = achievement.secret && !achievement.unlocked
      ? "Secret Achievement"
      : achievement.title;
    item.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent = achievement.secret && !achievement.unlocked
      ? "Keep collecting to reveal this hidden challenge."
      : achievement.description;
    item.appendChild(desc);

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "achievement-pin-btn";
    if (!achievement.unlocked) {
      pinBtn.textContent = "Locked";
      pinBtn.disabled = true;
    } else {
      pinBtn.textContent = pinnedSet.has(achievement.id) ? "Pinned" : "Pin";
      pinBtn.classList.toggle("is-active", pinnedSet.has(achievement.id));
      pinBtn.addEventListener("click", () => {
        toggleBadgeShowcase(achievement.id, data);
      });
    }
    item.appendChild(pinBtn);

    specialFragment.appendChild(item);
  }

  if (!filteredSpecialAchievements.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = searchQuery
      ? "No special achievements match your search."
      : "No special achievements available.";
    el.achievementSpecialGrid.appendChild(empty);
  } else {
    el.achievementSpecialGrid.appendChild(specialFragment);
  }
}

function clearOwnedCardsForSpecialTrainerOnce() {
  const normalizedUid = normalizeTrainerCode(state.profile.uid);
  if (normalizedUid !== FULL_COLLECTION_TRAINER_UID) {
    return false;
  }

  try {
    if (localStorage.getItem(STORAGE_KEY_SPECIAL_TRAINER_RESET) === normalizedUid) {
      return false;
    }
  } catch {
    // ignore read errors and continue reset
  }

  state.binders = state.binders.map((binder) => ({
    ...binder,
    entries: []
  }));

  if (!state.binders.length) {
    state.binders = [createDefaultBinderRecord()];
  }

  setActiveBinder(state.activeBinderId || state.binders[0]?.id || "");
  state.profile.name = "";
  state.profile.ign = "";
  state.profile.avatar = "";
  state.profile.favoriteCardIds = [];
  state.profile.wishlistCardIds = [];
  state.profile.badgeShowcaseIds = [];
  state.profile.friends = [];
  state.collectionGoals = [];
  state.goalOpenIds = [];
  state.pokedex.previewCardBySpecies = {};
  state.gacha.packsOpened = 0;
  state.gacha.godPacksOpened = 0;
  state.gacha.lastPulls = [];
  state.gacha.lastPackCount = 0;
  state.gacha.revealQueue = [];
  state.gacha.revealIndex = 0;
  state.gacha.revealStage = "front";
  state.gacha.flipAllRevealed = false;
  state.gacha.revealSetName = "";
  state.gacha.rarestPullCardId = "";
  state.gacha.pullsAddedToBinder = false;
  state.binderCollection.cards = [];
  state.binderCollection.error = "";
  state.binderCollection.loading = false;
  invalidateGoalProgressCache();
  saveBinder();

  try {
    localStorage.setItem(STORAGE_KEY_SPECIAL_TRAINER_RESET, normalizedUid);
  } catch {
    // ignore write errors
  }

  return true;
}

async function ensurePokedexLoaded() {
  if (state.pokedex.loading || state.pokedex.loaded) {
    return;
  }

  state.pokedex.loading = true;
  state.pokedex.error = "";
  renderPokedex();

  try {
    await ensureSpeciesDexMapLoaded();
    const cards = await fetchAllCollectionCards({
      sort: "name_asc",
      pageSize: 120,
      maxPages: 220
    });

    const pokedexData = buildPokedexEntries(cards, state.pokedex.speciesDexByName);
    state.pokedex.entries = pokedexData.entries;
    state.pokedex.galleryBySpecies = pokedexData.galleryBySpecies;
    state.pokedex.loaded = true;
  } catch (error) {
    state.pokedex.error = error.message || "Could not load Pokecards.";
  } finally {
    state.pokedex.loading = false;
    renderPokedex();
    renderAchievements();
    renderDashboard();
    renderInventory();
    renderDashboardBadgeShowcase();
  }
}

function getPokedexCoverCard(entry, ownedSpecies, ownedCardIds) {
  const gallery = state.pokedex.galleryBySpecies[entry.speciesKey] || [];
  const preferredCardId = state.pokedex.previewCardBySpecies[entry.speciesKey];

  if (preferredCardId) {
    const preferred = gallery.find((card) => card.id === preferredCardId);
    if (preferred && ownedCardIds.has(preferred.id)) {
      return preferred;
    }
  }

  if (ownedSpecies.has(entry.speciesKey)) {
    const ownedCover = gallery.find((card) => ownedCardIds.has(card.id));
    if (ownedCover) {
      return ownedCover;
    }
  }

  return entry;
}

function syncPokedexSelectedTile() {
  if (!el.pokedexGrid) {
    return;
  }

  const activeKey = state.pokedex.selectedSpeciesKey;
  const items = el.pokedexGrid.querySelectorAll(".pokedex-item[data-species-key]");
  for (const item of items) {
    item.classList.toggle("is-selected", item.dataset.speciesKey === activeKey);
  }
}

function closePokedexGallery() {
  state.pokedex.selectedSpeciesKey = "";
  syncPokedexSelectedTile();
  renderPokedexGallery();
}

function openPokedexGallery(speciesKey) {
  if (!speciesKey) {
    return;
  }

  state.pokedex.selectedSpeciesKey =
    state.pokedex.selectedSpeciesKey === speciesKey ? "" : speciesKey;
  syncPokedexSelectedTile();
  renderPokedexGallery();

  if (
    state.pokedex.selectedSpeciesKey &&
    el.pokedexGalleryPanel &&
    window.matchMedia("(max-width: 959px)").matches
  ) {
    window.requestAnimationFrame(() => {
      el.pokedexGalleryPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
}

function renderPokedexGallery() {
  if (
    !el.pokedexGalleryPanel ||
    !el.pokedexGalleryTitle ||
    !el.pokedexGalleryMeta ||
    !el.pokedexGalleryGrid
  ) {
    return;
  }

  el.pokedexGalleryGrid.innerHTML = "";
  if (el.pokedexLayout) {
    el.pokedexLayout.classList.remove("has-gallery");
  }

  const speciesKey = state.pokedex.selectedSpeciesKey;
  if (!speciesKey) {
    el.pokedexGalleryPanel.hidden = true;
    return;
  }

  const entry = state.pokedex.entries.find((item) => item.speciesKey === speciesKey);
  const gallery = state.pokedex.galleryBySpecies[speciesKey] || [];
  const ownedCardIds = new Set(state.binder.map((item) => item.id));

  el.pokedexGalleryPanel.hidden = false;
  if (el.pokedexLayout) {
    el.pokedexLayout.classList.add("has-gallery");
  }
  el.pokedexGalleryTitle.textContent = entry?.name ? `${entry.name} Gallery` : "Pokemon Gallery";

  const ownedCount = gallery.filter((card) => ownedCardIds.has(card.id)).length;
  el.pokedexGalleryMeta.textContent = `${ownedCount}/${gallery.length} obtained. Gray cards are still missing.`;

  if (!gallery.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No cards found for this Pokemon yet.";
    el.pokedexGalleryGrid.appendChild(empty);
    return;
  }

  const currentPreviewCardId = state.pokedex.previewCardBySpecies[speciesKey] || "";
  const fragment = document.createDocumentFragment();

  for (const card of gallery) {
    const owned = ownedCardIds.has(card.id);

    const item = document.createElement("article");
    item.className = "pokedex-gallery-card";
    item.classList.toggle("is-unobtained", !owned);
    item.classList.toggle("is-preview", currentPreviewCardId === card.id);

    if (owned) {
      const wishlistBtn = document.createElement("button");
      wishlistBtn.type = "button";
      wishlistBtn.className = "favorite-toggle pokecards-gallery-favorite";
      wishlistBtn.classList.toggle("is-active", isFavoriteCard(card.id));
      wishlistBtn.textContent = isFavoriteCard(card.id) ? "★" : "☆";
      wishlistBtn.setAttribute(
        "aria-label",
        isFavoriteCard(card.id)
          ? `Remove ${card.name} from favorites`
          : `Add ${card.name} to favorites`
      );
      wishlistBtn.addEventListener("click", () => {
        toggleFavoriteCard(card);
      });
      item.appendChild(wishlistBtn);
    }

    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "pokedex-gallery-image-btn";
    imageButton.addEventListener("click", () => {
      openCardModal(card, { grayscale: !owned });
    });

    const image = document.createElement("img");
    image.loading = "lazy";
    applyCardImageSource(image, card, { preferLarge: false });
    image.alt = `${card.name} card`;
    imageButton.appendChild(image);
    item.appendChild(imageButton);

    const meta = document.createElement("p");
    meta.className = "pokedex-gallery-meta";
    meta.textContent = `${card.set?.name || "Set"} | ${card.rarity || "Unknown"}`;
    item.appendChild(meta);

    const valueLine = document.createElement("p");
    valueLine.className = "pokedex-gallery-value";

    const coin = document.createElement("img");
    coin.className = "pokedex-gallery-coin";
    coin.src = "/pokecoin.gif";
    coin.alt = "PokeCoin";
    valueLine.appendChild(coin);

    const value = document.createElement("span");
    value.textContent = formatPokeCoinCount(getCardLastSoldValue(card));
    valueLine.appendChild(value);

    item.appendChild(valueLine);

    if (owned) {
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "pokedex-preview-btn";
      previewBtn.textContent = currentPreviewCardId === card.id ? "Using as Preview" : "Use as Preview";
      previewBtn.disabled = currentPreviewCardId === card.id;
      previewBtn.addEventListener("click", () => {
        state.pokedex.previewCardBySpecies[speciesKey] = card.id;
        saveBinder();
        renderPokedex();
        renderPokedexGallery();
      });
      item.appendChild(previewBtn);
    }

    fragment.appendChild(item);
  }

  el.pokedexGalleryGrid.appendChild(fragment);
}

function renderPokedex() {
  if (!el.pokedexGrid || !el.pokedexMeta) {
    return;
  }

  el.pokedexGrid.innerHTML = "";

  if (el.pokedexSort && el.pokedexSort.value !== state.pokedex.sort) {
    el.pokedexSort.value = state.pokedex.sort;
  }
  if (el.pokedexSearch && el.pokedexSearch.value !== state.pokedex.searchQuery) {
    el.pokedexSearch.value = state.pokedex.searchQuery;
  }
  if (
    el.pokedexOwnershipFilter &&
    el.pokedexOwnershipFilter.value !== state.pokedex.ownershipFilter
  ) {
    el.pokedexOwnershipFilter.value = state.pokedex.ownershipFilter;
  }

  if (state.pokedex.loading) {
    el.pokedexMeta.textContent = "Loading all Pokecards entries...";
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Loading Pokecards...";
    el.pokedexGrid.appendChild(loading);
    renderPokedexGallery();
    return;
  }

  if (state.pokedex.error) {
    el.pokedexMeta.textContent = "Failed to load Pokecards.";
    const error = document.createElement("div");
    error.className = "empty-state";
    error.textContent = state.pokedex.error;
    el.pokedexGrid.appendChild(error);
    renderPokedexGallery();
    return;
  }

  if (!state.pokedex.entries.length) {
    el.pokedexMeta.textContent = "No Pokecards data loaded yet.";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No Pokecards entries available.";
    el.pokedexGrid.appendChild(empty);
    renderPokedexGallery();
    return;
  }

  const ownedSpecies = getOwnedPokedexSpeciesSet();
  const ownedCardIds = new Set(state.binder.map((item) => item.id));
  const sortedEntries = sortPokedexEntries(state.pokedex.entries, ownedSpecies);
  const totalOwnedCount = sortedEntries.filter((entry) => ownedSpecies.has(entry.speciesKey)).length;

  const searchQuery = state.pokedex.searchQuery.trim().toLowerCase();
  let filteredEntries = sortedEntries;

  if (searchQuery) {
    filteredEntries = filteredEntries.filter((entry) => {
      const nameMatch = String(entry.name || "").toLowerCase().includes(searchQuery);
      const dexMatch = String(entry.dexNumber || "").includes(searchQuery);
      return nameMatch || dexMatch;
    });
  }

  if (state.pokedex.ownershipFilter === "owned") {
    filteredEntries = filteredEntries.filter((entry) => ownedSpecies.has(entry.speciesKey));
  } else if (state.pokedex.ownershipFilter === "missing") {
    filteredEntries = filteredEntries.filter((entry) => !ownedSpecies.has(entry.speciesKey));
  }

  if (
    state.pokedex.selectedSpeciesKey &&
    !filteredEntries.some((entry) => entry.speciesKey === state.pokedex.selectedSpeciesKey)
  ) {
    state.pokedex.selectedSpeciesKey = "";
  }

  const filteredOwnedCount = filteredEntries.filter((entry) => ownedSpecies.has(entry.speciesKey)).length;
  el.pokedexMeta.textContent = `${filteredOwnedCount}/${filteredEntries.length} shown • ${totalOwnedCount}/${sortedEntries.length} unlocked total`;

  if (!filteredEntries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No Pokecards match your current search/filter.";
    el.pokedexGrid.appendChild(empty);
    renderPokedexGallery();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of filteredEntries) {
    const owned = ownedSpecies.has(entry.speciesKey);
    const item = document.createElement("article");
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.dataset.speciesKey = entry.speciesKey;
    item.className = "pokedex-item";
    item.classList.toggle("is-unobtained", !owned);
    item.setAttribute("aria-label", `${entry.name} (${owned ? "owned" : "missing"})`);
    item.addEventListener("click", () => {
      openPokedexGallery(entry.speciesKey);
    });
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openPokedexGallery(entry.speciesKey);
    });

    item.classList.toggle("is-selected", state.pokedex.selectedSpeciesKey === entry.speciesKey);

    const coverCard = getPokedexCoverCard(entry, ownedSpecies, ownedCardIds);

    const image = document.createElement("img");
    image.loading = "lazy";
    applyCardImageSource(image, {
      images: {
        large: coverCard.images?.large || entry.images?.large || "",
        small: coverCard.images?.small || entry.images?.small || ""
      }
    }, { preferLarge: false });
    image.alt = `${entry.name} pokecards card`;
    item.appendChild(image);

    const name = document.createElement("p");
    name.textContent = entry.name;
    item.appendChild(name);

    fragment.appendChild(item);
  }

  el.pokedexGrid.appendChild(fragment);
  renderPokedexGallery();
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
  const seed = String(state.profile.ign || "").trim();
  el.trainerAvatarInitial.textContent = seed.charAt(0).toUpperCase() || "?";
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
    invalidateGoalProgressCache();
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

  invalidateGoalProgressCache();
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
  applyCardImageSource(image, card, { preferLarge: false });
  image.alt = `${card.name} trading card`;
  article.appendChild(image);

  const favoriteBtn = document.createElement("button");
  favoriteBtn.type = "button";
  favoriteBtn.className = "favorite-toggle";
  favoriteBtn.classList.toggle("is-active", isWishlistCard(card.id));
  favoriteBtn.textContent = isWishlistCard(card.id) ? "★" : "☆";
  favoriteBtn.setAttribute(
    "aria-label",
    isWishlistCard(card.id) ? `Remove ${card.name} from wishlist` : `Add ${card.name} to wishlist`
  );
  favoriteBtn.addEventListener("click", () => {
    toggleWishlistCard(card);
  });
  article.appendChild(favoriteBtn);

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

  const value = document.createElement("p");
  value.className = "meta-line card-value-line";
  value.textContent = "Value:";

  const coin = document.createElement("img");
  coin.className = "card-value-coin";
  coin.src = "/pokecoin.gif";
  coin.alt = "PokeCoin";
  value.appendChild(coin);

  const valueCount = document.createElement("span");
  valueCount.textContent = formatPokeCoinCount(getCardLastSoldValue(card));
  value.appendChild(valueCount);

  value.setAttribute("aria-label", formatLastSoldValue(card));
  article.appendChild(value);

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
  const cardsToRender = state.query.sort === "wishlist_first"
    ? [...state.cards].sort((left, right) => {
      const leftWish = isWishlistCard(left.id) ? 1 : 0;
      const rightWish = isWishlistCard(right.id) ? 1 : 0;
      if (rightWish !== leftWish) {
        return rightWish - leftWish;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    })
    : state.cards;

  if (!cardsToRender.length) {
    el.cardGrid.appendChild(el.emptyStateTemplate.content.cloneNode(true));
  } else {
    const fragment = document.createDocumentFragment();
    for (const card of cardsToRender) {
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

  const setSearchQuery = normalizePokemonKey(state.gacha.setSearch);
  const visiblePacks = setSearchQuery
    ? state.gacha.packs.filter((pack) => {
      const haystack = normalizePokemonKey(`${pack.name} ${pack.series || ""} ${pack.id}`);
      return haystack.includes(setSearchQuery);
    })
    : state.gacha.packs;

  const hasSelectedPack = state.gacha.packs.some((pack) => pack.id === state.gacha.selectedSetId);
  if (!hasSelectedPack) {
    state.gacha.selectedSetId = "";
    resetGachaPackChoices();
    closeGachaPopout({ force: true });
    void loadAndRenderGachaPreview("");
  }

  if (!visiblePacks.length) {
    const empty = document.createElement("p");
    empty.className = "gacha-pack-picker-empty";
    empty.textContent = "No pack sets match your search.";
    el.gachaPackPicker.appendChild(empty);
    updateGachaPackPickerState();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const pack of visiblePacks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gacha-pack-option";
    button.dataset.setId = pack.id;
    button.setAttribute("role", "option");

    const packOptionArts = [...new Set([
      ...(pack.visual?.boosterArts || []),
      pack.visual?.boosterArt || ""
    ])].filter(Boolean);

    let startPackOptionShuffle = null;
    let stopPackOptionShuffle = null;

    if (packOptionArts.length) {
      const art = document.createElement("img");
      art.className = "gacha-pack-option-art";
      art.src = packOptionArts[0];
      art.alt = `${pack.name} pack art`;
      art.loading = "lazy";
      button.appendChild(art);

      let packOptionShuffleTimer = null;
      let packOptionShuffleIndex = 0;

      const playPackOptionSlide = () => {
        art.classList.remove("is-shuffling-slide");
        void art.offsetWidth;
        art.classList.add("is-shuffling-slide");
      };

      art.addEventListener("animationend", () => {
        art.classList.remove("is-shuffling-slide");
      });

      stopPackOptionShuffle = () => {
        if (packOptionShuffleTimer) {
          window.clearInterval(packOptionShuffleTimer);
          packOptionShuffleTimer = null;
        }
        packOptionShuffleIndex = 0;
        if (art.src !== packOptionArts[0]) {
          art.src = packOptionArts[0];
        }
      };

      startPackOptionShuffle = () => {
        if (
          packOptionArts.length < 2 ||
          packOptionShuffleTimer ||
          state.gacha.opening ||
          state.gacha.revealing
        ) {
          return;
        }

        packOptionShuffleTimer = window.setInterval(() => {
          if (!button.isConnected) {
            stopPackOptionShuffle?.();
            return;
          }

          packOptionShuffleIndex = (packOptionShuffleIndex + 1) % packOptionArts.length;
          art.src = packOptionArts[packOptionShuffleIndex];
          playPackOptionSlide();
        }, 520);
      };
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
      stopPackOptionShuffle?.();

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

    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      startPackOptionShuffle?.();
    });

    const resetOptionTilt = () => {
      button.classList.remove("is-popping");
      button.style.removeProperty("--tilt-x");
      button.style.removeProperty("--tilt-y");
      button.style.removeProperty("--lift-y");
    };

    button.addEventListener("pointerleave", () => {
      resetOptionTilt();
      stopPackOptionShuffle?.();
    });
    button.addEventListener("pointerup", resetOptionTilt);
    button.addEventListener("pointercancel", () => {
      resetOptionTilt();
      stopPackOptionShuffle?.();
    });
    button.addEventListener("blur", () => {
      resetOptionTilt();
      stopPackOptionShuffle?.();
    });

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
  const isSuperHit = glowTier === "ultra";
  const shouldRarestHighlight = isRarest && isSuperHit;
  const container = document.createElement("article");
  container.className = "gacha-card";
  if (isSuperHit) {
    container.classList.add(`rarity-${glowTier}`);
  }
  if (shouldRarestHighlight) {
    container.classList.add("is-rarest");
  }

  if (isSuperHit) {
    const glare = document.createElement("span");
    glare.className = `gacha-card-glare glare-${glowTier}`;
    glare.setAttribute("aria-hidden", "true");
    container.appendChild(glare);
  }

  const image = document.createElement("img");
  image.loading = "lazy";
  applyCardImageSource(image, card);
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
  const isSuperHit = revealTier === "ultra";

  el.modalFlipCard.classList.remove("reveal-tier-rare", "reveal-tier-holo", "reveal-tier-ultra");
  if (isSuperHit) {
    el.modalFlipCard.classList.add(`reveal-tier-${revealTier}`);
  }

  el.modalTiltCard.classList.toggle("is-rarest-reveal", isRarestCard && isSuperHit);
  el.modalFlipCard.classList.toggle("is-rarest-reveal", isRarestCard && isSuperHit);

  const accent = rarityAccent(item.card.rarity);
  el.modalRevealRarity.textContent = item.card.rarity || "Unknown rarity";
  el.modalRevealRarity.style.background = accent.background;
  el.modalRevealRarity.style.borderColor = accent.border;
  const isLastCard = state.gacha.revealIndex >= state.gacha.revealQueue.length - 1;
  el.gachaStatus.textContent = isLastCard
    ? "Last card. Click anywhere to finish."
    : "Swipe this card away to reveal the next card.";

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
  const isLastCard = state.gacha.revealIndex >= state.gacha.revealQueue.length - 1;
  el.gachaStatus.textContent = isLastCard
    ? "Last card. Click anywhere to finish."
    : "Great. Now swipe cards away for each next reveal.";
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
  state.gacha.packsOpened += state.gacha.lastPackCount;
  const godPackHits = state.gacha.lastPulls.filter((packPull) => packPull.godPack).length;
  if (godPackHits > 0) {
    state.gacha.godPacksOpened += godPackHits;
  }
  saveBinder();
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
        ...getAuthHeaders(),
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
  invalidateGoalProgressCache();
  renderCollectionGoals();
  return pulledCards.length;
}

function getGoalCacheKey(goal) {
  return `${goal.type}|${goal.keyword.toLowerCase()}|${goal.setId}`;
}

async function resolveGoalCards(goal) {
  const keyword = goal.keyword.trim();

  if (goal.type === "set" && goal.setId) {
    return fetchAllCollectionCards({
      setId: goal.setId,
      sort: "name_asc"
    });
  }

  if (goal.type === "pokemon") {
    if (!keyword) {
      return [];
    }

    const cards = await fetchAllCollectionCards({
      search: keyword,
      sort: "name_asc"
    });

    const lowered = keyword.toLowerCase();
    return cards.filter((card) => String(card.name || "").toLowerCase().includes(lowered));
  }

  if (goal.type === "custom") {
    let cards = [];
    if (goal.setId) {
      cards = await fetchAllCollectionCards({
        setId: goal.setId,
        sort: "name_asc"
      });
    } else if (keyword) {
      cards = await fetchAllCollectionCards({
        search: keyword,
        sort: "name_asc"
      });
    }

    if (!keyword) {
      return cards;
    }

    const lowered = keyword.toLowerCase();
    return cards.filter((card) => {
      const name = String(card.name || "").toLowerCase();
      const rarity = String(card.rarity || "").toLowerCase();
      const setName = String(card.set?.name || "").toLowerCase();
      return name.includes(lowered) || rarity.includes(lowered) || setName.includes(lowered);
    });
  }

  return [];
}

async function getCollectionGoalProgress(goal) {
  const cacheKey = getGoalCacheKey(goal);
  const cached = state.goalProgressCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const cards = await resolveGoalCards(goal);
  const uniqueMap = new Map();
  for (const card of cards) {
    if (card?.id && !uniqueMap.has(card.id)) {
      uniqueMap.set(card.id, card);
    }
  }

  const uniqueCards = [...uniqueMap.values()];
  const ownedCards = uniqueCards.filter((card) => getBinderEntry(card.id));
  const completion = uniqueCards.length
    ? Math.min((ownedCards.length / uniqueCards.length) * 100, 100)
    : 0;

  const data = {
    total: uniqueCards.length,
    owned: ownedCards.length,
    completion,
    cards: uniqueCards.map((card) => ({
      id: card.id,
      name: card.name,
      images: card.images,
      set: card.set,
      rarity: card.rarity,
      number: card.number
    }))
  };

  state.goalProgressCache.set(cacheKey, data);
  return data;
}

function createGoalCard(goal) {
  const card = document.createElement("article");
  card.className = "goal-card";
  card.dataset.goalId = goal.id;
  card.classList.toggle("is-open", isGoalOpen(goal.id));

  if (goal.boardImage) {
    card.style.setProperty("--goal-bg", `url(${goal.boardImage})`);
    card.classList.add("has-board-image");
  }

  const overlay = document.createElement("div");
  overlay.className = "goal-card-overlay";

  const cover = document.createElement("div");
  cover.className = "goal-card-cover";

  const titleRow = document.createElement("div");
  titleRow.className = "goal-title-row";

  const title = document.createElement("button");
  title.type = "button";
  title.className = "goal-title-btn";
  title.textContent = goal.title;
  title.setAttribute("aria-label", `Edit title for ${goal.title}`);
  title.addEventListener("click", () => {
    const nextTitle = window.prompt("Goal title", goal.title);
    if (nextTitle === null) {
      return;
    }

    const trimmed = nextTitle.trim().slice(0, 50);
    if (!trimmed) {
      return;
    }

    goal.title = trimmed;
    goal.updatedAt = Date.now();
    saveBinder();
    renderCollectionGoals();
  });
  titleRow.appendChild(title);

  const titleActions = document.createElement("div");
  titleActions.className = "goal-title-actions";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "goal-toggle-btn";
  toggleBtn.textContent = isGoalOpen(goal.id) ? "Close" : "Open";
  toggleBtn.addEventListener("click", () => {
    setGoalOpen(goal.id, !isGoalOpen(goal.id));
    renderCollectionGoals();
  });
  titleActions.appendChild(toggleBtn);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "goal-remove-btn";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    const confirmed = window.confirm(`Remove goal board "${goal.title}"?`);
    if (!confirmed) {
      return;
    }

    state.collectionGoals = state.collectionGoals.filter((item) => item.id !== goal.id);
    setGoalOpen(goal.id, false);
    invalidateGoalProgressCache();
    saveBinder();
    renderCollectionGoals();
  });
  titleActions.appendChild(removeBtn);

  titleRow.appendChild(titleActions);

  cover.appendChild(titleRow);

  const descriptor = document.createElement("p");
  const setName = state.sets.find((set) => set.id === goal.setId)?.name;
  if (goal.type === "set") {
    descriptor.textContent = setName ? `Complete set: ${setName}` : "Complete set goal";
  } else if (goal.type === "pokemon") {
    descriptor.textContent = goal.keyword ? `Collect all ${goal.keyword}` : "Pokemon goal";
  } else {
    descriptor.textContent = goal.keyword
      ? `Custom search: ${goal.keyword}`
      : "Custom collection goal";
  }
  cover.appendChild(descriptor);

  const progress = document.createElement("p");
  progress.className = "goal-progress";
  progress.textContent = "Loading progress...";
  cover.appendChild(progress);

  const details = document.createElement("div");
  details.className = "goal-card-details";

  const checklist = document.createElement("div");
  checklist.className = "goal-checklist-grid";
  details.appendChild(checklist);

  overlay.appendChild(cover);
  overlay.appendChild(details);
  card.appendChild(overlay);

  void getCollectionGoalProgress(goal)
    .then((result) => {
      if (!el.goalGrid?.contains(card)) {
        return;
      }
      progress.textContent = `${result.owned} / ${result.total} cards (${result.completion.toFixed(1)}%)`;

      checklist.innerHTML = "";
      if (!result.cards.length) {
        const empty = document.createElement("p");
        empty.className = "goal-checklist-empty";
        empty.textContent = "No cards found for this goal yet.";
        checklist.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const previewCard of result.cards) {
        const hasEntry = Boolean(getBinderEntry(previewCard.id));

        const item = document.createElement("button");
        item.type = "button";
        item.className = "goal-check-item";
        item.classList.toggle("is-unlocked", hasEntry);
        item.classList.toggle("is-locked", !hasEntry);
        item.setAttribute("aria-label", `${previewCard.name} (${hasEntry ? "owned" : "missing"})`);

        const image = document.createElement("img");
        image.loading = "lazy";
        applyCardImageSource(image, previewCard, { preferLarge: false });
        image.alt = `${previewCard.name} card`;
        item.appendChild(image);

        const number = document.createElement("span");
        number.className = "goal-check-number";
        number.textContent = `#${previewCard.number || "?"}`;
        item.appendChild(number);

        if (hasEntry) {
          const mark = document.createElement("span");
          mark.className = "goal-check-mark";
          mark.textContent = "✓";
          item.appendChild(mark);
        }

        item.addEventListener("click", () => {
          openCardModal(previewCard, { grayscale: !hasEntry });
        });

        fragment.appendChild(item);
      }

      checklist.appendChild(fragment);
    })
    .catch((error) => {
      if (!el.goalGrid?.contains(card)) {
        return;
      }
      progress.textContent = `Could not load progress: ${error.message}`;
    });

  return card;
}

function renderCollectionGoals() {
  if (!el.goalGrid) {
    return;
  }

  state.goalOpenIds = state.goalOpenIds.filter((openId) =>
    state.collectionGoals.some((goal) => goal.id === openId)
  );

  el.goalGrid.innerHTML = "";
  if (!state.collectionGoals.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No goal boards yet. Add one to start your custom collection challenge.";
    el.goalGrid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const goal of state.collectionGoals) {
    fragment.appendChild(createGoalCard(goal));
  }
  el.goalGrid.appendChild(fragment);
}

async function addCollectionGoalFromForm() {
  if (!el.goalTitleInput || !el.goalTypeSelect || !el.goalKeywordInput || !el.goalSetSelect) {
    return;
  }

  const title = String(el.goalTitleInput.value || "").trim().slice(0, 50);
  const type = String(el.goalTypeSelect.value || "pokemon");
  const keyword = String(el.goalKeywordInput.value || "").trim().slice(0, 40);
  const setId = String(el.goalSetSelect.value || "");

  if (!title) {
    window.alert("Please add a goal title.");
    return;
  }

  if (type === "pokemon" && !keyword) {
    window.alert("Pokemon goals need a keyword like Gengar.");
    return;
  }

  if (type === "set" && !setId) {
    window.alert("Set goals need a selected set.");
    return;
  }

  state.collectionGoals.unshift(
    normalizeCollectionGoal({
      id: generateCollectionGoalId(),
      title,
      type,
      keyword,
      setId,
      boardImage: "",
      updatedAt: Date.now()
    })
  );

  invalidateGoalProgressCache();
  saveBinder();
  renderCollectionGoals();

  el.goalTitleInput.value = "";
  el.goalKeywordInput.value = "";
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
  applyCardImageSource(image, card, { preferLarge: false });
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

  const favoriteBtn = document.createElement("button");
  favoriteBtn.type = "button";
  favoriteBtn.className = "favorite-toggle";
  favoriteBtn.classList.toggle("is-active", isFavoriteCard(card.id));
  favoriteBtn.textContent = isFavoriteCard(card.id) ? "★" : "☆";
  favoriteBtn.setAttribute(
    "aria-label",
    isFavoriteCard(card.id) ? `Remove ${card.name} from favorites` : `Add ${card.name} to favorites`
  );
  favoriteBtn.addEventListener("click", () => {
    toggleFavoriteCard(card);
  });
  actions.appendChild(favoriteBtn);

  if (entry) {
    const qty = document.createElement("span");
    qty.className = "binder-slot-qty";
    qty.textContent = `Copies owned: ${toPositiveInt(entry.ownedQty, 1)}`;
    actions.appendChild(qty);
  }

  meta.appendChild(actions);

  item.appendChild(meta);

  return item;
}

function renderBinder() {
  const visibleCards = getFilteredBinder();
  el.binderList.innerHTML = "";

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
  el.binderStats.textContent = `${ownedInCollection} / ${totalSlots} obtained | ${totalCopies} total copies`;

  renderCollectionGoals();
  renderPokedex();
  renderDashboard();
  renderAchievements();
  renderInventory();
}

function removeBinderEntry(cardId) {
  state.binder = state.binder.filter((entry) => entry.id !== cardId);
  invalidateGoalProgressCache();
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
  invalidateGoalProgressCache();
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

  if (el.dashboardBadgeCustomizeBtn) {
    el.dashboardBadgeCustomizeBtn.addEventListener("click", () => {
      const achievementsLink = sidebarLinks.find(
        (link) => String(link.dataset.view || "") === "achievements"
      );
      setActiveView(
        "achievements",
        achievementsLink?.dataset.title || "Achievements",
        achievementsLink?.dataset.subtitle || "Unlock and pin your badges.",
        achievementsLink || null
      );
    });
  }

  el.cardModal.addEventListener("click", (event) => {
    const isLastFrontCard =
      state.gacha.revealing &&
      state.gacha.revealStage === "front" &&
      state.gacha.revealIndex >= state.gacha.revealQueue.length - 1;

    if (isLastFrontCard) {
      finishGachaReveal();
      return;
    }

    if (event.target.hasAttribute("data-close-modal")) {
      if (state.gacha.revealing) {
        el.gachaStatus.textContent =
          state.gacha.revealStage === "back"
            ? "Tap card to flip all first."
            : isLastFrontCard
              ? "Last card. Click anywhere to finish."
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

  if (el.gachaAddToBinderBtn) {
    el.gachaAddToBinderBtn.addEventListener("click", () => {
      const addedCount = addGachaPullsToBinder();
      if (addedCount) {
        el.gachaStatus.textContent = `${addedCount} pulled cards added to your binder.`;
        hideGachaDrawReview();
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
      return;
    }

    if (
      state.gacha.revealing &&
      state.gacha.revealStage === "front" &&
      state.gacha.revealIndex >= state.gacha.revealQueue.length - 1
    ) {
      finishGachaReveal();
      return;
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

  if (el.inventorySearch) {
    el.inventorySearch.addEventListener("input", (event) => {
      state.inventory.search = String(event.target.value || "").slice(0, 50);
      renderInventory();
    });
  }

  if (el.inventorySort) {
    el.inventorySort.addEventListener("change", (event) => {
      state.inventory.sort = String(event.target.value || "qty_desc");
      renderInventory();
    });
  }

  if (el.inventoryRarityFilter) {
    el.inventoryRarityFilter.addEventListener("change", (event) => {
      state.inventory.rarity = String(event.target.value || "");
      renderInventory();
    });
  }

  if (el.pokedexSort) {
    el.pokedexSort.addEventListener("change", (event) => {
      const sortValue = String(event.target.value || "generation_asc");
      state.pokedex.sort = POKEDEX_SORT_OPTIONS.includes(sortValue)
        ? sortValue
        : "generation_asc";
      saveBinder();
      renderPokedex();
    });
  }

  if (el.pokedexSearch) {
    el.pokedexSearch.addEventListener("input", (event) => {
      state.pokedex.searchQuery = String(event.target.value || "").slice(0, 50);
      renderPokedex();
      saveBinder();
    });
  }

  if (el.achievementsSearchInput) {
    el.achievementsSearchInput.addEventListener("input", (event) => {
      state.achievementsSearch = String(event.target.value || "").slice(0, 60);
      renderAchievements();
      saveBinder();
    });
  }

  if (el.gachaSetSearchInput) {
    el.gachaSetSearchInput.addEventListener("input", (event) => {
      state.gacha.setSearch = String(event.target.value || "").slice(0, 60);
      renderGachaSetOptions();
    });
  }

  if (el.pokedexOwnershipFilter) {
    el.pokedexOwnershipFilter.addEventListener("change", (event) => {
      const nextValue = String(event.target.value || "all");
      state.pokedex.ownershipFilter = POKEDEX_OWNERSHIP_FILTER_OPTIONS.includes(nextValue)
        ? nextValue
        : "all";
      renderPokedex();
      saveBinder();
    });
  }

  if (el.pokedexGalleryCloseBtn) {
    el.pokedexGalleryCloseBtn.addEventListener("click", () => {
      closePokedexGallery();
    });
  }

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

  if (el.trainerIgnEditBtn) {
    el.trainerIgnEditBtn.addEventListener("click", () => {
      const nextIgn = window.prompt("Set your IGN", state.profile.ign || "");
      if (nextIgn === null) {
        return;
      }

      state.profile.ign = String(nextIgn || "").trim().slice(0, 30);
      saveBinder();
      renderDashboard();
    });
  }

  if (el.addFriendBtn) {
    el.addFriendBtn.addEventListener("click", () => {
      addFriendFromInputs();
    });
  }

  if (el.friendTrainerIdInput) {
    el.friendTrainerIdInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      addFriendFromInputs();
    });
  }

  if (el.friendIgnInput) {
    el.friendIgnInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      addFriendFromInputs();
    });
  }

  if (el.goalTypeSelect && el.goalKeywordInput && el.goalSetSelect) {
    const syncGoalFields = () => {
      const type = String(el.goalTypeSelect.value || "pokemon");
      el.goalKeywordInput.disabled = type === "set";
      el.goalSetSelect.disabled = false;
      if (type === "set") {
        el.goalKeywordInput.value = "";
      }
    };

    el.goalTypeSelect.addEventListener("change", syncGoalFields);
    syncGoalFields();
  }

  if (el.addGoalBtn) {
    el.addGoalBtn.addEventListener("click", () => {
      void addCollectionGoalFromForm();
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
    invalidateGoalProgressCache();
    saveBinder();
    renderCards();
    renderBinder();
  });
}

async function initialize() {
  clearAllPlayerDataOnce();
  loadBinderState();
  let shouldPersistProfile = false;
  const accountUid = normalizeTrainerCode(authUser?.uid || "");
  if (accountUid && state.profile.uid !== accountUid) {
    state.profile.uid = accountUid;
    shouldPersistProfile = true;
  }

  if (authUser?.ingameName && !String(state.profile.ign || "").trim()) {
    state.profile.ign = String(authUser.ingameName).trim().slice(0, 30);
    shouldPersistProfile = true;
  }

  if (authUser?.profilePicture && !String(state.profile.avatar || "").trim()) {
    state.profile.avatar = String(authUser.profilePicture).trim();
    shouldPersistProfile = true;
  }

  if (!state.profile.uid) {
    state.profile.uid = generateTrainerUid();
    shouldPersistProfile = true;
  }

  const loadedCloudState = await loadPlayerStateFromCloud();
  if (loadedCloudState) {
    shouldPersistProfile = false;
  }

  state.profile.favoriteCardIds = normalizeFavoriteCardIds(state.profile.favoriteCardIds);
  state.profile.wishlistCardIds = normalizeWishlistCardIds(state.profile.wishlistCardIds);
  state.profile.badgeShowcaseIds = normalizeBadgeShowcaseIds(state.profile.badgeShowcaseIds);
  state.profile.friends = normalizeFriends(state.profile.friends);
  clearOwnedCardsForSpecialTrainerOnce();
  if (shouldPersistProfile) {
    saveBinder();
  }
  state.gacha.packCount = 1;
  attachEvents();
  updateGachaInfoVisibility();
  hideGachaDrawReview();
  updateAddToBinderButtonState();
  updateGachaBounceLabel();
  renderBinderPicker();
  renderPokedex();
  renderDashboard();
  renderInventory();
  initializeDeveloperCardInteraction();

  if (el.binderCollectionPreset) {
    el.binderCollectionPreset.value = state.binderCollection.preset;
  }
  if (el.pokedexSort) {
    el.pokedexSort.value = state.pokedex.sort;
  }
  if (el.pokedexSearch) {
    el.pokedexSearch.value = state.pokedex.searchQuery;
  }
  if (el.achievementsSearchInput) {
    el.achievementsSearchInput.value = state.achievementsSearch;
  }
  if (el.gachaSetSearchInput) {
    el.gachaSetSearchInput.value = state.gacha.setSearch;
  }
  if (el.pokedexOwnershipFilter) {
    el.pokedexOwnershipFilter.value = state.pokedex.ownershipFilter;
  }
  renderCollectionGoals();

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
  renderGoalSetOptions();
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

  void ensurePokedexLoaded();

  await refreshCards();
  renderBinder();
}

async function startApplication() {
  showAppShell();

  if (appInitialized) {
    updateAuthUserLabel();
    return;
  }

  appInitialized = true;
  await initialize();
}

async function bootAuthenticatedApp() {
  if (el.appShell) {
    el.appShell.hidden = true;
  }

  attachSessionEvents();

  const restored = await restoreAuthFromStorage();
  if (!restored) {
    window.location.replace("/login.html");
    return;
  }

  try {
    await startApplication();
  } catch {
    appInitialized = false;
    clearAuthSession();
    window.location.replace("/login.html");
  }
}

void bootAuthenticatedApp();
