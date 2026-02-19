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
  cards: []
};

const boosterArtCache = {
  loaded: false,
  loadingPromise: null,
  bySetNameKey: new Map()
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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
          subtypes: card.subtypes
        });
      }
    }

    localDataCache.sets = sets;
    localDataCache.cards = cards;
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
    subtypes: card.subtypes
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

  for (let index = 0; index < 5; index += 1) {
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
        return tier === "uncommon" || tier === "rare" || tier === "ultra";
      },
      (card) => {
      const tier = rarityTier(card);
      const label = rarityLabel(card);

      if (tier === "rare" && label.includes("holo")) {
        return 1.9;
      }

      if (tier === "rare") {
        return 1.45;
      }

      if (tier === "uncommon") {
        return 1.25;
      }

      if (tier === "ultra") {
        return 0.25;
      }

      if (tier === "other") {
        return 0.7;
      }

      return 0.45;
      }
    )
  );

  if (pulledCards.length < 9) {
    pickOrFallback(() => weightedRandomCard(remainingCards, () => 1));
  }

  pickOrFallback(() =>
    takeRandomWhere(remainingCards, (card) => {
      const tier = rarityTier(card);
      return tier === "rare" || tier === "ultra" || isRarePlus(card);
    })
  );

  if (pulledCards.length >= 2) {
    const secondToLastIndex = pulledCards.length - 2;
    const lastIndex = pulledCards.length - 1;
    const secondToLastCard = pulledCards[secondToLastIndex];
    const lastCard = pulledCards[lastIndex];

    const secondTier = rarityTier(secondToLastCard);
    const lastTier = rarityTier(lastCard);

    if (
      secondTier === "ultra" &&
      lastTier !== "ultra" &&
      lastTier !== "rare"
    ) {
      pulledCards[secondToLastIndex] = lastCard;
      pulledCards[lastIndex] = secondToLastCard;
    }
  }

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
    return 1.9;
  }

  if (tier === "rare") {
    return 1.45;
  }

  if (tier === "uncommon") {
    return 1.25;
  }

  if (tier === "ultra") {
    return 0.25;
  }

  return 0;
}

function previewTierForCard(card) {
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
    ...buckets.ultra,
    ...buckets.rare,
    ...buckets.uncommon,
    ...buckets.common,
    ...buckets.other
  ];

  const slotNineCandidates = setCards.filter((card) => {
    const tier = rarityTier(card);
    return tier === "uncommon" || tier === "rare" || tier === "ultra";
  });

  const slotNineTotals = {
    uncommon: 0,
    rare: 0,
    ultra: 0,
    all: 0
  };

  for (const card of slotNineCandidates) {
    const weight = slotNineWeight(card);
    if (weight <= 0) {
      continue;
    }

    const tier = rarityTier(card);
    slotNineTotals.all += weight;
    if (tier === "uncommon") {
      slotNineTotals.uncommon += weight;
    } else if (tier === "rare") {
      slotNineTotals.rare += weight;
    } else if (tier === "ultra") {
      slotNineTotals.ultra += weight;
    }
  }

  const finalSlotCandidates = setCards.filter((card) => {
    const tier = rarityTier(card);
    return tier === "rare" || tier === "ultra" || isRarePlus(card);
  });

  const finalSlotRarePlusCount = finalSlotCandidates.filter((card) =>
    isRarePlus(card)
  ).length;
  const finalSlotRareCount = finalSlotCandidates.filter(
    (card) => previewTierForCard(card) === "rare"
  ).length;
  const finalSlotUltraCount = finalSlotCandidates.filter(
    (card) => rarityTier(card) === "ultra"
  ).length;

  const slotNineUncommonChance = slotNineTotals.all
    ? slotNineTotals.uncommon / slotNineTotals.all
    : 0;
  const slotNineRareChance = slotNineTotals.all ? slotNineTotals.rare / slotNineTotals.all : 0;
  const slotNineUltraChance = slotNineTotals.all
    ? slotNineTotals.ultra / slotNineTotals.all
    : 0;

  const finalSlotRarePlusChance = finalSlotCandidates.length
    ? finalSlotRarePlusCount / finalSlotCandidates.length
    : 0;
  const finalSlotRareChance = finalSlotCandidates.length
    ? finalSlotRareCount / finalSlotCandidates.length
    : 0;
  const finalSlotUltraChance = finalSlotCandidates.length
    ? finalSlotUltraCount / finalSlotCandidates.length
    : 0;

  const commonCount = buckets.common.length;
  const uncommonCount = buckets.uncommon.length;
  const rareCount = buckets.rare.length;
  const ultraCount = buckets.ultra.length;

  const clampChance = (value) => Math.max(0, Math.min(value, 1));

  const cardOddsByTier = {
    common: commonCount ? clampChance(Math.min(5, commonCount) / commonCount) : 0,
    uncommon: 0,
    rare: 0,
    ultra: 0,
    other: 0
  };

  if (uncommonCount) {
    const baseUncommonChance = clampChance(Math.min(3, uncommonCount) / uncommonCount);
    const slotNineUncommonPerCard = clampChance(slotNineUncommonChance / uncommonCount);
    cardOddsByTier.uncommon =
      1 - (1 - baseUncommonChance) * (1 - slotNineUncommonPerCard);
  }

  if (rareCount) {
    const slotNineRarePerCard = clampChance(slotNineRareChance / rareCount);
    const finalSlotRarePerCard = clampChance(finalSlotRareChance / rareCount);
    cardOddsByTier.rare = 1 - (1 - slotNineRarePerCard) * (1 - finalSlotRarePerCard);
  }

  if (ultraCount) {
    const slotNineUltraPerCard = clampChance(slotNineUltraChance / ultraCount);
    const finalSlotUltraPerCard = clampChance(finalSlotUltraChance / ultraCount);
    cardOddsByTier.ultra = 1 - (1 - slotNineUltraPerCard) * (1 - finalSlotUltraPerCard);
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
      guaranteedCommonSlots: 5,
      guaranteedUncommonSlots: 3,
      finalSlotRarePlusChance,
      finalSlotRareChance,
      finalSlotUltraChance,
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
      select: "id,name,images,hp,types,rarity,set,number,supertype,subtypes"
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
        select: "id,name,images,hp,types,rarity,set,number,supertype,subtypes"
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
    40
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
  if (getActiveSource() === "github") {
    console.log(`Using local dataset: ${POKEMON_GITHUB_DATA_DIR}`);
  }
});
