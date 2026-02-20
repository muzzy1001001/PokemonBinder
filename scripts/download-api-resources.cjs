const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const TCG_BASE_URL = process.env.POKEMON_TCG_BASE_URL || "https://api.pokemontcg.io/v2";
const TCG_API_KEY = process.env.POKEMON_TCG_API_KEY || "";
const POKEAPI_SPECIES_URL = "https://pokeapi.co/api/v2/pokemon-species";
const LOCAL_DATA_DIR =
  process.env.POKEMON_GITHUB_DATA_DIR || path.join(process.cwd(), "data", "pokemon-tcg-data");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nowStamp() {
  const now = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}`;
}

function createTcgClient() {
  const headers = {};
  if (TCG_API_KEY) {
    headers["X-Api-Key"] = TCG_API_KEY;
  }

  return axios.create({
    baseURL: TCG_BASE_URL,
    timeout: 30000,
    headers
  });
}

async function fetchPageWithRetry(client, endpoint, params, maxAttempts = 4) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status || 0;
      const retryable = status === 429 || status >= 500 || status === 0;
      if (!retryable || attempt >= maxAttempts) {
        break;
      }

      await wait(300 * attempt);
    }
  }

  throw lastError;
}

async function downloadAllCards(client, outputDir) {
  const pageSize = 250;
  const outPath = path.join(outputDir, "cards.ndjson");
  const out = fs.createWriteStream(outPath, { encoding: "utf8" });

  let totalCount = 0;
  let written = 0;
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      const payload = await fetchPageWithRetry(client, "/cards", {
        page,
        pageSize,
        orderBy: "name"
      });

      const cards = Array.isArray(payload?.data) ? payload.data : [];
      totalCount = Number(payload?.totalCount || totalCount || 0);
      totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

      for (const card of cards) {
        out.write(`${JSON.stringify(card)}\n`);
        written += 1;
      }

      process.stdout.write(`\rCards: page ${page}/${totalPages} (${written}/${totalCount})`);
      page += 1;
      await wait(80);
    }
  } finally {
    out.end();
  }

  process.stdout.write("\n");

  return {
    file: path.basename(outPath),
    totalCount,
    downloaded: written,
    pageSize
  };
}

async function downloadAllCardsFromLocal(outputDir) {
  const cardsDir = path.join(LOCAL_DATA_DIR, "cards", "en");
  const files = (await fsPromises.readdir(cardsDir)).filter((file) => file.endsWith(".json"));
  files.sort((left, right) => left.localeCompare(right));

  const outPath = path.join(outputDir, "cards.ndjson");
  const out = fs.createWriteStream(outPath, { encoding: "utf8" });

  let written = 0;
  try {
    for (let index = 0; index < files.length; index += 1) {
      const fileName = files[index];
      const fullPath = path.join(cardsDir, fileName);
      const rows = JSON.parse(await fsPromises.readFile(fullPath, "utf8"));
      for (const card of rows) {
        out.write(`${JSON.stringify(card)}\n`);
        written += 1;
      }

      process.stdout.write(`\rCards(local): file ${index + 1}/${files.length} (${written})`);
    }
  } finally {
    out.end();
  }

  process.stdout.write("\n");

  return {
    file: path.basename(outPath),
    totalCount: written,
    downloaded: written,
    pageSize: 0,
    source: "local-data"
  };
}

async function downloadAllSets(client, outputDir) {
  const pageSize = 250;
  let page = 1;
  let totalPages = 1;
  let totalCount = 0;
  const sets = [];

  while (page <= totalPages) {
    const payload = await fetchPageWithRetry(client, "/sets", {
      page,
      pageSize,
      orderBy: "releaseDate"
    });

    const rows = Array.isArray(payload?.data) ? payload.data : [];
    totalCount = Number(payload?.totalCount || totalCount || 0);
    totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
    sets.push(...rows);

    process.stdout.write(`\rPacks/Sets: page ${page}/${totalPages} (${sets.length}/${totalCount})`);
    page += 1;
    await wait(80);
  }

  process.stdout.write("\n");

  const outPath = path.join(outputDir, "packs.sets.json");
  await fsPromises.writeFile(
    outPath,
    JSON.stringify(
      {
        source: "PokemonTCG API /sets",
        totalCount,
        downloaded: sets.length,
        sets
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    file: path.basename(outPath),
    totalCount,
    downloaded: sets.length,
    pageSize
  };
}

async function downloadAllSetsFromLocal(outputDir) {
  const setsPath = path.join(LOCAL_DATA_DIR, "sets", "en.json");
  const sets = JSON.parse(await fsPromises.readFile(setsPath, "utf8"));
  const outPath = path.join(outputDir, "packs.sets.json");

  await fsPromises.writeFile(
    outPath,
    JSON.stringify(
      {
        source: "local-data sets/en.json",
        totalCount: sets.length,
        downloaded: sets.length,
        sets
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    file: path.basename(outPath),
    totalCount: sets.length,
    downloaded: sets.length,
    pageSize: 0,
    source: "local-data"
  };
}

function extractDex(url) {
  const match = String(url || "").match(/\/pokemon-species\/(\d+)\/?$/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function downloadPokemonSpecies(outputDir) {
  const response = await axios.get(POKEAPI_SPECIES_URL, {
    timeout: 30000,
    params: {
      limit: 2000,
      offset: 0
    }
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  const dexMap = Object.fromEntries(
    results
      .map((item) => [String(item?.name || "").trim(), extractDex(item?.url)])
      .filter(([name, dex]) => name && Number.isFinite(dex) && dex > 0)
  );

  const outPath = path.join(outputDir, "pokemons.species.json");
  await fsPromises.writeFile(
    outPath,
    JSON.stringify(
      {
        source: POKEAPI_SPECIES_URL,
        totalCount: Number(response.data?.count || results.length),
        downloaded: results.length,
        species: results,
        dexMap
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    file: path.basename(outPath),
    totalCount: Number(response.data?.count || results.length),
    downloaded: results.length
  };
}

async function main() {
  const stamp = nowStamp();
  const outputDir = path.join(process.cwd(), "data", "api-downloads", stamp);
  await fsPromises.mkdir(outputDir, { recursive: true });

  const client = createTcgClient();

  console.log(`Output directory: ${outputDir}`);
  console.log("Downloading cards, packs/sets, and pokemon species...");

  let cards;
  let packs;
  try {
    cards = await downloadAllCards(client, outputDir);
    packs = await downloadAllSets(client, outputDir);
  } catch (error) {
    console.log("TCG API unavailable, falling back to local dataset...");
    cards = await downloadAllCardsFromLocal(outputDir);
    packs = await downloadAllSetsFromLocal(outputDir);
  }

  const pokemons = await downloadPokemonSpecies(outputDir);

  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: {
      cards: `${TCG_BASE_URL}/cards`,
      packs: `${TCG_BASE_URL}/sets`,
      pokemons: `${POKEAPI_SPECIES_URL}?limit=2000&offset=0`
    },
    files: {
      cards,
      packs,
      pokemons
    }
  };

  await fsPromises.writeFile(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log("Download complete.");
  console.log(`Cards: ${cards.downloaded}`);
  console.log(`Packs/Sets: ${packs.downloaded}`);
  console.log(`Pokemons: ${pokemons.downloaded}`);
}

main().catch((error) => {
  const details = error.response?.data?.error?.message || error.message;
  console.error("Download failed:", details);
  process.exitCode = 1;
});
