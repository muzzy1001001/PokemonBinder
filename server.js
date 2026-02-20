const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Jimp } = require("jimp");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const POKEMON_TCG_BASE_URL =
  process.env.POKEMON_TCG_BASE_URL || "https://api.pokemontcg.io/v2";
const POKEMON_TCG_API_KEY =
  process.env.POKEMON_TCG_API_KEY || "a535263b-d4af-4f90-a608-62867abc3ebe";
const POKEMON_DATA_SOURCE =
  (process.env.POKEMON_DATA_SOURCE || "auto").toLowerCase();
const POKEMON_GITHUB_DATA_DIR =
  process.env.POKEMON_GITHUB_DATA_DIR ||
  path.join(__dirname, "data", "pokemon-tcg-data");
const LOCAL_CARD_IMAGE_BASE_PATH = "/assets/cards";
const LOCAL_CARD_THUMB_IMAGE_BASE_PATH = "/assets/cards/thumb";
const LOCAL_CARD_IMAGE_DIR = path.join(__dirname, "public", "assets", "cards");
const LOCAL_CARD_THUMB_IMAGE_DIR = path.join(LOCAL_CARD_IMAGE_DIR, "thumb");
const LOCAL_SET_LOGO_BASE_PATH = "/assets/sets/logos";
const LOCAL_SET_SYMBOL_BASE_PATH = "/assets/sets/symbols";
const LOCAL_PACK_ART_BASE_PATH = "/assets/packs";
const LOCAL_PACK_ART_DIR = path.join(__dirname, "public", "assets", "packs");
const PACK_ART_EXTENSIONS = new Set([".avif", ".webp", ".png", ".jpg", ".jpeg"]);
const CARD_THUMB_WIDTH = Math.max(Number.parseInt(process.env.CARD_THUMB_WIDTH || "220", 10) || 220, 120);
const CARD_THUMB_QUALITY = Math.min(
  Math.max(Number.parseInt(process.env.CARD_THUMB_QUALITY || "68", 10) || 68, 35),
  90
);
const LOOSE_SET_NAME_STOP_WORDS = new Set(["and", "set", "ex", "the"]);

const API_SORT_MAP = {
  name_asc: "name",
  name_desc: "-name",
  hp_asc: "hp",
  hp_desc: "-hp",
  newest: "-set.releaseDate",
  oldest: "set.releaseDate"
};

const GACHA_CARDS_PER_PACK = 10;
const GACHA_MAX_PACKS = 8;
const GACHA_GOD_PACK_CHANCE = 0.0075;
const EBAY_SEARCH_URL = "https://www.ebay.com/sch/i.html";
const EBAY_BROWSE_API_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_OAUTH_TOKEN = process.env.EBAY_OAUTH_TOKEN || "";
const PRICE_TRACKER_API_URL =
  process.env.PRICE_TRACKER_API_URL ||
  "https://www.pokemonpricetracker.com/api/v2/cards";
const PRICE_TRACKER_API_TOKEN = process.env.PRICE_TRACKER_API_TOKEN || "";
const PRICE_TRACKER_DAILY_LIMIT = Math.min(
  Math.max(Number.parseInt(process.env.PRICE_TRACKER_DAILY_LIMIT || "85", 10) || 85, 1),
  100
);
const PRICE_TRACKER_CACHE_TTL_MS =
  Math.max(Number.parseInt(process.env.PRICE_TRACKER_CACHE_TTL_HOURS || "24", 10) || 24, 1) *
  60 *
  60 *
  1000;
const PRICE_TRACKER_MAX_LOOKUPS_PER_REQUEST = Math.max(
  Number.parseInt(process.env.PRICE_TRACKER_MAX_LOOKUPS_PER_REQUEST || "12", 10) || 12,
  1
);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY || ""
).trim();
const SUPABASE_PLAYER_STATES_TABLE =
  String(process.env.SUPABASE_PLAYER_STATES_TABLE || "player_states").trim() || "player_states";
const SUPABASE_PLAYER_ACCOUNTS_TABLE =
  String(process.env.SUPABASE_PLAYER_ACCOUNTS_TABLE || "player_accounts").trim() || "player_accounts";
const SUPABASE_ADMIN_BROADCASTS_TABLE =
  String(process.env.SUPABASE_ADMIN_BROADCASTS_TABLE || "admin_broadcasts").trim() ||
  "admin_broadcasts";
const AUTH_JWT_SECRET = String(process.env.AUTH_JWT_SECRET || SUPABASE_SECRET_KEY || "").trim();
const AUTH_TOKEN_TTL = String(process.env.AUTH_TOKEN_TTL || "30d").trim() || "30d";
const ADMIN_SEED_USERNAME = String(process.env.ADMIN_SEED_USERNAME || "yawnthedeveloper").trim();
const ADMIN_SEED_PASSWORD = String(process.env.ADMIN_SEED_PASSWORD || "b1nary1001001l1br@").trim();

const tcgClient = axios.create({
  baseURL: POKEMON_TCG_BASE_URL,
  timeout: 12000,
  headers: {
    "X-Api-Key": POKEMON_TCG_API_KEY
  }
});

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    : null;

const localDataCache = {
  loaded: false,
  loadingPromise: null,
  sets: [],
  cards: [],
  cardsById: new Map()
};

const boosterArtCache = {
  loaded: false,
  loadingPromise: null,
  bySetNameKey: new Map(),
  byCompactSetNameKey: new Map(),
  byLooseSetNameKey: new Map()
};

const cardThumbBuildCache = new Map();

const lastSoldCache = new Map();
let lastSoldApiCooldownUntil = 0;
let ebayLookupBlockedUntil = 0;
const priceTrackerCache = new Map();
const priceTrackerUsage = {
  dateKey: "",
  count: 0
};

const adminBroadcastFallback = {
  active: false,
  message: "",
  updatedBy: "",
  updatedAt: null
};

const moderationFallbackByUid = new Map();

app.use(express.json({ limit: "6mb" }));

function sanitizeSearchTerm(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9\s\-.'!]/g, "")
    .slice(0, 60);
}

function sanitizeSetId(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9\-.]/g, "")
    .slice(0, 20);
}

function sanitizeCardId(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .slice(0, 40);
}

function sanitizeTrainerUid(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 20);
}

function sanitizePlayerStatePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > 2000000) {
      return null;
    }

    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

function sanitizeOptionalText(value, maxLength = 255) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.slice(0, maxLength);
}

function sanitizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 24);
}

function isValidUsername(value) {
  return /^[a-z0-9_.-]{3,24}$/.test(value);
}

function isValidPassword(value) {
  const text = String(value || "");
  return text.length >= 6 && text.length <= 120;
}

function generateTrainerUid() {
  const block = () => Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `PK-${block()}-${block()}`;
}

function createAuthToken(user) {
  if (!AUTH_JWT_SECRET) {
    return "";
  }

  return jwt.sign(
    {
      uid: sanitizeTrainerUid(user?.uid),
      username: sanitizeUsername(user?.username)
    },
    AUTH_JWT_SECRET,
    {
      expiresIn: AUTH_TOKEN_TTL
    }
  );
}

function parseAuthUserFromRequest(req) {
  if (!AUTH_JWT_SECRET) {
    return null;
  }

  const header = String(req.headers?.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, AUTH_JWT_SECRET);
    const uid = sanitizeTrainerUid(payload?.uid);
    const username = sanitizeUsername(payload?.username);
    if (!uid || !username) {
      return null;
    }

    return {
      uid,
      username
    };
  } catch {
    return null;
  }
}

function parseTimestampMs(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAccountBanned(account) {
  return parseTimestampMs(account?.banned_until) > Date.now();
}

function isAccountTimedOut(account) {
  return parseTimestampMs(account?.timeout_until) > Date.now();
}

function sanitizeMinutes(value, fallback = 0, max = 525600) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function buildDefaultServerBinder(uid) {
  return {
    id: `binder-${uid.toLowerCase()}-main`,
    name: "Main Binder",
    entries: []
  };
}

function isMissingColumnError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("column"))
  );
}

function readModerationFallback(uid) {
  const safeUid = sanitizeTrainerUid(uid);
  if (!safeUid) {
    return null;
  }

  return moderationFallbackByUid.get(safeUid) || null;
}

function mergeModerationFallback(uid, account) {
  const fallback = readModerationFallback(uid);
  if (!fallback) {
    return account;
  }

  return {
    ...account,
    banned_until: fallback.banned_until || account?.banned_until || null,
    ban_reason: fallback.ban_reason || account?.ban_reason || null,
    timeout_until: fallback.timeout_until || account?.timeout_until || null,
    timeout_reason: fallback.timeout_reason || account?.timeout_reason || null
  };
}

async function fetchAccountByUid(uid) {
  let result = await supabaseAdmin
    .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
    .select(
      "uid,username,password_hash,ingame_name,profile_picture,is_admin,banned_until,ban_reason,timeout_until,timeout_reason,created_at,updated_at"
    )
    .eq("uid", uid)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabaseAdmin
      .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
      .select("uid,username,password_hash,ingame_name,profile_picture,created_at,updated_at")
      .eq("uid", uid)
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  const normalized = {
    ...result.data,
    is_admin:
      result.data.is_admin === undefined
        ? sanitizeUsername(result.data.username) === sanitizeUsername(ADMIN_SEED_USERNAME)
        : Boolean(result.data.is_admin),
    banned_until: result.data.banned_until || null,
    ban_reason: result.data.ban_reason || null,
    timeout_until: result.data.timeout_until || null,
    timeout_reason: result.data.timeout_reason || null
  };

  return mergeModerationFallback(normalized.uid, normalized);
}

async function fetchAccountByUsername(username) {
  let result = await supabaseAdmin
    .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
    .select(
      "uid,username,password_hash,ingame_name,profile_picture,is_admin,banned_until,ban_reason,timeout_until,timeout_reason,created_at,updated_at"
    )
    .eq("username", username)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabaseAdmin
      .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
      .select("uid,username,password_hash,ingame_name,profile_picture,created_at,updated_at")
      .eq("username", username)
      .maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  const normalized = {
    ...result.data,
    is_admin:
      result.data.is_admin === undefined
        ? sanitizeUsername(result.data.username) === sanitizeUsername(ADMIN_SEED_USERNAME)
        : Boolean(result.data.is_admin),
    banned_until: result.data.banned_until || null,
    ban_reason: result.data.ban_reason || null,
    timeout_until: result.data.timeout_until || null,
    timeout_reason: result.data.timeout_reason || null
  };

  return mergeModerationFallback(normalized.uid, normalized);
}

async function requireAuthAccount(req, res, options = {}) {
  const requireAdmin = Boolean(options.requireAdmin);
  const allowTimedOut = options.allowTimedOut !== false;

  if (!authConfigReady()) {
    res.status(503).json({
      error: "Auth is not configured"
    });
    return null;
  }

  const authUser = parseAuthUserFromRequest(req);
  if (!authUser) {
    res.status(401).json({
      error: "Unauthorized"
    });
    return null;
  }

  let account = null;
  try {
    account = await fetchAccountByUid(authUser.uid);
  } catch (error) {
    res.status(500).json({
      error: "Unable to load account",
      details: error.message
    });
    return null;
  }

  if (!account) {
    res.status(401).json({
      error: "Unauthorized"
    });
    return null;
  }

  if (isAccountBanned(account)) {
    res.status(403).json({
      error: "Account is banned",
      bannedUntil: account.banned_until,
      reason: sanitizeOptionalText(account.ban_reason, 180)
    });
    return null;
  }

  if (!allowTimedOut && isAccountTimedOut(account)) {
    res.status(403).json({
      error: "Account is temporarily timed out",
      timeoutUntil: account.timeout_until,
      reason: sanitizeOptionalText(account.timeout_reason, 180)
    });
    return null;
  }

  if (requireAdmin && !Boolean(account.is_admin)) {
    res.status(403).json({
      error: "Admin access required"
    });
    return null;
  }

  return {
    authUser,
    account
  };
}

function authConfigReady() {
  return Boolean(supabaseAdmin && AUTH_JWT_SECRET);
}

async function getSupabaseTableCount(tableName) {
  if (!supabaseAdmin || !tableName) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from(tableName)
    .select("uid", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return Number.isFinite(count) ? count : 0;
}

function extractPlayerProfileSnapshot(uid, statePayload) {
  const profile = statePayload?.profile || {};
  return {
    profileId: sanitizeTrainerUid(profile.uid) || uid,
    igname: sanitizeOptionalText(profile.ign || profile.name, 40),
    profilePicture: sanitizeOptionalText(profile.avatar, 600)
  };
}

function localCardImagePath(cardId) {
  return path.join(LOCAL_CARD_IMAGE_DIR, `${cardId}.png`);
}

function localCardThumbImagePath(cardId) {
  return path.join(LOCAL_CARD_THUMB_IMAGE_DIR, `${cardId}.jpg`);
}

async function ensureCardThumbBuilt(cardId) {
  if (!cardId) {
    return false;
  }

  const sourcePath = localCardImagePath(cardId);
  const thumbPath = localCardThumbImagePath(cardId);
  if (fs.existsSync(thumbPath)) {
    return true;
  }

  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  const existingBuild = cardThumbBuildCache.get(cardId);
  if (existingBuild) {
    return existingBuild;
  }

  const buildPromise = (async () => {
    try {
      await fsPromises.mkdir(LOCAL_CARD_THUMB_IMAGE_DIR, { recursive: true });
      const image = await Jimp.read(sourcePath);
      image.resize({ w: CARD_THUMB_WIDTH });
      await image.write(thumbPath, {
        quality: CARD_THUMB_QUALITY
      });
      return true;
    } catch (error) {
      console.warn(`Unable to build card thumbnail for ${cardId}:`, error.message);
      return false;
    } finally {
      cardThumbBuildCache.delete(cardId);
    }
  })();

  cardThumbBuildCache.set(cardId, buildPromise);
  return buildPromise;
}

function isTruthyQueryValue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "on", "all"].includes(normalized);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function currentUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function refreshPriceTrackerUsageWindow() {
  const dateKey = currentUtcDateKey();
  if (priceTrackerUsage.dateKey !== dateKey) {
    priceTrackerUsage.dateKey = dateKey;
    priceTrackerUsage.count = 0;
  }
}

function canUsePriceTracker() {
  if (!PRICE_TRACKER_API_TOKEN) {
    return false;
  }

  refreshPriceTrackerUsageWindow();
  return priceTrackerUsage.count < PRICE_TRACKER_DAILY_LIMIT;
}

function parseTcgPlayerProductId(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\d+$/.test(text)) {
    return text;
  }

  const productMatch = text.match(/\/product\/(\d+)/i);
  if (productMatch) {
    return productMatch[1];
  }

  const fallbackMatch = text.match(/(\d{5,})/);
  return fallbackMatch ? fallbackMatch[1] : "";
}

function extractTcgPlayerProductId(card) {
  if (!card || typeof card !== "object") {
    return "";
  }

  const directCandidates = [
    card?.tcgplayer?.tcgplayerId,
    card?.tcgplayer?.productId,
    card?.tcgplayer?.id,
    card?.tcgPlayerId
  ];

  for (const candidate of directCandidates) {
    const parsed = parseTcgPlayerProductId(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return parseTcgPlayerProductId(card?.tcgplayer?.url);
}

function extractPriceTrackerValue(payload) {
  const card = payload?.data;
  if (!card || typeof card !== "object") {
    return 0;
  }

  const prices = card?.prices || {};
  const candidates = [
    Number.parseFloat(prices.market),
    Number.parseFloat(prices.low)
  ];

  const variants = prices?.variants;
  if (variants && typeof variants === "object") {
    for (const printing of Object.values(variants)) {
      if (!printing || typeof printing !== "object") {
        continue;
      }

      for (const conditionValue of Object.values(printing)) {
        if (!conditionValue || typeof conditionValue !== "object") {
          continue;
        }

        candidates.push(Number.parseFloat(conditionValue.price));
      }
    }
  }

  for (const candidate of candidates) {
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return 0;
}

function normalizeCardNumberForMatch(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return { full: "", base: "" };
  }

  const full = text.replace(/[^a-z0-9/]/g, "");
  const base = full.split("/")[0];
  return { full, base };
}

function scorePriceTrackerCandidate(candidate, card) {
  let score = 0;

  const targetName = normalizeText(card?.name);
  const targetSet = normalizeText(card?.set?.name);
  const targetRarity = normalizeText(card?.rarity);
  const targetArtist = normalizeText(card?.artist);
  const targetNumber = normalizeCardNumberForMatch(card?.number);

  const candidateName = normalizeText(candidate?.name);
  const candidateSet = normalizeText(candidate?.setName);
  const candidateRarity = normalizeText(candidate?.rarity);
  const candidateArtist = normalizeText(candidate?.artist);
  const candidateNumber = normalizeCardNumberForMatch(candidate?.cardNumber);

  if (targetNumber.full && candidateNumber.full === targetNumber.full) {
    score += 10;
  } else if (targetNumber.base && candidateNumber.base === targetNumber.base) {
    score += 7;
  }

  if (targetName && candidateName === targetName) {
    score += 6;
  } else if (targetName && candidateName.includes(targetName)) {
    score += 3;
  }

  if (targetSet && candidateSet.includes(targetSet)) {
    score += 4;
  }

  if (targetRarity && candidateRarity === targetRarity) {
    score += 2;
  }

  if (targetArtist && candidateArtist === targetArtist) {
    score += 2;
  }

  return score;
}

function pickPriceTrackerCardEntry(responsePayload, card) {
  const data = responsePayload?.data;
  const candidates = Array.isArray(data) ? data : data ? [data] : [];
  if (!candidates.length) {
    return null;
  }

  let best = candidates[0];
  let bestScore = scorePriceTrackerCandidate(best, card);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const score = scorePriceTrackerCandidate(candidate, card);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function estimatePriceTrackerCost(responsePayload, fallbackCost = 1) {
  const explicit = Number.parseInt(responsePayload?.metadata?.apiCallsConsumed?.total, 10);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const count = Number.parseInt(responsePayload?.metadata?.count, 10);
  if (Number.isFinite(count) && count > 0) {
    return count;
  }

  return fallbackCost;
}

async function fetchPriceTrackerValueForCard(card, budget = null) {
  if (!canUsePriceTracker()) {
    return 0;
  }

  const tcgPlayerId = extractTcgPlayerProductId(card);
  const cacheKey = tcgPlayerId
    ? `tcg:${tcgPlayerId}`
    : card?.id
      ? `card:${sanitizeCardId(card.id)}`
      : "";

  if (!tcgPlayerId && !cacheKey) {
    return 0;
  }

  const reservedCost = tcgPlayerId ? 1 : 3;
  if (priceTrackerUsage.count + reservedCost > PRICE_TRACKER_DAILY_LIMIT) {
    return 0;
  }

  if (budget && budget.remaining < reservedCost) {
    return 0;
  }

  const cached = priceTrackerCache.get(cacheKey);
  if (
    cached &&
    Date.now() - cached.fetchedAt < PRICE_TRACKER_CACHE_TTL_MS &&
    Number.isFinite(cached.value)
  ) {
    return Math.max(cached.value, 0);
  }

  if (budget) {
    budget.remaining -= reservedCost;
  }

  try {
    const params = tcgPlayerId
      ? { tcgPlayerId }
      : {
          search: `${String(card?.name || "").trim()} ${String(card?.number || "").trim()}`.trim(),
          set: String(card?.set?.name || "").trim(),
          limit: 3
        };

    for (const [key, value] of Object.entries(params)) {
      if (value === "") {
        delete params[key];
      }
    }

    const response = await axios.get(PRICE_TRACKER_API_URL, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${PRICE_TRACKER_API_TOKEN}`
      },
      params
    });

    const matchedCard = pickPriceTrackerCardEntry(response.data, card);
    const value = matchedCard
      ? extractPriceTrackerValue({ data: matchedCard })
      : 0;
    const actualCost = estimatePriceTrackerCost(response.data, reservedCost);
    priceTrackerUsage.count += actualCost;
    if (budget) {
      budget.remaining += Math.max(reservedCost - actualCost, 0);
    }

    priceTrackerCache.set(cacheKey, {
      value,
      fetchedAt: Date.now()
    });

    return value;
  } catch {
    priceTrackerUsage.count += reservedCost;

    priceTrackerCache.set(cacheKey, {
      value: 0,
      fetchedAt: Date.now()
    });
    return 0;
  }
}

function parseDate(value) {
  if (!value) {
    return 0;
  }

  const time = Date.parse(String(value).replace(/\//g, "-"));
  return Number.isNaN(time) ? 0 : time;
}

function hpValue(card) {
  const value = Number.parseInt(card.hp || "", 10);
  return Number.isNaN(value) ? -1 : value;
}

function extractLastSoldValue(card) {
  if (!card || typeof card !== "object") {
    return 0;
  }

  const candidates = [];
  const tcgPrices = card.tcgplayer?.prices || {};

  for (const variant of Object.values(tcgPrices)) {
    if (!variant || typeof variant !== "object") {
      continue;
    }

    const market = Number.parseFloat(variant.market);
    const mid = Number.parseFloat(variant.mid);
    const low = Number.parseFloat(variant.low);

    if (Number.isFinite(market) && market > 0) {
      candidates.push(market);
    }
    if (Number.isFinite(mid) && mid > 0) {
      candidates.push(mid);
    }
    if (Number.isFinite(low) && low > 0) {
      candidates.push(low);
    }
  }

  const cardmarket = card.cardmarket?.prices || {};
  const trend = Number.parseFloat(cardmarket.trendPrice);
  const averageSellPrice = Number.parseFloat(cardmarket.averageSellPrice);
  const avg1 = Number.parseFloat(cardmarket.avg1);
  const avg7 = Number.parseFloat(cardmarket.avg7);

  if (Number.isFinite(trend) && trend > 0) {
    candidates.push(trend);
  }
  if (Number.isFinite(averageSellPrice) && averageSellPrice > 0) {
    candidates.push(averageSellPrice);
  }
  if (Number.isFinite(avg1) && avg1 > 0) {
    candidates.push(avg1);
  }
  if (Number.isFinite(avg7) && avg7 > 0) {
    candidates.push(avg7);
  }

  return candidates.length ? candidates[0] : 0;
}

function buildEbaySearchQuery(card) {
  if (!card) {
    return "";
  }

  const parts = [
    card.name,
    card.number,
    card.set?.name,
    "pokemon",
    "psa 10"
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return parts.join(" ").slice(0, 120);
}

async function fetchEbayLastSoldValueViaApi(card) {
  if (!EBAY_OAUTH_TOKEN) {
    return 0;
  }

  const query = buildEbaySearchQuery(card);
  if (!query) {
    return 0;
  }

  try {
    const response = await axios.get(EBAY_BROWSE_API_URL, {
      timeout: 12000,
      headers: {
        Authorization: `Bearer ${EBAY_OAUTH_TOKEN}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      },
      params: {
        q: query,
        filter: "soldItems:{true}",
        limit: 12,
        sort: "-price"
      }
    });

    const items = Array.isArray(response.data?.itemSummaries)
      ? response.data.itemSummaries
      : [];
    const prices = items
      .map((item) => Number.parseFloat(item?.price?.value))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 100000);

    return median(prices);
  } catch {
    return 0;
  }
}

function parseEbayPricesFromHtml(html) {
  if (!html) {
    return [];
  }

  const prices = [];
  const itemPriceRegex = /s-item__price[^>]*>\s*(?:US\s*)?\$([0-9][0-9,]*(?:\.[0-9]{2})?)/gi;
  let match = itemPriceRegex.exec(html);

  while (match) {
    const value = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value >= 2 && value <= 100000) {
      prices.push(value);
    }
    match = itemPriceRegex.exec(html);
  }

  if (prices.length) {
    return prices;
  }

  const fallbackRegex = /\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g;
  let fallbackMatch = fallbackRegex.exec(html);
  while (fallbackMatch) {
    const value = Number.parseFloat(fallbackMatch[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value >= 2 && value <= 100000) {
      prices.push(value);
    }
    fallbackMatch = fallbackRegex.exec(html);
  }

  return prices;
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

async function fetchEbayLastSoldValue(card) {
  if (Date.now() < ebayLookupBlockedUntil) {
    return 0;
  }

  const query = buildEbaySearchQuery(card);
  if (!query) {
    return 0;
  }

  try {
    const response = await axios.get(EBAY_SEARCH_URL, {
      timeout: 12000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      },
      params: {
        _nkw: query,
        LH_Sold: 1,
        LH_Complete: 1,
        _sop: 13
      }
    });

    const html = String(response.data || "");
    if (
      html.includes("Pardon Our Interruption") ||
      html.includes("ChallengeGet") ||
      html.includes("_challenge")
    ) {
      ebayLookupBlockedUntil = Date.now() + 15 * 60 * 1000;
      return 0;
    }

    const prices = parseEbayPricesFromHtml(html).slice(0, 18);
    return median(prices);
  } catch {
    ebayLookupBlockedUntil = Date.now() + 5 * 60 * 1000;
    return 0;
  }
}

async function resolveLastSoldValue(cardId, options = {}) {
  const priceTrackerBudget = options.priceTrackerBudget || null;
  const sanitizedId = sanitizeCardId(cardId);
  if (!sanitizedId) {
    return 0;
  }

  if (lastSoldCache.has(sanitizedId)) {
    return lastSoldCache.get(sanitizedId) || 0;
  }

  let cardForLookup = null;

  if (localDataCache.loaded) {
    const localCard = localDataCache.cardsById.get(sanitizedId);
    cardForLookup = localCard || cardForLookup;
    const priceTrackerValue = await fetchPriceTrackerValueForCard(cardForLookup, priceTrackerBudget);
    if (priceTrackerValue > 0) {
      lastSoldCache.set(sanitizedId, priceTrackerValue);
      return priceTrackerValue;
    }

    const localValue = extractLastSoldValue(localCard);
    if (localValue > 0) {
      lastSoldCache.set(sanitizedId, localValue);
      return localValue;
    }
  }

  if (Date.now() < lastSoldApiCooldownUntil) {
    lastSoldCache.set(sanitizedId, 0);
    return 0;
  }

  try {
    const response = await tcgClient.get(`/cards/${encodeURIComponent(sanitizedId)}`, {
      params: {
        select: "id,name,number,set,tcgplayer,cardmarket"
      }
    });

    const fetchedCard = response.data?.data || null;
    cardForLookup = fetchedCard || cardForLookup;

    const priceTrackerValue = await fetchPriceTrackerValueForCard(cardForLookup, priceTrackerBudget);
    if (priceTrackerValue > 0) {
      lastSoldCache.set(sanitizedId, priceTrackerValue);
      return priceTrackerValue;
    }

    const value = extractLastSoldValue(fetchedCard);
    if (value > 0) {
      lastSoldCache.set(sanitizedId, value);
      return value;
    }
  } catch {
    lastSoldApiCooldownUntil = Date.now() + 60000;
  }

  const ebayApiValue = await fetchEbayLastSoldValueViaApi(cardForLookup);
  if (ebayApiValue > 0) {
    lastSoldCache.set(sanitizedId, ebayApiValue);
    return ebayApiValue;
  }

  const ebayValue = await fetchEbayLastSoldValue(cardForLookup);
  lastSoldCache.set(sanitizedId, ebayValue);
  return ebayValue;
}

function hasLocalDataFiles() {
  const setsPath = path.join(POKEMON_GITHUB_DATA_DIR, "sets", "en.json");
  const cardsPath = path.join(POKEMON_GITHUB_DATA_DIR, "cards", "en");
  return fs.existsSync(setsPath) && fs.existsSync(cardsPath);
}

function getActiveSource() {
  if (POKEMON_DATA_SOURCE === "api") {
    return "api";
  }

  if (POKEMON_DATA_SOURCE === "github") {
    return "github";
  }

  return hasLocalDataFiles() ? "github" : "api";
}

async function ensureLocalDataLoaded() {
  if (localDataCache.loaded) {
    return;
  }

  if (localDataCache.loadingPromise) {
    await localDataCache.loadingPromise;
    return;
  }

  localDataCache.loadingPromise = (async () => {
    const setsPath = path.join(POKEMON_GITHUB_DATA_DIR, "sets", "en.json");
    const cardsDir = path.join(POKEMON_GITHUB_DATA_DIR, "cards", "en");

    const [setsRaw, cardFileNames] = await Promise.all([
      fsPromises.readFile(setsPath, "utf8"),
      fsPromises.readdir(cardsDir)
    ]);

    const sets = JSON.parse(setsRaw);
    const setById = new Map(sets.map((set) => [set.id, set]));
    const cards = [];

    const jsonFiles = cardFileNames.filter((name) => name.endsWith(".json"));

    for (const fileName of jsonFiles) {
      const setId = path.basename(fileName, ".json");
      const set = setById.get(setId) || {
        id: setId,
        name: setId,
        series: "Unknown",
        releaseDate: ""
      };

      const filePath = path.join(cardsDir, fileName);
      const cardsRaw = await fsPromises.readFile(filePath, "utf8");
      const entries = JSON.parse(cardsRaw);

      for (const card of entries) {
        cards.push({
          id: card.id,
          name: card.name,
          images: card.images,
          hp: card.hp,
          types: card.types,
          rarity: card.rarity,
          set,
          number: card.number,
          supertype: card.supertype,
          subtypes: card.subtypes,
          tcgplayer: card.tcgplayer,
          cardmarket: card.cardmarket
        });
      }
    }

    localDataCache.sets = sets;
    localDataCache.cards = cards;
    localDataCache.cardsById = new Map(cards.map((card) => [card.id, card]));
    localDataCache.loaded = true;
    localDataCache.loadingPromise = null;
  })();

  await localDataCache.loadingPromise;
}

function sortLocalCards(cards, sort) {
  const sorted = [...cards];

  sorted.sort((left, right) => {
    switch (sort) {
      case "name_desc":
        return right.name.localeCompare(left.name);
      case "hp_asc":
        return hpValue(left) - hpValue(right);
      case "hp_desc":
        return hpValue(right) - hpValue(left);
      case "newest":
        return parseDate(right.set?.releaseDate) - parseDate(left.set?.releaseDate);
      case "oldest":
        return parseDate(left.set?.releaseDate) - parseDate(right.set?.releaseDate);
      case "name_asc":
      default:
        return left.name.localeCompare(right.name);
    }
  });

  return sorted;
}

function normalizeSetNameKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCompactSetNameKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizeLooseSetNameKey(value) {
  const tokens = normalizeSetNameKey(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !LOOSE_SET_NAME_STOP_WORDS.has(token));
  return tokens.join("");
}

function stripPackArtSuffix(value) {
  return String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_\s]*pack[-_\s]*\d+$/i, "")
    .trim();
}

function addBoosterArtEntries(map, key, urls) {
  if (!key || !urls.length) {
    return;
  }

  const existing = map.get(key);
  if (!existing) {
    map.set(key, [...urls]);
    return;
  }

  const seen = new Set(existing);
  for (const url of urls) {
    if (!seen.has(url)) {
      existing.push(url);
      seen.add(url);
    }
  }
}

function buildBoosterArtNameCandidates(setName) {
  const baseName = String(setName || "").trim();
  if (!baseName) {
    return [];
  }

  const candidates = [baseName];
  const strippedNames = [
    baseName.replace(/\s+trainer\s+gallery$/i, ""),
    baseName.replace(/\s+galarian\s+gallery$/i, ""),
    baseName.replace(/\s+shiny\s+vault$/i, ""),
    baseName.replace(/\s+energies$/i, "")
  ]
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => name !== baseName);

  const seen = new Set(candidates);
  for (const name of strippedNames) {
    if (!seen.has(name)) {
      candidates.push(name);
      seen.add(name);
    }
  }

  return candidates;
}

async function ensureBoosterArtLoaded() {
  if (boosterArtCache.loaded) {
    return;
  }

  if (boosterArtCache.loadingPromise) {
    await boosterArtCache.loadingPromise;
    return;
  }

  boosterArtCache.loadingPromise = (async () => {
    const bySetNameKey = new Map();
    const byCompactSetNameKey = new Map();
    const byLooseSetNameKey = new Map();

    try {
      const setDirEntries = await fsPromises.readdir(LOCAL_PACK_ART_DIR, {
        withFileTypes: true
      });

      for (const setDirEntry of setDirEntries) {
        if (!setDirEntry.isDirectory()) {
          continue;
        }

        const setDirName = setDirEntry.name;
        const setDirPath = path.join(LOCAL_PACK_ART_DIR, setDirName);
        const packFileEntries = await fsPromises.readdir(setDirPath, {
          withFileTypes: true
        });

        const packFiles = packFileEntries
          .filter((fileEntry) => {
            if (!fileEntry.isFile()) {
              return false;
            }

            const extension = path.extname(fileEntry.name).toLowerCase();
            return PACK_ART_EXTENSIONS.has(extension);
          })
          .map((fileEntry) => fileEntry.name)
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

        if (!packFiles.length) {
          continue;
        }

        const urls = packFiles.map((fileName) => {
          return `${LOCAL_PACK_ART_BASE_PATH}/${encodeURIComponent(setDirName)}/${encodeURIComponent(fileName)}`;
        });

        const rawKeyCandidates = new Set([setDirName, stripPackArtSuffix(setDirName)]);
        for (const fileName of packFiles) {
          rawKeyCandidates.add(fileName);
          rawKeyCandidates.add(stripPackArtSuffix(fileName));
        }

        for (const rawKey of rawKeyCandidates) {
          const setNameKey = normalizeSetNameKey(rawKey);
          const compactSetNameKey = normalizeCompactSetNameKey(rawKey);
          const looseSetNameKey = normalizeLooseSetNameKey(rawKey);
          addBoosterArtEntries(bySetNameKey, setNameKey, urls);
          addBoosterArtEntries(byCompactSetNameKey, compactSetNameKey, urls);
          addBoosterArtEntries(byLooseSetNameKey, looseSetNameKey, urls);
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("Unable to load local pack art:", error.message);
      }
    }

    boosterArtCache.bySetNameKey = bySetNameKey;
    boosterArtCache.byCompactSetNameKey = byCompactSetNameKey;
    boosterArtCache.byLooseSetNameKey = byLooseSetNameKey;
    boosterArtCache.loaded = true;
    boosterArtCache.loadingPromise = null;
  })();

  await boosterArtCache.loadingPromise;
}

function getBoosterArtForSetName(setName) {
  if (
    !boosterArtCache.bySetNameKey.size &&
    !boosterArtCache.byCompactSetNameKey.size &&
    !boosterArtCache.byLooseSetNameKey.size
  ) {
    return [];
  }

  const nameCandidates = buildBoosterArtNameCandidates(setName);
  for (const candidate of nameCandidates) {
    const key = normalizeSetNameKey(candidate);
    const compactKey = normalizeCompactSetNameKey(candidate);
    const looseKey = normalizeLooseSetNameKey(candidate);
    if (!key && !compactKey && !looseKey) {
      continue;
    }

    const match =
      boosterArtCache.bySetNameKey.get(key) ||
      boosterArtCache.byCompactSetNameKey.get(compactKey) ||
      boosterArtCache.byLooseSetNameKey.get(looseKey);

    if (match?.length) {
      return match;
    }
  }

  return [];
}

function rarityLabel(card) {
  return normalizeText(card?.rarity);
}

function rarityTier(card) {
  const label = rarityLabel(card);

  if (!label) {
    return "other";
  }

  if (label.includes("common") && !label.includes("uncommon")) {
    return "common";
  }

  if (label.includes("uncommon")) {
    return "uncommon";
  }

  if (
    label.includes("ultra") ||
    label.includes("secret") ||
    label.includes("rainbow") ||
    label.includes("hyper") ||
    label.includes("illustration") ||
    label.includes("gold") ||
    label.includes("legend") ||
    label.includes("amazing")
  ) {
    return "ultra";
  }

  if (label.includes("rare") || label.includes("promo")) {
    return "rare";
  }

  return "other";
}

function isRarePlus(card) {
  const tier = rarityTier(card);
  const label = rarityLabel(card);
  return tier === "rare" || tier === "ultra" || label.includes("holo");
}

function isEnergyCard(card) {
  const supertype = normalizeText(card?.supertype);
  if (supertype === "energy") {
    return true;
  }

  const name = normalizeText(card?.name);
  return name.includes("energy");
}

function isBasicEnergyCard(card) {
  if (!isEnergyCard(card)) {
    return false;
  }

  const name = normalizeText(card?.name);
  const subtypes = Array.isArray(card?.subtypes)
    ? card.subtypes.map((item) => normalizeText(item))
    : [];

  if (subtypes.includes("basic")) {
    return true;
  }

  const basicNames = new Set([
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

  return basicNames.has(name);
}

function sanitizePackCount(value) {
  const packCount = Number.parseInt(value, 10);
  if (Number.isNaN(packCount)) {
    return 1;
  }

  return Math.min(Math.max(packCount, 1), GACHA_MAX_PACKS);
}

function premiumTierWeightByLabel(label, baseWeight) {
  if (
    label.includes("hyper") ||
    label.includes("secret") ||
    label.includes("rainbow") ||
    label.includes("gold") ||
    label.includes("special illustration")
  ) {
    return baseWeight + 0.02;
  }

  return baseWeight;
}

function gachaRarityWeight(card, { slot = "slotNine" } = {}) {
  const tier = rarityTier(card);
  const label = rarityLabel(card);

  if (tier === "rare") {
    if (label.includes("holo")) {
      return premiumTierWeightByLabel(label, 0.04);
    }
    return premiumTierWeightByLabel(label, 0.02);
  }

  if (tier === "ultra") {
    return premiumTierWeightByLabel(label, 0.06);
  }

  if (tier === "uncommon") {
    return slot === "finalSlot" ? 1.1 : 1;
  }

  if (tier === "common") {
    return slot === "finalSlot" ? 0.7 : 1.35;
  }

  return slot === "finalSlot" ? 0.5 : 0.55;
}

function takeRandomWhere(remainingCards, predicate) {
  const candidateIndexes = [];

  for (let index = 0; index < remainingCards.length; index += 1) {
    if (predicate(remainingCards[index])) {
      candidateIndexes.push(index);
    }
  }

  if (!candidateIndexes.length) {
    return null;
  }

  const selectedIndex =
    candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)];
  return remainingCards.splice(selectedIndex, 1)[0];
}

function weightedRandomCard(remainingCards, weightFn) {
  const weighted = [];
  let totalWeight = 0;

  for (let index = 0; index < remainingCards.length; index += 1) {
    const weight = Math.max(weightFn(remainingCards[index]), 0);
    if (weight <= 0) {
      continue;
    }

    totalWeight += weight;
    weighted.push({ index, cumulativeWeight: totalWeight });
  }

  if (!weighted.length || totalWeight <= 0) {
    return null;
  }

  const roll = Math.random() * totalWeight;
  for (const entry of weighted) {
    if (roll <= entry.cumulativeWeight) {
      return remainingCards.splice(entry.index, 1)[0];
    }
  }

  return remainingCards.splice(weighted[weighted.length - 1].index, 1)[0];
}

function weightedTakeRandomWhere(remainingCards, predicate, weightFn) {
  const weighted = [];
  let totalWeight = 0;

  for (let index = 0; index < remainingCards.length; index += 1) {
    const card = remainingCards[index];
    if (!predicate(card)) {
      continue;
    }

    const weight = Math.max(weightFn(card), 0);
    if (weight <= 0) {
      continue;
    }

    totalWeight += weight;
    weighted.push({ index, cumulativeWeight: totalWeight });
  }

  if (!weighted.length || totalWeight <= 0) {
    return null;
  }

  const roll = Math.random() * totalWeight;
  for (const entry of weighted) {
    if (roll <= entry.cumulativeWeight) {
      return remainingCards.splice(entry.index, 1)[0];
    }
  }

  return remainingCards.splice(weighted[weighted.length - 1].index, 1)[0];
}

function normalizeCardForClient(card) {
  const safeCardId = sanitizeCardId(card?.id || "");
  const safeSetId = sanitizeSetId(card?.set?.id || "");
  const localCardImage = safeCardId ? `${LOCAL_CARD_IMAGE_BASE_PATH}/${safeCardId}.png` : "";
  const localCardThumb = safeCardId
    ? `${LOCAL_CARD_THUMB_IMAGE_BASE_PATH}/${safeCardId}.jpg`
    : "";
  const localSetLogo = safeSetId ? `${LOCAL_SET_LOGO_BASE_PATH}/${safeSetId}.png` : "";
  const localSetSymbol = safeSetId ? `${LOCAL_SET_SYMBOL_BASE_PATH}/${safeSetId}.png` : "";

  const normalizedSet = {
    ...(card.set || {}),
    images: {
      ...(card.set?.images || {}),
      logo: localSetLogo || card.set?.images?.logo || "",
      symbol: localSetSymbol || card.set?.images?.symbol || ""
    }
  };

  return {
    id: card.id,
    name: card.name,
    images: {
      ...(card.images || {}),
      small: card.images?.small || card.images?.large || localCardThumb || "",
      large: card.images?.large || card.images?.small || localCardImage || ""
    },
    hp: card.hp,
    types: card.types,
    rarity: card.rarity,
    set: normalizedSet,
    number: card.number,
    supertype: card.supertype,
    subtypes: card.subtypes,
    tcgplayer: card.tcgplayer,
    cardmarket: card.cardmarket
  };
}

function normalizeSetForClient(set) {
  const safeSetId = sanitizeSetId(set?.id || "");
  const localSetLogo = safeSetId ? `${LOCAL_SET_LOGO_BASE_PATH}/${safeSetId}.png` : "";
  const localSetSymbol = safeSetId ? `${LOCAL_SET_SYMBOL_BASE_PATH}/${safeSetId}.png` : "";

  return {
    ...set,
    images: {
      ...(set?.images || {}),
      logo: localSetLogo || set?.images?.logo || "",
      symbol: localSetSymbol || set?.images?.symbol || ""
    }
  };
}

function buildCardPriceGuideItem(card) {
  const fallbackTcgplayerUrl = card?.id
    ? `https://prices.pokemontcg.io/tcgplayer/${encodeURIComponent(card.id)}`
    : "";
  const fallbackCardmarketUrl = card?.id
    ? `https://prices.pokemontcg.io/cardmarket/${encodeURIComponent(card.id)}`
    : "";

  return {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    image: card.images?.small || "",
    set: {
      id: card.set?.id || "",
      name: card.set?.name || "",
      series: card.set?.series || "",
      releaseDate: card.set?.releaseDate || ""
    },
    marketPrice: extractLastSoldValue(card),
    tcgplayerUrl: card?.tcgplayer?.url || fallbackTcgplayerUrl,
    cardmarketUrl: card?.cardmarket?.url || fallbackCardmarketUrl
  };
}

async function getPriceGuideCards({ source, search, setId, sort, includeAll, page, pageSize, limit }) {
  if (!includeAll) {
    const responseData =
      source === "github"
        ? await getCardsFromLocal({ search, setId, sort, page, pageSize })
        : await getCardsFromApi({ search, setId, sort, page, pageSize });

    return {
      cards: responseData.cards,
      totalCount: responseData.totalCount,
      page,
      pageSize
    };
  }

  if (source === "github") {
    await ensureLocalDataLoaded();
    const normalizedSearch = normalizeText(search);

    let cards = localDataCache.cards.filter(
      (card) => normalizeText(card.supertype) === "pokemon"
    );

    if (normalizedSearch) {
      cards = cards.filter((card) =>
        normalizeText(card.name).includes(normalizedSearch)
      );
    }

    if (setId) {
      cards = cards.filter((card) => card.set?.id === setId);
    }

    const sorted = sortLocalCards(cards, sort);
    return {
      cards: sorted.slice(0, limit),
      totalCount: sorted.length,
      page: 1,
      pageSize: Math.min(limit, sorted.length)
    };
  }

  const cards = [];
  let cursor = 1;
  let totalCount = Infinity;

  while (cards.length < limit && cards.length < totalCount) {
    const currentPageSize = Math.min(250, limit - cards.length);
    const chunk = await getCardsFromApi({
      search,
      setId,
      sort,
      page: cursor,
      pageSize: currentPageSize
    });

    totalCount = chunk.totalCount;
    cards.push(...chunk.cards);

    if (!chunk.cards.length) {
      break;
    }

    cursor += 1;
  }

  return {
    cards,
    totalCount: Number.isFinite(totalCount) ? totalCount : cards.length,
    page: 1,
    pageSize: cards.length
  };
}

function buildPackPulls(setCards) {
  const remainingCards = [...setCards];
  const pulledCards = [];

  const pickOrFallback = (picker) => {
    const card = picker() || remainingCards.shift();
    if (card) {
      pulledCards.push(card);
    }
  };

  const hasBasicEnergy = remainingCards.some((card) => isBasicEnergyCard(card));
  if (hasBasicEnergy) {
    pickOrFallback(() => takeRandomWhere(remainingCards, (card) => isBasicEnergyCard(card)));
  }

  const commonSlots = hasBasicEnergy ? 4 : 5;
  for (let index = 0; index < commonSlots; index += 1) {
    pickOrFallback(() =>
      takeRandomWhere(remainingCards, (card) => rarityTier(card) === "common")
    );
  }

  for (let index = 0; index < 3; index += 1) {
    pickOrFallback(() =>
      takeRandomWhere(remainingCards, (card) => rarityTier(card) === "uncommon")
    );
  }

  pickOrFallback(() =>
    weightedTakeRandomWhere(
      remainingCards,
      (card) => {
        const tier = rarityTier(card);
        return (
          tier === "common" ||
          tier === "uncommon" ||
          tier === "rare" ||
          tier === "ultra" ||
          tier === "other"
        ) && !isBasicEnergyCard(card);
      },
      (card) => {
        return gachaRarityWeight(card, { slot: "slotNine" });
      }
    )
  );

  if (pulledCards.length < 9) {
    pickOrFallback(() => weightedRandomCard(remainingCards, () => 1));
  }

  pickOrFallback(() =>
    weightedTakeRandomWhere(
      remainingCards,
      (card) => !isBasicEnergyCard(card),
      (card) => {
        return gachaRarityWeight(card, { slot: "finalSlot" });
      }
    )
  );

  while (
    pulledCards.length < GACHA_CARDS_PER_PACK &&
    remainingCards.length > 0
  ) {
    pulledCards.push(remainingCards.shift());
  }

  return pulledCards;
}

function buildGodPackPulls(setCards) {
  const rarePool = setCards.filter((card) => {
    const tier = rarityTier(card);
    return tier === "rare" || tier === "ultra" || isRarePlus(card);
  });

  if (!rarePool.length) {
    return buildPackPulls(setCards);
  }

  const godPulls = [];
  for (let index = 0; index < GACHA_CARDS_PER_PACK; index += 1) {
    const randomCard = rarePool[Math.floor(Math.random() * rarePool.length)];
    if (!randomCard) {
      break;
    }
    godPulls.push(randomCard);
  }

  return godPulls;
}

function packVisualFromSet(set) {
  const baseId = String(set?.id || "default");
  let hash = 0;
  for (let index = 0; index < baseId.length; index += 1) {
    hash = (hash * 31 + baseId.charCodeAt(index)) % 360;
  }

  const hue = Math.abs(hash);
  const hue2 = (hue + 52) % 360;
  const boosterArts = getBoosterArtForSetName(set?.name);

  return {
    logo: set?.id ? `${LOCAL_SET_LOGO_BASE_PATH}/${sanitizeSetId(set.id)}.png` : set?.images?.logo || "",
    symbol: set?.id ? `${LOCAL_SET_SYMBOL_BASE_PATH}/${sanitizeSetId(set.id)}.png` : set?.images?.symbol || "",
    gradientFrom: `hsl(${hue} 85% 55%)`,
    gradientTo: `hsl(${hue2} 88% 48%)`,
    boosterArt: boosterArts[0] || "",
    boosterArts
  };
}

function slotNineWeight(card) {
  return gachaRarityWeight(card, { slot: "slotNine" });
}

function finalSlotWeight(card) {
  return gachaRarityWeight(card, { slot: "finalSlot" });
}

function previewTierForCard(card) {
  if (isBasicEnergyCard(card)) {
    return "energy";
  }

  const tier = rarityTier(card);
  if (tier === "ultra") {
    return "ultra";
  }

  if (tier === "rare" || isRarePlus(card)) {
    return "rare";
  }

  if (tier === "uncommon") {
    return "uncommon";
  }

  if (tier === "common") {
    return "common";
  }

  return "other";
}

function buildGachaPreviewData(set, setCards) {
  const allCards = [...setCards];

  const buckets = {
    energy: [],
    ultra: [],
    rare: [],
    uncommon: [],
    common: [],
    other: []
  };

  for (const card of allCards) {
    buckets[previewTierForCard(card)].push(card);
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort((left, right) => left.name.localeCompare(right.name));
  }

  const orderedPreviewCards = [
    ...buckets.energy,
    ...buckets.ultra,
    ...buckets.rare,
    ...buckets.uncommon,
    ...buckets.common,
    ...buckets.other
  ];

  const hasBasicEnergy = buckets.energy.length > 0;
  const commonSlots = hasBasicEnergy ? 4 : 5;
  const uncommonSlots = 3;

  const slotNineCandidates = setCards.filter((card) => {
    return !isBasicEnergyCard(card);
  });

  const slotNineTotals = {
    common: 0,
    uncommon: 0,
    rare: 0,
    ultra: 0,
    other: 0,
    all: 0
  };

  for (const card of slotNineCandidates) {
    const weight = slotNineWeight(card);
    if (weight <= 0) {
      continue;
    }

    const tier = rarityTier(card);
    slotNineTotals.all += weight;
    if (tier === "common") {
      slotNineTotals.common += weight;
    } else if (tier === "uncommon") {
      slotNineTotals.uncommon += weight;
    } else if (tier === "rare") {
      slotNineTotals.rare += weight;
    } else if (tier === "ultra") {
      slotNineTotals.ultra += weight;
    } else {
      slotNineTotals.other += weight;
    }
  }

  const finalSlotCandidates = setCards.filter((card) => !isBasicEnergyCard(card));

  const finalSlotTotals = {
    common: 0,
    uncommon: 0,
    rare: 0,
    ultra: 0,
    other: 0,
    all: 0
  };

  for (const card of finalSlotCandidates) {
    const weight = finalSlotWeight(card);
    if (weight <= 0) {
      continue;
    }

    const tier = rarityTier(card);
    finalSlotTotals.all += weight;
    if (tier === "common") {
      finalSlotTotals.common += weight;
    } else if (tier === "uncommon") {
      finalSlotTotals.uncommon += weight;
    } else if (tier === "rare") {
      finalSlotTotals.rare += weight;
    } else if (tier === "ultra") {
      finalSlotTotals.ultra += weight;
    } else {
      finalSlotTotals.other += weight;
    }
  }

  let finalSlotRarePlusWeight = 0;
  for (const card of finalSlotCandidates) {
    if (!isRarePlus(card)) {
      continue;
    }
    finalSlotRarePlusWeight += finalSlotWeight(card);
  }

  const slotNineCommonChance = slotNineTotals.all
    ? slotNineTotals.common / slotNineTotals.all
    : 0;
  const slotNineUncommonChance = slotNineTotals.all
    ? slotNineTotals.uncommon / slotNineTotals.all
    : 0;
  const slotNineRareChance = slotNineTotals.all ? slotNineTotals.rare / slotNineTotals.all : 0;
  const slotNineUltraChance = slotNineTotals.all
    ? slotNineTotals.ultra / slotNineTotals.all
    : 0;

  const finalSlotCommonChance = finalSlotTotals.all
    ? finalSlotTotals.common / finalSlotTotals.all
    : 0;
  const finalSlotUncommonChance = finalSlotTotals.all
    ? finalSlotTotals.uncommon / finalSlotTotals.all
    : 0;

  const finalSlotRarePlusChance = finalSlotTotals.all
    ? finalSlotRarePlusWeight / finalSlotTotals.all
    : 0;
  const finalSlotRareChance = finalSlotTotals.all
    ? finalSlotTotals.rare / finalSlotTotals.all
    : 0;
  const finalSlotUltraChance = finalSlotTotals.all
    ? finalSlotTotals.ultra / finalSlotTotals.all
    : 0;

  const commonCount = buckets.common.length;
  const uncommonCount = buckets.uncommon.length;
  const rareCount = buckets.rare.length;
  const ultraCount = buckets.ultra.length;
  const otherCount = buckets.other.length;
  const energyCount = buckets.energy.length;

  const clampChance = (value) => Math.max(0, Math.min(value, 1));

  const cardOddsByTier = {
    energy: energyCount && hasBasicEnergy ? clampChance(1 / energyCount) : 0,
    common: commonCount ? clampChance(Math.min(commonSlots, commonCount) / commonCount) : 0,
    uncommon: uncommonCount ? clampChance(Math.min(uncommonSlots, uncommonCount) / uncommonCount) : 0,
    rare: 0,
    ultra: 0,
    other: 0
  };

  const combineChance = (a, b) => 1 - (1 - a) * (1 - b);

  if (commonCount) {
    const slotNineCommonPerCard = clampChance(slotNineCommonChance / commonCount);
    const finalCommonPerCard = clampChance(finalSlotCommonChance / commonCount);
    cardOddsByTier.common = combineChance(
      cardOddsByTier.common,
      combineChance(slotNineCommonPerCard, finalCommonPerCard)
    );
  }

  if (uncommonCount) {
    const slotNineUncommonPerCard = clampChance(slotNineUncommonChance / uncommonCount);
    const finalUncommonPerCard = clampChance(finalSlotUncommonChance / uncommonCount);
    cardOddsByTier.uncommon = combineChance(
      cardOddsByTier.uncommon,
      combineChance(slotNineUncommonPerCard, finalUncommonPerCard)
    );
  }

  if (rareCount) {
    const slotNineRarePerCard = clampChance(slotNineRareChance / rareCount);
    const finalSlotRarePerCard = finalSlotTotals.all
      ? clampChance(finalSlotTotals.rare / finalSlotTotals.all / rareCount)
      : 0;
    cardOddsByTier.rare = combineChance(slotNineRarePerCard, finalSlotRarePerCard);
  }

  if (ultraCount) {
    const slotNineUltraPerCard = clampChance(slotNineUltraChance / ultraCount);
    const finalSlotUltraPerCard = finalSlotTotals.all
      ? clampChance(finalSlotTotals.ultra / finalSlotTotals.all / ultraCount)
      : 0;
    cardOddsByTier.ultra = combineChance(slotNineUltraPerCard, finalSlotUltraPerCard);
  }

  if (otherCount) {
    const slotNineOtherPerCard = slotNineTotals.all
      ? clampChance(slotNineTotals.other / slotNineTotals.all / otherCount)
      : 0;
    const finalOtherPerCard = finalSlotTotals.all
      ? clampChance(finalSlotTotals.other / finalSlotTotals.all / otherCount)
      : 0;
    cardOddsByTier.other = combineChance(slotNineOtherPerCard, finalOtherPerCard);
  }

  return {
    set: {
      id: set.id,
      name: set.name,
      series: set.series,
      releaseDate: set.releaseDate,
      total: set.total,
      visual: packVisualFromSet(set)
    },
    contentsPreview: orderedPreviewCards.map((card) => {
      const tier = previewTierForCard(card);
      return {
        ...normalizeCardForClient(card),
        oddsTier: tier,
        estimatedOdds: cardOddsByTier[tier] || 0
      };
    }),
    odds: {
      guaranteedEnergySlots: hasBasicEnergy ? 1 : 0,
      guaranteedCommonSlots: commonSlots,
      guaranteedUncommonSlots: uncommonSlots,
      finalSlotRarePlusChance,
      finalSlotCommonChance,
      finalSlotUncommonChance,
      finalSlotRareChance,
      finalSlotUltraChance,
      slotNineCommonChance,
      slotNineUncommonChance,
      slotNineRareChance,
      slotNineUltraChance
    }
  };
}

async function getSetsFromApi() {
  const response = await tcgClient.get("/sets", {
    params: {
      orderBy: "-releaseDate",
      pageSize: 250,
      select: "id,name,series,releaseDate,images"
    }
  });

  return response.data.data;
}

async function getCardsFromApi({ search, setId, sort, page, pageSize }) {
  const queryParts = ["supertype:Pokemon OR supertype:Pokémon"];

  if (search) {
    const wildcardSearch = search.split(/\s+/).join("*");
    queryParts.push(`name:*${wildcardSearch}*`);
  }

  if (setId) {
    queryParts.push(`set.id:${setId}`);
  }

  const response = await tcgClient.get("/cards", {
    params: {
      q: queryParts.join(" "),
      orderBy: API_SORT_MAP[sort],
      page,
      pageSize,
      select: "id,name,images,hp,types,rarity,set,number,supertype,subtypes,tcgplayer,cardmarket"
    }
  });

  return {
    cards: response.data.data,
    totalCount: response.data.totalCount
  };
}

async function getCardsFromLocal({ search, setId, sort, page, pageSize }) {
  await ensureLocalDataLoaded();

  const normalizedSearch = normalizeText(search);

  let cards = localDataCache.cards.filter(
    (card) => normalizeText(card.supertype) === "pokemon"
  );

  if (normalizedSearch) {
    cards = cards.filter((card) =>
      normalizeText(card.name).includes(normalizedSearch)
    );
  }

  if (setId) {
    cards = cards.filter((card) => card.set?.id === setId);
  }

  const sortedCards = sortLocalCards(cards, sort);
  const totalCount = sortedCards.length;
  const startIndex = (page - 1) * pageSize;
  const pagedCards = sortedCards.slice(startIndex, startIndex + pageSize);

  return {
    cards: pagedCards,
    totalCount
  };
}

async function getSetByIdLocal(setId) {
  await ensureLocalDataLoaded();
  return localDataCache.sets.find((set) => set.id === setId) || null;
}

async function getSetByIdApi(setId) {
  const response = await tcgClient.get(`/sets/${setId}`);
  return response.data.data;
}

async function getSetCardsLocal(setId) {
  await ensureLocalDataLoaded();

  return localDataCache.cards
    .filter((card) => card.set?.id === setId)
    .map((card) => normalizeCardForClient(card));
}

async function getSetCardsApi(setId) {
  const cards = [];
  let page = 1;
  const pageSize = 250;
  let fetched = 0;
  let totalCount = Infinity;

  while (fetched < totalCount) {
    const response = await tcgClient.get("/cards", {
      params: {
        q: `set.id:${setId}`,
        page,
        pageSize,
        select: "id,name,images,hp,types,rarity,set,number,supertype,subtypes,tcgplayer,cardmarket"
      }
    });

    const currentCards = response.data.data || [];
    totalCount = response.data.totalCount || currentCards.length;
    cards.push(...currentCards.map((card) => normalizeCardForClient(card)));

    fetched += currentCards.length;
    if (!currentCards.length) {
      break;
    }

    page += 1;
  }

  return cards;
}

async function getCardByIdForInventory(cardId, source) {
  const safeCardId = sanitizeCardId(cardId);
  if (!safeCardId) {
    return null;
  }

  if (source === "github") {
    await ensureLocalDataLoaded();
    return localDataCache.cardsById.get(safeCardId) || null;
  }

  try {
    const response = await tcgClient.get(`/cards/${encodeURIComponent(safeCardId)}`, {
      params: {
        select: "id,name,images,hp,types,rarity,set,number,supertype,subtypes,tcgplayer,cardmarket"
      }
    });

    return response.data?.data || null;
  } catch {
    return null;
  }
}

function ensureStateBinders(payload, uid) {
  const state = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const binders = Array.isArray(state.binders) ? state.binders : [];

  if (!binders.length) {
    const fallback = buildDefaultServerBinder(uid);
    state.binders = [fallback];
    state.activeBinderId = fallback.id;
    return state;
  }

  state.binders = binders.map((binder, index) => {
    const fallback = buildDefaultServerBinder(uid);
    return {
      id: sanitizeOptionalText(binder?.id, 60) || `${fallback.id}-${index + 1}`,
      name: sanitizeOptionalText(binder?.name, 40) || (index === 0 ? "Main Binder" : `Binder ${index + 1}`),
      entries: Array.isArray(binder?.entries) ? binder.entries : []
    };
  });

  const activeId = sanitizeOptionalText(state.activeBinderId, 60);
  const hasActive = state.binders.some((binder) => binder.id === activeId);
  state.activeBinderId = hasActive ? activeId : state.binders[0].id;
  return state;
}

function summarizeInventoryState(payload) {
  const binders = Array.isArray(payload?.binders) ? payload.binders : [];
  let uniqueCardCount = 0;
  let totalCopies = 0;

  for (const binder of binders) {
    const entries = Array.isArray(binder?.entries) ? binder.entries : [];
    uniqueCardCount += entries.length;
    for (const entry of entries) {
      totalCopies += Math.max(Number.parseInt(entry?.ownedQty, 10) || 0, 0);
    }
  }

  return {
    binderCount: binders.length,
    uniqueCardCount,
    totalCopies
  };
}

async function ensureSeedAdminAccount() {
  if (!authConfigReady()) {
    return;
  }

  const username = sanitizeUsername(ADMIN_SEED_USERNAME);
  const password = String(ADMIN_SEED_PASSWORD || "");
  if (!isValidUsername(username) || !isValidPassword(password)) {
    return;
  }

  try {
    let existingResult = await supabaseAdmin
      .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
      .select("uid,is_admin")
      .eq("username", username)
      .maybeSingle();

    if (existingResult.error && isMissingColumnError(existingResult.error)) {
      existingResult = await supabaseAdmin
        .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
        .select("uid")
        .eq("username", username)
        .maybeSingle();
    }

    if (existingResult.error) {
      throw existingResult.error;
    }

    const nowIso = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, 11);
    const uid = sanitizeTrainerUid(existingResult.data?.uid) || generateTrainerUid();

    const payload = {
      uid,
      username,
      password_hash: passwordHash,
      ingame_name: "Admin",
      profile_picture: "",
      is_admin: true,
      updated_at: nowIso
    };

    if (existingResult.data?.uid) {
      let updateResult = await supabaseAdmin
        .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
        .update(payload)
        .eq("uid", uid);

      if (updateResult.error && isMissingColumnError(updateResult.error)) {
        updateResult = await supabaseAdmin
          .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
          .update({
            uid,
            username,
            password_hash: passwordHash,
            ingame_name: "Admin",
            profile_picture: "",
            updated_at: nowIso
          })
          .eq("uid", uid);
      }

      if (updateResult.error) {
        throw updateResult.error;
      }
    } else {
      let insertResult = await supabaseAdmin.from(SUPABASE_PLAYER_ACCOUNTS_TABLE).insert(payload);

      if (insertResult.error && isMissingColumnError(insertResult.error)) {
        insertResult = await supabaseAdmin.from(SUPABASE_PLAYER_ACCOUNTS_TABLE).insert({
          uid,
          username,
          password_hash: passwordHash,
          ingame_name: "Admin",
          profile_picture: "",
          updated_at: nowIso
        });
      }

      if (insertResult.error) {
        throw insertResult.error;
      }
    }

    await supabaseAdmin
      .from(SUPABASE_PLAYER_STATES_TABLE)
      .upsert(
        {
          uid,
          state_json: {
            profile: {
              uid,
              ign: "Admin",
              avatar: ""
            }
          },
          profile_id: uid,
          ingame_name: "Admin",
          profile_picture: "",
          updated_at: nowIso
        },
        {
          onConflict: "uid"
        }
      );
  } catch (error) {
    console.warn("Unable to seed admin account:", error.message);
  }
}

app.get(`${LOCAL_CARD_THUMB_IMAGE_BASE_PATH}/:cardId.jpg`, async (req, res) => {
  const safeCardId = sanitizeCardId(req.params.cardId);
  if (!safeCardId) {
    res.status(400).end();
    return;
  }

  const thumbPath = localCardThumbImagePath(safeCardId);
  if (!fs.existsSync(thumbPath)) {
    await ensureCardThumbBuilt(safeCardId);
  }

  if (fs.existsSync(thumbPath)) {
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(thumbPath);
    return;
  }

  const fallbackImagePath = localCardImagePath(safeCardId);
  if (fs.existsSync(fallbackImagePath)) {
    res.sendFile(fallbackImagePath);
    return;
  }

  res.status(404).json({
    error: "Card image not found"
  });
});

app.get("/register.html", (_req, res) => {
  res.redirect(302, "/login.html");
});

app.get("/admin100401", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin100401.html"));
});

app.use(LOCAL_PACK_ART_BASE_PATH, express.static(LOCAL_PACK_ART_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    source: getActiveSource(),
    supabase: Boolean(supabaseAdmin),
    auth: authConfigReady()
  });
});

app.get("/api/broadcast/current", async (_req, res) => {
  if (!supabaseAdmin) {
    res.json({
      active: adminBroadcastFallback.active,
      message: adminBroadcastFallback.message,
      updatedAt: adminBroadcastFallback.updatedAt,
      updatedBy: adminBroadcastFallback.updatedBy,
      persisted: false
    });
    return;
  }

  try {
    const result = await supabaseAdmin
      .from(SUPABASE_ADMIN_BROADCASTS_TABLE)
      .select("id,message,active,updated_at,updated_by")
      .eq("id", 1)
      .maybeSingle();

    if (result.error) {
      const message = String(result.error.message || "").toLowerCase();
      if (message.includes("could not find the table") || message.includes("does not exist")) {
        res.json({
          active: adminBroadcastFallback.active,
          message: adminBroadcastFallback.message,
          updatedAt: adminBroadcastFallback.updatedAt,
          updatedBy: adminBroadcastFallback.updatedBy,
          persisted: false
        });
        return;
      }

      throw result.error;
    }

    res.json({
      active: Boolean(result.data?.active),
      message: sanitizeOptionalText(result.data?.message, 500),
      updatedAt: result.data?.updated_at || null,
      updatedBy: sanitizeTrainerUid(result.data?.updated_by),
      persisted: true
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to load broadcast",
      details: error.message
    });
  }
});

app.get("/api/admin/summary", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { requireAdmin: true });
  if (!authContext) {
    return;
  }

  try {
    const source = getActiveSource();
    const summary = {
      source,
      supabase: Boolean(supabaseAdmin),
      auth: authConfigReady(),
      accountCount: 0,
      playerStateCount: 0,
      setCount: null,
      cardCount: null,
      serverTime: new Date().toISOString(),
      adminUser: authContext.account.username || authContext.account.uid
    };

    if (source === "github") {
      await ensureLocalDataLoaded();
      summary.setCount = localDataCache.sets.length;
      summary.cardCount = localDataCache.cards.length;
    }

    if (supabaseAdmin) {
      const [accountCount, playerStateCount] = await Promise.all([
        getSupabaseTableCount(SUPABASE_PLAYER_ACCOUNTS_TABLE),
        getSupabaseTableCount(SUPABASE_PLAYER_STATES_TABLE)
      ]);
      summary.accountCount = accountCount;
      summary.playerStateCount = playerStateCount;
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: "Unable to load admin summary",
      details: error.message
    });
  }
});

app.get("/api/admin/users", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { requireAdmin: true });
  if (!authContext) {
    return;
  }

  const search = sanitizeOptionalText(req.query.search, 40).toLowerCase();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 60, 1), 250);

  let result = await supabaseAdmin
    .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
    .select(
      "uid,username,ingame_name,profile_picture,is_admin,banned_until,ban_reason,timeout_until,timeout_reason,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabaseAdmin
      .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
      .select("uid,username,ingame_name,profile_picture,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
  }

  if (result.error) {
    res.status(500).json({
      error: "Unable to load users",
      details: result.error.message
    });
    return;
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  const filtered = rows.filter((row) => {
    if (!search) {
      return true;
    }

    const text = `${row.uid || ""} ${row.username || ""} ${row.ingame_name || ""}`.toLowerCase();
    return text.includes(search);
  });

  const users = filtered.slice(0, limit).map((row) => {
    const safeUid = sanitizeTrainerUid(row.uid);
    const fallback = readModerationFallback(safeUid);
    return {
      uid: safeUid,
      username: sanitizeUsername(row.username),
      ingameName: sanitizeOptionalText(row.ingame_name, 40),
      profilePicture: sanitizeOptionalText(row.profile_picture, 600),
      isAdmin:
        row.is_admin === undefined
          ? sanitizeUsername(row.username) === sanitizeUsername(ADMIN_SEED_USERNAME)
          : Boolean(row.is_admin),
      bannedUntil: fallback?.banned_until || row.banned_until || null,
      banReason: sanitizeOptionalText(fallback?.ban_reason || row.ban_reason, 180),
      timeoutUntil: fallback?.timeout_until || row.timeout_until || null,
      timeoutReason: sanitizeOptionalText(fallback?.timeout_reason || row.timeout_reason, 180),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  });

  res.json({ users });
});

app.get("/api/admin/users/:uid/state", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { requireAdmin: true });
  if (!authContext) {
    return;
  }

  const targetUid = sanitizeTrainerUid(req.params.uid);
  if (!targetUid) {
    res.status(400).json({
      error: "uid is required"
    });
    return;
  }

  let account = null;
  try {
    account = await fetchAccountByUid(targetUid);
  } catch (error) {
    res.status(500).json({
      error: "Unable to load user state",
      details: error.message
    });
    return;
  }

  const stateResult = await supabaseAdmin
    .from(SUPABASE_PLAYER_STATES_TABLE)
    .select("*")
    .eq("uid", targetUid)
    .maybeSingle();

  if (stateResult.error) {
    res.status(500).json({
      error: "Unable to load user state",
      details: stateResult.error.message
    });
    return;
  }

  if (!account) {
    res.status(404).json({
      error: "User not found"
    });
    return;
  }

  const normalizedState = ensureStateBinders(stateResult.data?.state_json || {}, targetUid);
  const inventorySummary = summarizeInventoryState(normalizedState);

  res.json({
    user: {
      uid: sanitizeTrainerUid(account.uid),
      username: sanitizeUsername(account.username),
      ingameName: sanitizeOptionalText(account.ingame_name, 40),
      profilePicture: sanitizeOptionalText(account.profile_picture, 600),
      isAdmin: Boolean(account.is_admin),
      bannedUntil: account.banned_until || null,
      banReason: sanitizeOptionalText(account.ban_reason, 180),
      timeoutUntil: account.timeout_until || null,
      timeoutReason: sanitizeOptionalText(account.timeout_reason, 180)
    },
    summary: inventorySummary,
    binders: normalizedState.binders.map((binder) => ({
      id: binder.id,
      name: binder.name,
      entryCount: Array.isArray(binder.entries) ? binder.entries.length : 0,
      totalCopies: Array.isArray(binder.entries)
        ? binder.entries.reduce((sum, entry) => sum + Math.max(Number.parseInt(entry?.ownedQty, 10) || 0, 0), 0)
        : 0
    })),
    updatedAt: stateResult.data?.updated_at || null
  });
});

app.patch("/api/admin/users/:uid/inventory", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { requireAdmin: true });
  if (!authContext) {
    return;
  }

  const targetUid = sanitizeTrainerUid(req.params.uid);
  const operation = String(req.body?.operation || "").trim().toLowerCase();
  const cardId = sanitizeCardId(req.body?.cardId);
  const binderId = sanitizeOptionalText(req.body?.binderId, 60);
  const quantity = Math.min(Math.max(Number.parseInt(req.body?.quantity, 10) || 1, 0), 999);
  const noteText = sanitizeOptionalText(req.body?.notes, 240);
  const condition = sanitizeOptionalText(req.body?.condition, 32) || "Near Mint";

  if (!targetUid || !cardId) {
    res.status(400).json({
      error: "uid and cardId are required"
    });
    return;
  }

  if (!["set_qty", "add_qty", "remove_card"].includes(operation)) {
    res.status(400).json({
      error: "operation must be set_qty, add_qty, or remove_card"
    });
    return;
  }

  const stateResult = await supabaseAdmin
    .from(SUPABASE_PLAYER_STATES_TABLE)
    .select("*")
    .eq("uid", targetUid)
    .maybeSingle();

  if (stateResult.error) {
    res.status(500).json({
      error: "Unable to load inventory",
      details: stateResult.error.message
    });
    return;
  }

  const source = getActiveSource();
  const statePayload = ensureStateBinders(stateResult.data?.state_json || {}, targetUid);
  const chosenBinder =
    statePayload.binders.find((binder) => binder.id === binderId) ||
    statePayload.binders.find((binder) => binder.id === statePayload.activeBinderId) ||
    statePayload.binders[0];

  if (!Array.isArray(chosenBinder.entries)) {
    chosenBinder.entries = [];
  }

  const entries = chosenBinder.entries;
  const existingIndex = entries.findIndex((entry) => sanitizeCardId(entry?.id) === cardId);
  const nowMs = Date.now();

  if (operation === "remove_card") {
    if (existingIndex >= 0) {
      entries.splice(existingIndex, 1);
    }
  } else {
    if (operation === "set_qty" && quantity <= 0) {
      if (existingIndex >= 0) {
        entries.splice(existingIndex, 1);
      }
    } else {
      const baseCard = existingIndex >= 0 ? entries[existingIndex] : await getCardByIdForInventory(cardId, source);
      if (!baseCard) {
        res.status(404).json({
          error: "Card not found"
        });
        return;
      }

      if (existingIndex >= 0) {
        const currentQty = Math.max(Number.parseInt(entries[existingIndex]?.ownedQty, 10) || 0, 0);
        const nextQty = operation === "add_qty" ? currentQty + Math.max(quantity, 1) : Math.max(quantity, 1);
        entries[existingIndex].ownedQty = Math.min(nextQty, 999);
        entries[existingIndex].updatedAt = nowMs;
        if (noteText) {
          entries[existingIndex].notes = noteText;
        }
        if (condition) {
          entries[existingIndex].condition = condition;
        }
      } else {
        const normalized = normalizeCardForClient(baseCard);
        entries.unshift({
          ...normalized,
          notes: noteText,
          condition,
          ownedQty: Math.max(quantity, 1),
          addedAt: nowMs,
          updatedAt: nowMs
        });
      }
    }
  }

  statePayload.profile = statePayload.profile && typeof statePayload.profile === "object" ? statePayload.profile : {};
  statePayload.profile.uid = targetUid;

  const profileSnapshot = extractPlayerProfileSnapshot(targetUid, statePayload);
  const updatedAt = new Date().toISOString();
  const saveResult = await supabaseAdmin
    .from(SUPABASE_PLAYER_STATES_TABLE)
    .upsert(
      {
        uid: targetUid,
        state_json: statePayload,
        profile_id: profileSnapshot.profileId,
        ingame_name: profileSnapshot.igname,
        profile_picture: profileSnapshot.profilePicture,
        updated_at: updatedAt
      },
      {
        onConflict: "uid"
      }
    );

  if (saveResult.error) {
    res.status(500).json({
      error: "Unable to update inventory",
      details: saveResult.error.message
    });
    return;
  }

  const summary = summarizeInventoryState(statePayload);
  res.json({
    ok: true,
    uid: targetUid,
    operation,
    cardId,
    summary,
    binder: {
      id: chosenBinder.id,
      name: chosenBinder.name,
      entryCount: chosenBinder.entries.length
    },
    updatedAt
  });
});

app.patch("/api/admin/users/:uid/moderation", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { requireAdmin: true });
  if (!authContext) {
    return;
  }

  const targetUid = sanitizeTrainerUid(req.params.uid);
  const action = String(req.body?.action || "").trim().toLowerCase();
  const reason = sanitizeOptionalText(req.body?.reason, 180);
  const minutes = sanitizeMinutes(req.body?.minutes, 0, 525600);

  if (!targetUid) {
    res.status(400).json({
      error: "uid is required"
    });
    return;
  }

  if (!["ban", "unban", "timeout", "untimeout"].includes(action)) {
    res.status(400).json({
      error: "action must be ban, unban, timeout, or untimeout"
    });
    return;
  }

  if (["ban", "timeout"].includes(action) && targetUid === sanitizeTrainerUid(authContext.account.uid)) {
    res.status(400).json({
      error: "You cannot apply moderation to your own admin account"
    });
    return;
  }

  if (action === "timeout" && minutes <= 0) {
    res.status(400).json({
      error: "Timeout minutes must be greater than zero"
    });
    return;
  }

  const nowMs = Date.now();
  const updatePayload = {
    updated_at: new Date(nowMs).toISOString()
  };

  if (action === "ban") {
    const untilMs = minutes > 0 ? nowMs + minutes * 60 * 1000 : Date.parse("2099-12-31T23:59:59.000Z");
    updatePayload.banned_until = new Date(untilMs).toISOString();
    updatePayload.ban_reason = reason;
  } else if (action === "unban") {
    updatePayload.banned_until = null;
    updatePayload.ban_reason = null;
  } else if (action === "timeout") {
    const untilMs = nowMs + minutes * 60 * 1000;
    updatePayload.timeout_until = new Date(untilMs).toISOString();
    updatePayload.timeout_reason = reason;
  } else if (action === "untimeout") {
    updatePayload.timeout_until = null;
    updatePayload.timeout_reason = null;
  }

  const result = await supabaseAdmin
    .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
    .update(updatePayload)
    .eq("uid", targetUid)
    .select(
      "uid,username,ingame_name,is_admin,banned_until,ban_reason,timeout_until,timeout_reason,updated_at"
    )
    .maybeSingle();

  if (result.error) {
    if (isMissingColumnError(result.error)) {
      const existing = readModerationFallback(targetUid) || {};
      const fallback = {
        banned_until: existing.banned_until || null,
        ban_reason: existing.ban_reason || null,
        timeout_until: existing.timeout_until || null,
        timeout_reason: existing.timeout_reason || null
      };

      if (action === "ban") {
        const untilMs = minutes > 0 ? nowMs + minutes * 60 * 1000 : Date.parse("2099-12-31T23:59:59.000Z");
        fallback.banned_until = new Date(untilMs).toISOString();
        fallback.ban_reason = reason;
      } else if (action === "unban") {
        fallback.banned_until = null;
        fallback.ban_reason = null;
      } else if (action === "timeout") {
        const untilMs = nowMs + minutes * 60 * 1000;
        fallback.timeout_until = new Date(untilMs).toISOString();
        fallback.timeout_reason = reason;
      } else if (action === "untimeout") {
        fallback.timeout_until = null;
        fallback.timeout_reason = null;
      }

      const hasRestriction = Boolean(fallback.banned_until || fallback.timeout_until);
      if (hasRestriction) {
        moderationFallbackByUid.set(targetUid, fallback);
      } else {
        moderationFallbackByUid.delete(targetUid);
      }

      let account = null;
      try {
        account = await fetchAccountByUid(targetUid);
      } catch {
        account = null;
      }

      res.json({
        ok: true,
        action,
        persisted: false,
        user: {
          uid: targetUid,
          username: sanitizeUsername(account?.username),
          ingameName: sanitizeOptionalText(account?.ingame_name, 40),
          isAdmin: Boolean(account?.is_admin),
          bannedUntil: fallback.banned_until || null,
          banReason: sanitizeOptionalText(fallback.ban_reason, 180),
          timeoutUntil: fallback.timeout_until || null,
          timeoutReason: sanitizeOptionalText(fallback.timeout_reason, 180),
          updatedAt: updatePayload.updated_at
        }
      });
      return;
    }

    res.status(500).json({
      error: "Unable to update moderation state",
      details: result.error.message
    });
    return;
  }

  if (!result.data) {
    res.status(404).json({
      error: "User not found"
    });
    return;
  }

  moderationFallbackByUid.delete(targetUid);

  res.json({
    ok: true,
    action,
    persisted: true,
    user: {
      uid: sanitizeTrainerUid(result.data.uid),
      username: sanitizeUsername(result.data.username),
      ingameName: sanitizeOptionalText(result.data.ingame_name, 40),
      isAdmin: Boolean(result.data.is_admin),
      bannedUntil: result.data.banned_until || null,
      banReason: sanitizeOptionalText(result.data.ban_reason, 180),
      timeoutUntil: result.data.timeout_until || null,
      timeoutReason: sanitizeOptionalText(result.data.timeout_reason, 180),
      updatedAt: result.data.updated_at || null
    }
  });
});

app.patch("/api/admin/broadcast", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { requireAdmin: true });
  if (!authContext) {
    return;
  }

  const message = sanitizeOptionalText(req.body?.message, 500);
  const active = req.body?.active === undefined ? Boolean(message) : Boolean(req.body.active);
  const updatedAt = new Date().toISOString();

  let result = await supabaseAdmin
    .from(SUPABASE_ADMIN_BROADCASTS_TABLE)
    .upsert(
      {
        id: 1,
        message,
        active,
        updated_by: sanitizeTrainerUid(authContext.account.uid),
        updated_at: updatedAt
      },
      {
        onConflict: "id"
      }
    )
    .select("id,message,active,updated_at,updated_by")
    .maybeSingle();

  if (result.error) {
    const lower = String(result.error.message || "").toLowerCase();
    if (lower.includes("could not find the table") || lower.includes("does not exist")) {
      adminBroadcastFallback.active = active;
      adminBroadcastFallback.message = message;
      adminBroadcastFallback.updatedBy = sanitizeTrainerUid(authContext.account.uid);
      adminBroadcastFallback.updatedAt = updatedAt;

      res.json({
        ok: true,
        active,
        message,
        updatedAt,
        updatedBy: adminBroadcastFallback.updatedBy,
        persisted: false
      });
      return;
    }

    res.status(500).json({
      error: "Unable to update broadcast",
      details: result.error.message
    });
    return;
  }

  res.json({
    ok: true,
    active: Boolean(result.data?.active),
    message: sanitizeOptionalText(result.data?.message, 500),
    updatedAt: result.data?.updated_at || updatedAt,
    updatedBy: sanitizeTrainerUid(result.data?.updated_by || authContext.account.uid),
    persisted: true
  });
});

app.post("/api/auth/register", async (req, res) => {
  if (!authConfigReady()) {
    res.status(503).json({
      error: "Auth is not configured"
    });
    return;
  }

  const username = sanitizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const ingameName = sanitizeOptionalText(req.body?.ingameName || req.body?.igname, 40);

  if (!isValidUsername(username)) {
    res.status(400).json({
      error: "Username must be 3-24 chars using letters, numbers, ., _, or -"
    });
    return;
  }

  if (!isValidPassword(password)) {
    res.status(400).json({
      error: "Password must be 6-120 characters"
    });
    return;
  }

  const existing = await supabaseAdmin
    .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
    .select("uid")
    .eq("username", username)
    .maybeSingle();

  if (existing.error) {
    res.status(500).json({
      error: "Unable to register account",
      details: existing.error.message
    });
    return;
  }

  if (existing.data?.uid) {
    res.status(409).json({
      error: "Username is already taken"
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 11);
  const uid = generateTrainerUid();
  const nowIso = new Date().toISOString();

  let insertAccount = await supabaseAdmin.from(SUPABASE_PLAYER_ACCOUNTS_TABLE).insert({
    uid,
    username,
    password_hash: passwordHash,
    ingame_name: ingameName,
    profile_picture: "",
    is_admin: false,
    updated_at: nowIso
  });

  if (insertAccount.error && isMissingColumnError(insertAccount.error)) {
    insertAccount = await supabaseAdmin.from(SUPABASE_PLAYER_ACCOUNTS_TABLE).insert({
      uid,
      username,
      password_hash: passwordHash,
      ingame_name: ingameName,
      profile_picture: "",
      updated_at: nowIso
    });
  }

  if (insertAccount.error) {
    res.status(500).json({
      error: "Unable to register account",
      details: insertAccount.error.message
    });
    return;
  }

  const starterState = {
    profile: {
      uid,
      ign: ingameName || username,
      avatar: ""
    }
  };

  await supabaseAdmin.from(SUPABASE_PLAYER_STATES_TABLE).upsert(
    {
      uid,
      state_json: starterState,
      profile_id: uid,
      ingame_name: ingameName || username,
      profile_picture: "",
      updated_at: nowIso
    },
    {
      onConflict: "uid"
    }
  );

  const token = createAuthToken({ uid, username });

  res.status(201).json({
    ok: true,
    token,
    user: {
      uid,
      username,
      ingameName: ingameName || username,
      profilePicture: "",
      isAdmin: false
    }
  });
});

app.post("/api/auth/login", async (req, res) => {
  if (!authConfigReady()) {
    res.status(503).json({
      error: "Auth is not configured"
    });
    return;
  }

  const username = sanitizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  if (!isValidUsername(username) || !isValidPassword(password)) {
    res.status(400).json({
      error: "Invalid credentials"
    });
    return;
  }

  let account = null;
  try {
    account = await fetchAccountByUsername(username);
  } catch (error) {
    res.status(500).json({
      error: "Unable to login",
      details: error.message
    });
    return;
  }

  if (!account?.uid || !account?.password_hash) {
    res.status(401).json({
      error: "Invalid credentials"
    });
    return;
  }

  const isMatch = await bcrypt.compare(password, String(account.password_hash));
  if (!isMatch) {
    res.status(401).json({
      error: "Invalid credentials"
    });
    return;
  }

  if (isAccountBanned(account)) {
    res.status(403).json({
      error: "Account is banned",
      bannedUntil: account.banned_until,
      reason: sanitizeOptionalText(account.ban_reason, 180)
    });
    return;
  }

  const token = createAuthToken({
    uid: account.uid,
    username: account.username
  });

  res.json({
    ok: true,
    token,
    user: {
      uid: sanitizeTrainerUid(account.uid),
      username: sanitizeUsername(account.username),
      ingameName: sanitizeOptionalText(account.ingame_name, 40),
      profilePicture: sanitizeOptionalText(account.profile_picture, 600),
      isAdmin: Boolean(account.is_admin),
      timeoutUntil: account.timeout_until || null,
      timeoutReason: sanitizeOptionalText(account.timeout_reason, 180)
    }
  });
});

app.get("/api/auth/me", async (req, res) => {
  const authContext = await requireAuthAccount(req, res);
  if (!authContext) {
    return;
  }

  const account = authContext.account;

  res.json({
    ok: true,
    user: {
      uid: sanitizeTrainerUid(account.uid),
      username: sanitizeUsername(account.username),
      ingameName: sanitizeOptionalText(account.ingame_name, 40),
      profilePicture: sanitizeOptionalText(account.profile_picture, 600),
      isAdmin: Boolean(account.is_admin),
      timeoutUntil: account.timeout_until || null,
      timeoutReason: sanitizeOptionalText(account.timeout_reason, 180)
    }
  });
});

app.get("/api/player-state", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { allowTimedOut: true });
  if (!authContext) {
    return;
  }

  const uid = sanitizeTrainerUid(authContext.account.uid);
  const { data, error } = await supabaseAdmin
    .from(SUPABASE_PLAYER_STATES_TABLE)
    .select("*")
    .eq("uid", uid)
    .maybeSingle();

  if (error) {
    res.status(500).json({
      error: "Unable to load player state",
      details: error.message
    });
    return;
  }

  res.json({
    uid,
    state: data?.state_json || null,
    updatedAt: data?.updated_at || null,
    profile: {
      id: data?.profile_id || uid,
      igname: data?.ingame_name || null,
      picture: data?.profile_picture || null
    }
  });
});

app.put("/api/player-state", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { allowTimedOut: false });
  if (!authContext) {
    return;
  }

  const uid = sanitizeTrainerUid(authContext.account.uid);
  const statePayload = sanitizePlayerStatePayload(req.body?.state);
  if (!statePayload) {
    res.status(400).json({
      error: "state is required"
    });
    return;
  }

  const profileSnapshot = extractPlayerProfileSnapshot(uid, statePayload);
  const updatedAt = new Date().toISOString();
  let { error } = await supabaseAdmin
    .from(SUPABASE_PLAYER_STATES_TABLE)
    .upsert(
      {
        uid,
        state_json: statePayload,
        profile_id: profileSnapshot.profileId,
        ingame_name: profileSnapshot.igname,
        profile_picture: profileSnapshot.profilePicture,
        updated_at: updatedAt
      },
      {
        onConflict: "uid"
      }
    );

  let columnsMissing = false;
  if (error && /could not find the .* column|column .* does not exist/i.test(String(error.message || ""))) {
    columnsMissing = true;
    const fallbackResult = await supabaseAdmin
      .from(SUPABASE_PLAYER_STATES_TABLE)
      .upsert(
        {
          uid,
          state_json: statePayload,
          updated_at: updatedAt
        },
        {
          onConflict: "uid"
        }
      );
    error = fallbackResult.error;
  }

  if (!columnsMissing) {
    await supabaseAdmin
      .from(SUPABASE_PLAYER_ACCOUNTS_TABLE)
      .update({
        ingame_name: profileSnapshot.igname,
        profile_picture: profileSnapshot.profilePicture,
        updated_at: updatedAt
      })
      .eq("uid", uid);
  }

  if (error) {
    res.status(500).json({
      error: "Unable to save player state",
      details: error.message
    });
    return;
  }

  res.json({
    ok: true,
    uid,
    updatedAt,
    profile: profileSnapshot,
    migrationNeeded: columnsMissing
  });
});

app.get("/api/sets", async (_req, res) => {
  const source = getActiveSource();

  try {
    if (source === "github") {
      await ensureLocalDataLoaded();
      const sets = [...localDataCache.sets].sort(
        (left, right) => parseDate(right.releaseDate) - parseDate(left.releaseDate)
      );

      res.json({ sets: sets.map((set) => normalizeSetForClient(set)), source: "github" });
      return;
    }

    const sets = await getSetsFromApi();
    res.json({ sets: sets.map((set) => normalizeSetForClient(set)), source: "api" });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;
    res.status(statusCode).json({
      error: "Unable to load sets",
      details,
      source
    });
  }
});

app.get("/api/cards", async (req, res) => {
  const source = getActiveSource();
  const search = sanitizeSearchTerm(req.query.search);
  const setId = sanitizeSetId(req.query.setId);
  const sort = API_SORT_MAP[req.query.sort] ? req.query.sort : "name_asc";
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(req.query.pageSize, 10) || 24, 1),
    250
  );

  try {
    const responseData =
      source === "github"
        ? await getCardsFromLocal({ search, setId, sort, page, pageSize })
        : await getCardsFromApi({ search, setId, sort, page, pageSize });

    const normalizedCards = responseData.cards.map((card) => normalizeCardForClient(card));

    res.json({
      cards: normalizedCards,
      page,
      pageSize,
      totalCount: responseData.totalCount,
      source
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;
    res.status(statusCode).json({
      error: "Unable to load cards",
      details,
      source
    });
  }
});

app.get("/api/price-guide", async (req, res) => {
  const source = getActiveSource();
  const search = sanitizeSearchTerm(req.query.search);
  const setId = sanitizeSetId(req.query.setId);
  const sort = API_SORT_MAP[req.query.sort] ? req.query.sort : "name_asc";
  const includeAll = isTruthyQueryValue(req.query.all);
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(req.query.pageSize, 10) || 120, 1),
    250
  );
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 6000, 1),
    12000
  );

  try {
    const responseData = await getPriceGuideCards({
      source,
      search,
      setId,
      sort,
      includeAll,
      page,
      pageSize,
      limit
    });

    const prices = responseData.cards.map((card) => buildCardPriceGuideItem(card));

    res.json({
      prices,
      totalCount: responseData.totalCount,
      returned: prices.length,
      page: responseData.page,
      pageSize: responseData.pageSize,
      all: includeAll,
      source
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;
    res.status(statusCode).json({
      error: "Unable to build price guide",
      details,
      source
    });
  }
});

app.post("/api/card-prices", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const uniqueIds = [...new Set(ids.map((id) => sanitizeCardId(id)).filter(Boolean))].slice(0, 120);

  if (!uniqueIds.length) {
    res.json({ prices: {} });
    return;
  }

  const prices = Object.fromEntries(uniqueIds.map((id) => [id, 0]));
  res.json({ prices });
});

app.get("/api/gacha/packs", async (_req, res) => {
  const source = getActiveSource();

  try {
    await ensureBoosterArtLoaded();

    let sets = [];

    if (source === "github") {
      await ensureLocalDataLoaded();
      sets = [...localDataCache.sets];
    } else {
      sets = await getSetsFromApi();
    }

    const packs = sets
      .map((set) => ({
        id: set.id,
        name: set.name,
        series: set.series,
        releaseDate: set.releaseDate,
        total: set.total,
        visual: packVisualFromSet(set)
      }))
      .sort(
        (left, right) => parseDate(right.releaseDate) - parseDate(left.releaseDate)
      );

    res.json({ packs, source });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;

    res.status(statusCode).json({
      error: "Unable to load gacha packs",
      details,
      source
    });
  }
});

app.get("/api/gacha/preview", async (req, res) => {
  const source = getActiveSource();
  const setId = sanitizeSetId(req.query.setId);

  if (!setId) {
    res.status(400).json({
      error: "setId is required"
    });
    return;
  }

  try {
    await ensureBoosterArtLoaded();

    const set =
      source === "github" ? await getSetByIdLocal(setId) : await getSetByIdApi(setId);

    if (!set) {
      res.status(404).json({
        error: "Set not found"
      });
      return;
    }

    const setCards =
      source === "github" ? await getSetCardsLocal(setId) : await getSetCardsApi(setId);

    if (!setCards.length) {
      res.status(404).json({
        error: "No cards available for this set"
      });
      return;
    }

    const previewData = buildGachaPreviewData(set, setCards);
    res.json({
      source,
      ...previewData
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;

    res.status(statusCode).json({
      error: "Unable to load gacha preview",
      details,
      source
    });
  }
});

app.post("/api/gacha/open", async (req, res) => {
  const authContext = await requireAuthAccount(req, res, { allowTimedOut: false });
  if (!authContext) {
    return;
  }

  const source = getActiveSource();
  const setId = sanitizeSetId(req.body?.setId);
  const packCount = sanitizePackCount(req.body?.packCount);

  if (!setId) {
    res.status(400).json({
      error: "setId is required"
    });
    return;
  }

  try {
    await ensureBoosterArtLoaded();

    const set =
      source === "github"
        ? await getSetByIdLocal(setId)
        : await getSetByIdApi(setId);

    if (!set) {
      res.status(404).json({
        error: "Set not found"
      });
      return;
    }

    const setCards =
      source === "github"
        ? await getSetCardsLocal(setId)
        : await getSetCardsApi(setId);

    if (!setCards.length) {
      res.status(404).json({
        error: "No cards available for this set"
      });
      return;
    }

    const pulls = [];
    for (let packNumber = 1; packNumber <= packCount; packNumber += 1) {
      const godPack = Math.random() < GACHA_GOD_PACK_CHANCE;
      const packCards = godPack ? buildGodPackPulls(setCards) : buildPackPulls(setCards);
      pulls.push({
        packNumber,
        godPack,
        cards: packCards.map((card) => normalizeCardForClient(card))
      });
    }

    res.json({
      source,
      set: {
        id: set.id,
        name: set.name,
        series: set.series,
        releaseDate: set.releaseDate,
        total: set.total,
        visual: packVisualFromSet(set)
      },
      packCount,
      pulls
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;

    res.status(statusCode).json({
      error: "Unable to open gacha pack",
      details,
      source
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Pokemon deck app running on http://localhost:${PORT}`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`Data source mode: ${POKEMON_DATA_SOURCE}`);
  console.log("External price APIs disabled: using local POKECOINS value model");
  console.log(`Supabase player sync: ${supabaseAdmin ? "enabled" : "disabled"}`);
  console.log(`Auth mode: ${authConfigReady() ? "enabled" : "disabled"}`);
  if (getActiveSource() === "github") {
    console.log(`Using local dataset: ${POKEMON_GITHUB_DATA_DIR}`);
  }

  void ensureSeedAdminAccount();
});
