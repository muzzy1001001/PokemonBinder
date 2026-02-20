const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

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
const BOOSTER_ART_PAGE_URL = "https://pokesymbols.com/tcg/booster-pack-art";
const BOOSTER_ART_ORIGIN = "https://pokesymbols.com";
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

const tcgClient = axios.create({
  baseURL: POKEMON_TCG_BASE_URL,
  timeout: 12000,
  headers: {
    "X-Api-Key": POKEMON_TCG_API_KEY
  }
});

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
  bySetNameKey: new Map()
};

const lastSoldCache = new Map();
let lastSoldApiCooldownUntil = 0;
let ebayLookupBlockedUntil = 0;
const priceTrackerCache = new Map();
const priceTrackerUsage = {
  dateKey: "",
  count: 0
};

app.use(express.json());

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
    .replace(/[^a-zA-Z0-9\-]/g, "")
    .slice(0, 40);
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
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
    try {
      const response = await axios.get(BOOSTER_ART_PAGE_URL, {
        timeout: 15000
      });

      const html = String(response.data || "");
      const entries = [];
      const escapedPattern =
        /\\"imageSrc\\":\\"(\/images\/tcg\/sets\/booster-pack-art\/[^\\"]+)\\",\\"name\\":\\"([^\\"]+)\\"/g;
      const plainPattern =
        /"imageSrc":"(\/images\/tcg\/sets\/booster-pack-art\/[^"]+)","name":"([^"]+)"/g;

      for (const pattern of [escapedPattern, plainPattern]) {
        let match = pattern.exec(html);
        while (match) {
          entries.push({
            imageSrc: match[1],
            name: match[2]
          });
          match = pattern.exec(html);
        }
      }

      const map = new Map();

      for (const entry of entries) {
        if (!entry?.name || !entry?.imageSrc) {
          continue;
        }

        const key = normalizeSetNameKey(entry.name);
        if (!key) {
          continue;
        }

        const imageUrl = new URL(entry.imageSrc, BOOSTER_ART_ORIGIN).toString();
        if (!map.has(key)) {
          map.set(key, new Set());
        }
        map.get(key).add(imageUrl);
      }

      boosterArtCache.bySetNameKey = new Map(
        [...map.entries()].map(([key, value]) => [key, [...value]])
      );
    } catch (_error) {
      boosterArtCache.bySetNameKey = new Map();
    }

    boosterArtCache.loaded = true;
    boosterArtCache.loadingPromise = null;
  })();

  await boosterArtCache.loadingPromise;
}

function getBoosterArtForSetName(setName) {
  const key = normalizeSetNameKey(setName);
  if (!key || !boosterArtCache.bySetNameKey.size) {
    return [];
  }

  return boosterArtCache.bySetNameKey.get(key) || [];
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
  return {
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
    cardmarket: card.cardmarket
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
        const tier = rarityTier(card);
        const label = rarityLabel(card);

        if (tier === "rare" && label.includes("holo")) {
          return 0.26;
        }

        if (tier === "rare") {
          return 0.18;
        }

        if (tier === "ultra") {
          return 0.03;
        }

        if (tier === "uncommon") {
          return 1;
        }

        if (tier === "common") {
          return 1.35;
        }

        return 0.55;
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
        const tier = rarityTier(card);
        const label = rarityLabel(card);

        if (tier === "ultra") {
          return 0.025;
        }

        if (tier === "rare" && label.includes("holo")) {
          return 0.24;
        }

        if (tier === "rare") {
          return 0.16;
        }

        if (tier === "uncommon") {
          return 1.1;
        }

        if (tier === "common") {
          return 0.7;
        }

        return 0.5;
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
    logo: set?.images?.logo || "",
    symbol: set?.images?.symbol || "",
    gradientFrom: `hsl(${hue} 85% 55%)`,
    gradientTo: `hsl(${hue2} 88% 48%)`,
    boosterArt: boosterArts[0] || "",
    boosterArts
  };
}

function slotNineWeight(card) {
  const tier = rarityTier(card);
  const label = rarityLabel(card);

  if (tier === "rare" && label.includes("holo")) {
    return 0.26;
  }

  if (tier === "rare") {
    return 0.18;
  }

  if (tier === "ultra") {
    return 0.03;
  }

  if (tier === "uncommon") {
    return 1;
  }

  if (tier === "common") {
    return 1.35;
  }

  return 0.55;
}

function finalSlotWeight(card) {
  const tier = rarityTier(card);
  const label = rarityLabel(card);

  if (tier === "ultra") {
    return 0.025;
  }

  if (tier === "rare" && label.includes("holo")) {
    return 0.24;
  }

  if (tier === "rare") {
    return 0.16;
  }

  if (tier === "uncommon") {
    return 1.1;
  }

  if (tier === "common") {
    return 0.7;
  }

  return 0.5;
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

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, source: getActiveSource() });
});

app.get("/api/sets", async (_req, res) => {
  const source = getActiveSource();

  try {
    if (source === "github") {
      await ensureLocalDataLoaded();
      const sets = [...localDataCache.sets].sort(
        (left, right) => parseDate(right.releaseDate) - parseDate(left.releaseDate)
      );

      res.json({ sets, source: "github" });
      return;
    }

    const sets = await getSetsFromApi();
    res.json({ sets, source: "api" });
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

    res.json({
      cards: responseData.cards,
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
  if (getActiveSource() === "github") {
    console.log(`Using local dataset: ${POKEMON_GITHUB_DATA_DIR}`);
  }
});
