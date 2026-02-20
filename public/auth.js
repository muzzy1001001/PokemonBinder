const STORAGE_KEY_AUTH_TOKEN = "deckAuthTokenV1";
const STORAGE_KEY_AUTH_USER = "deckAuthUserV1";
const AUTH_API_BASE_PATH = "/api/auth";

function setMessage(text, tone = "") {
  const node = document.getElementById("authMessage");
  if (!node) {
    return;
  }

  node.textContent = String(text || "");
  node.classList.toggle("is-error", tone === "error");
  node.classList.toggle("is-success", tone === "success");
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${AUTH_API_BASE_PATH}${endpoint}`, options);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload;
}

function persistSession(token, user) {
  localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, String(token || ""));
  localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user || {}));
}

async function redirectIfAuthenticated() {
  const token = String(localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) || "").trim();
  if (!token) {
    return;
  }

  try {
    const payload = await fetch(`${AUTH_API_BASE_PATH}/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).then((res) => (res.ok ? res.json() : null));

    if (payload?.user) {
      window.location.replace("/");
    }
  } catch {
    // ignore restore errors
  }
}

function setInitialMode() {
  const toggle = document.getElementById("authModeToggle");
  if (!toggle) {
    return;
  }

  const mode = document.body.dataset.authMode === "register" ? "register" : "login";
  toggle.checked = mode === "register";
}

async function onLoginSubmit(event) {
  event.preventDefault();

  const username = String(document.getElementById("authLoginUsername")?.value || "").trim();
  const password = String(document.getElementById("authLoginPassword")?.value || "");
  if (!username || !password) {
    setMessage("Username and password are required.", "error");
    return;
  }

  setMessage("Logging in...");

  try {
    const payload = await request("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    persistSession(payload.token, payload.user || null);
    setMessage("Login successful.", "success");
    window.location.replace("/");
  } catch (error) {
    setMessage(error.message || "Unable to login.", "error");
  }
}

async function onRegisterSubmit(event) {
  event.preventDefault();

  const username = String(document.getElementById("authRegisterUsername")?.value || "").trim();
  const ingameName = String(document.getElementById("authRegisterIngame")?.value || "").trim();
  const password = String(document.getElementById("authRegisterPassword")?.value || "");
  if (!username || !password) {
    setMessage("Username and password are required.", "error");
    return;
  }

  setMessage("Creating account...");

  try {
    const payload = await request("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password, ingameName })
    });

    const toggle = document.getElementById("authModeToggle");
    if (toggle) {
      toggle.checked = false;
    }

    const loginUsername = document.getElementById("authLoginUsername");
    const loginPassword = document.getElementById("authLoginPassword");
    if (loginUsername) {
      loginUsername.value = username;
    }
    if (loginPassword) {
      loginPassword.value = "";
      loginPassword.focus();
    }

    const registerPassword = document.getElementById("authRegisterPassword");
    if (registerPassword) {
      registerPassword.value = "";
    }

    if (payload?.token) {
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    }

    setMessage("Registration complete. Please log in.", "success");
  } catch (error) {
    setMessage(error.message || "Unable to register.", "error");
  }
}

function attachEvents() {
  document.getElementById("authModeToggle")?.addEventListener("change", () => {
    setMessage("");
  });

  document.getElementById("authLoginForm")?.addEventListener("submit", (event) => {
    void onLoginSubmit(event);
  });

  document.getElementById("authRegisterForm")?.addEventListener("submit", (event) => {
    void onRegisterSubmit(event);
  });
}

async function boot() {
  setInitialMode();
  await redirectIfAuthenticated();
  attachEvents();
}

void boot();
