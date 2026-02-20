const STORAGE_KEY_AUTH_TOKEN = "deckAuthTokenV1";
const STORAGE_KEY_AUTH_USER = "deckAuthUserV1";

const ui = {
  identity: document.getElementById("adminIdentity"),
  refreshBtn: document.getElementById("adminRefreshBtn"),
  logoutBtn: document.getElementById("adminLogoutBtn"),
  status: document.getElementById("adminStatus"),
  source: document.getElementById("adminSource"),
  supabase: document.getElementById("adminSupabase"),
  auth: document.getElementById("adminAuth"),
  accounts: document.getElementById("adminAccounts"),
  playerStates: document.getElementById("adminPlayerStates"),
  sets: document.getElementById("adminSets"),
  cards: document.getElementById("adminCards"),
  broadcastMessage: document.getElementById("adminBroadcastMessage"),
  broadcastActive: document.getElementById("adminBroadcastActive"),
  broadcastSaveBtn: document.getElementById("adminBroadcastSaveBtn"),
  broadcastRefreshBtn: document.getElementById("adminBroadcastRefreshBtn"),
  userSearch: document.getElementById("adminUserSearch"),
  usersRefreshBtn: document.getElementById("adminUsersRefreshBtn"),
  usersTable: document.getElementById("adminUsersTable"),
  selectedRefreshBtn: document.getElementById("adminSelectedRefreshBtn"),
  selectedTitle: document.getElementById("adminSelectedUserTitle"),
  selectedMeta: document.getElementById("adminSelectedUserMeta"),
  moderationMinutes: document.getElementById("adminModerationMinutes"),
  moderationReason: document.getElementById("adminModerationReason"),
  banBtn: document.getElementById("adminBanBtn"),
  unbanBtn: document.getElementById("adminUnbanBtn"),
  timeoutBtn: document.getElementById("adminTimeoutBtn"),
  untimeoutBtn: document.getElementById("adminUntimeoutBtn"),
  inventoryBinderId: document.getElementById("adminInventoryBinderId"),
  inventoryCardId: document.getElementById("adminInventoryCardId"),
  inventoryQty: document.getElementById("adminInventoryQty"),
  inventorySetQtyBtn: document.getElementById("adminInventorySetQtyBtn"),
  inventoryAddQtyBtn: document.getElementById("adminInventoryAddQtyBtn"),
  inventoryRemoveBtn: document.getElementById("adminInventoryRemoveBtn"),
  inventorySummary: document.getElementById("adminInventorySummary"),
  bindersList: document.getElementById("adminBindersList")
};

const state = {
  token: "",
  me: null,
  users: [],
  selectedUid: ""
};

function setStatus(text) {
  if (ui.status) {
    ui.status.textContent = String(text || "");
  }
}

function setValue(node, value) {
  if (!node) {
    return;
  }
  node.textContent = value == null ? "-" : String(value);
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${state.token}`
  };
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {})
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorText = payload?.error || `Request failed (${response.status})`;
    throw new Error(errorText);
  }

  return payload;
}

function formatRestriction(user) {
  if (user.bannedUntil) {
    return `Banned until ${new Date(user.bannedUntil).toLocaleString()}`;
  }
  if (user.timeoutUntil) {
    return `Timeout until ${new Date(user.timeoutUntil).toLocaleString()}`;
  }
  return "Active";
}

function renderUsersTable() {
  if (!ui.usersTable) {
    return;
  }

  ui.usersTable.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const user of state.users) {
    const row = document.createElement("tr");
    row.classList.toggle("is-selected", user.uid === state.selectedUid);

    const cells = [
      user.uid,
      user.username,
      user.ingameName || "-",
      user.isAdmin ? "Admin" : "User",
      formatRestriction(user)
    ];

    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = String(value || "-");
      row.appendChild(td);
    }

    const actionTd = document.createElement("td");
    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "ghost";
    pickBtn.textContent = "Select";
    pickBtn.addEventListener("click", () => {
      state.selectedUid = user.uid;
      renderUsersTable();
      void loadSelectedUserState();
    });
    actionTd.appendChild(pickBtn);
    row.appendChild(actionTd);

    fragment.appendChild(row);
  }

  ui.usersTable.appendChild(fragment);
}

function renderInventorySummary(payload) {
  if (!payload) {
    setValue(ui.inventorySummary, "No data loaded.");
    if (ui.bindersList) {
      ui.bindersList.innerHTML = "";
    }
    return;
  }

  const summary = payload.summary || {};
  setValue(
    ui.inventorySummary,
    `${summary.binderCount || 0} binders, ${summary.uniqueCardCount || 0} unique cards, ${summary.totalCopies || 0} copies`
  );

  if (!ui.bindersList) {
    return;
  }

  ui.bindersList.innerHTML = "";
  const binders = Array.isArray(payload.binders) ? payload.binders : [];
  for (const binder of binders) {
    const li = document.createElement("li");
    li.textContent = `${binder.name} (${binder.id}) - ${binder.entryCount || 0} cards / ${binder.totalCopies || 0} copies`;
    ui.bindersList.appendChild(li);
  }
}

async function loadSummary() {
  const data = await apiFetch("/api/admin/summary");
  setValue(ui.source, data.source || "-");
  setValue(ui.supabase, data.supabase ? "Enabled" : "Disabled");
  setValue(ui.auth, data.auth ? "Enabled" : "Disabled");
  setValue(ui.accounts, data.accountCount ?? 0);
  setValue(ui.playerStates, data.playerStateCount ?? 0);
  setValue(ui.sets, data.setCount ?? "-");
  setValue(ui.cards, data.cardCount ?? "-");
  setStatus(`Updated: ${new Date(data.serverTime || Date.now()).toLocaleString()}`);
}

async function loadBroadcast() {
  const data = await apiFetch("/api/broadcast/current");
  if (ui.broadcastMessage) {
    ui.broadcastMessage.value = data.message || "";
  }
  if (ui.broadcastActive) {
    ui.broadcastActive.checked = Boolean(data.active);
  }
}

async function saveBroadcast() {
  const message = String(ui.broadcastMessage?.value || "").trim();
  const active = Boolean(ui.broadcastActive?.checked);

  await apiFetch("/api/admin/broadcast", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message, active })
  });

  setStatus("Broadcast updated.");
}

async function loadUsers() {
  const search = String(ui.userSearch?.value || "").trim();
  const query = new URLSearchParams({ search, limit: "160" });
  const data = await apiFetch(`/api/admin/users?${query.toString()}`);
  state.users = Array.isArray(data.users) ? data.users : [];
  renderUsersTable();
}

async function loadSelectedUserState() {
  if (!state.selectedUid) {
    renderInventorySummary(null);
    setValue(ui.selectedTitle, "Selected User: none");
    setValue(ui.selectedMeta, "Pick a user from the list.");
    return;
  }

  const data = await apiFetch(`/api/admin/users/${encodeURIComponent(state.selectedUid)}/state`);
  const user = data.user || {};
  setValue(ui.selectedTitle, `Selected User: ${user.username || user.uid || state.selectedUid}`);
  setValue(ui.selectedMeta, `${user.uid} • ${user.ingameName || "No IGN"} • ${formatRestriction(user)}`);
  renderInventorySummary(data);
}

async function runModeration(action) {
  if (!state.selectedUid) {
    throw new Error("Select a user first");
  }

  const minutes = Number.parseInt(ui.moderationMinutes?.value || "0", 10) || 0;
  const reason = String(ui.moderationReason?.value || "").trim();

  await apiFetch(`/api/admin/users/${encodeURIComponent(state.selectedUid)}/moderation`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, minutes, reason })
  });

  setStatus(`Moderation action completed: ${action}`);
  await loadUsers();
  await loadSelectedUserState();
}

async function runInventoryOperation(operation) {
  if (!state.selectedUid) {
    throw new Error("Select a user first");
  }

  const cardId = String(ui.inventoryCardId?.value || "").trim();
  if (!cardId) {
    throw new Error("Card ID is required");
  }

  const binderId = String(ui.inventoryBinderId?.value || "").trim();
  const quantity = Number.parseInt(ui.inventoryQty?.value || "1", 10) || 1;

  await apiFetch(`/api/admin/users/${encodeURIComponent(state.selectedUid)}/inventory`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ operation, cardId, binderId, quantity })
  });

  setStatus(`Inventory operation applied: ${operation}`);
  await loadSelectedUserState();
}

async function verifyAdmin() {
  const token = String(localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || "").trim();
  if (!token) {
    window.location.replace("/login.html");
    return false;
  }

  state.token = token;
  const me = await apiFetch("/api/auth/me");
  state.me = me.user || null;
  if (!state.me?.isAdmin) {
    throw new Error("This account does not have admin access");
  }

  setValue(ui.identity, `Signed in as @${state.me.username}`);
  return true;
}

function attachEvents() {
  ui.refreshBtn?.addEventListener("click", () => {
    void bootData();
  });

  ui.logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    window.location.replace("/login.html");
  });

  ui.broadcastRefreshBtn?.addEventListener("click", () => {
    void runSafely(loadBroadcast);
  });

  ui.broadcastSaveBtn?.addEventListener("click", () => {
    void runSafely(saveBroadcast);
  });

  ui.usersRefreshBtn?.addEventListener("click", () => {
    void runSafely(loadUsers);
  });

  ui.userSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSafely(loadUsers);
    }
  });

  ui.selectedRefreshBtn?.addEventListener("click", () => {
    void runSafely(loadSelectedUserState);
  });

  ui.banBtn?.addEventListener("click", () => {
    void runSafely(() => runModeration("ban"));
  });

  ui.unbanBtn?.addEventListener("click", () => {
    void runSafely(() => runModeration("unban"));
  });

  ui.timeoutBtn?.addEventListener("click", () => {
    void runSafely(() => runModeration("timeout"));
  });

  ui.untimeoutBtn?.addEventListener("click", () => {
    void runSafely(() => runModeration("untimeout"));
  });

  ui.inventorySetQtyBtn?.addEventListener("click", () => {
    void runSafely(() => runInventoryOperation("set_qty"));
  });

  ui.inventoryAddQtyBtn?.addEventListener("click", () => {
    void runSafely(() => runInventoryOperation("add_qty"));
  });

  ui.inventoryRemoveBtn?.addEventListener("click", () => {
    void runSafely(() => runInventoryOperation("remove_card"));
  });
}

async function runSafely(handler) {
  try {
    await handler();
  } catch (error) {
    setStatus(error.message || "Operation failed");
  }
}

async function bootData() {
  await loadSummary();
  await loadBroadcast();
  await loadUsers();
  await loadSelectedUserState();
}

async function boot() {
  attachEvents();
  setStatus("Verifying admin session...");

  try {
    const ok = await verifyAdmin();
    if (!ok) {
      return;
    }
    await bootData();
  } catch (error) {
    const text = String(error.message || "").toLowerCase();
    if (text.includes("unauthorized")) {
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
      window.location.replace("/login.html");
      return;
    }

    setStatus(error.message || "Unable to open admin panel");
  }
}

void boot();
