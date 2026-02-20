const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const readline = require("readline");
const axios = require("axios");

const ROOT = process.cwd();
const LOCAL_DATA_DIR = path.join(ROOT, "data", "pokemon-tcg-data");
const API_DOWNLOADS_DIR = path.join(ROOT, "data", "api-downloads");
const PUBLIC_ASSETS_DIR = path.join(ROOT, "public", "assets");

const CARD_IMAGE_DIR = path.join(PUBLIC_ASSETS_DIR, "cards");
const SET_LOGOS_DIR = path.join(PUBLIC_ASSETS_DIR, "sets", "logos");
const SET_SYMBOLS_DIR = path.join(PUBLIC_ASSETS_DIR, "sets", "symbols");
const POKEMON_SPRITES_DIR = path.join(PUBLIC_ASSETS_DIR, "pokemon", "sprites");
const POKEMON_DEX_MAP_PATH = path.join(PUBLIC_ASSETS_DIR, "pokemon", "species-dex.json");

const CARD_TIMEOUT_MS = 25000;
const CONCURRENCY = Math.max(Number.parseInt(process.env.DOWNLOAD_CONCURRENCY || "16", 10) || 16, 1);
const RETRIES = Math.max(Number.parseInt(process.env.DOWNLOAD_RETRIES || "3", 10) || 3, 1);

function printStep(message) {
  process.stdout.write(`${message}\n`);
}

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

async function ensureDirs() {
  await fsPromises.mkdir(CARD_IMAGE_DIR, { recursive: true });
  await fsPromises.mkdir(SET_LOGOS_DIR, { recursive: true });
  await fsPromises.mkdir(SET_SYMBOLS_DIR, { recursive: true });
  await fsPromises.mkdir(POKEMON_SPRITES_DIR, { recursive: true });
}

async function findLatestApiDownloadDir() {
  if (!exists(API_DOWNLOADS_DIR)) {
    return "";
  }

  const names = await fsPromises.readdir(API_DOWNLOADS_DIR);
  const dirs = [];
  for (const name of names) {
    const fullPath = path.join(API_DOWNLOADS_DIR, name);
    const stat = await fsPromises.stat(fullPath);
    if (stat.isDirectory()) {
      dirs.push({ name, fullPath, mtimeMs: stat.mtimeMs });
    }
  }

  dirs.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return dirs[0]?.fullPath || "";
}

async function loadCardsFromNdjson(filePath) {
  const cards = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const text = String(line || "").trim();
    if (!text) {
      continue;
    }

    try {
      cards.push(JSON.parse(text));
    } catch {
      // ignore malformed lines
    }
  }

  return cards;
}

async function loadCardsFromLocalDataset() {
  const cardsDir = path.join(LOCAL_DATA_DIR, "cards", "en");
  const files = (await fsPromises.readdir(cardsDir)).filter((file) => file.endsWith(".json"));
  files.sort((left, right) => left.localeCompare(right));

  const cards = [];
  for (const fileName of files) {
    const fullPath = path.join(cardsDir, fileName);
    const rows = JSON.parse(await fsPromises.readFile(fullPath, "utf8"));
    if (Array.isArray(rows)) {
      cards.push(...rows);
    }
  }

  return cards;
}

async function loadSetsFromLatestOrLocal(latestDir) {
  const latestSetsPath = latestDir ? path.join(latestDir, "packs.sets.json") : "";
  if (latestSetsPath && exists(latestSetsPath)) {
    const payload = JSON.parse(await fsPromises.readFile(latestSetsPath, "utf8"));
    if (Array.isArray(payload?.sets)) {
      return payload.sets;
    }
  }

  const localSetsPath = path.join(LOCAL_DATA_DIR, "sets", "en.json");
  return JSON.parse(await fsPromises.readFile(localSetsPath, "utf8"));
}

async function loadSpeciesMap(latestDir) {
  const latestSpeciesPath = latestDir ? path.join(latestDir, "pokemons.species.json") : "";
  if (latestSpeciesPath && exists(latestSpeciesPath)) {
    const payload = JSON.parse(await fsPromises.readFile(latestSpeciesPath, "utf8"));
    if (payload?.dexMap && typeof payload.dexMap === "object") {
      return payload.dexMap;
    }
  }

  const response = await axios.get("https://pokeapi.co/api/v2/pokemon-species", {
    timeout: CARD_TIMEOUT_MS,
    params: {
      limit: 2000,
      offset: 0
    }
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  const dexMap = {};
  for (const item of results) {
    const name = String(item?.name || "").trim();
    const match = String(item?.url || "").match(/\/pokemon-species\/(\d+)\/?$/i);
    const dex = match ? Number.parseInt(match[1], 10) : 0;
    if (name && Number.isFinite(dex) && dex > 0) {
      dexMap[name] = dex;
    }
  }

  return dexMap;
}

function sanitizeName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function streamDownload(url, destPath) {
  const tempPath = `${destPath}.tmp`;
  await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

  const response = await axios.get(url, {
    timeout: CARD_TIMEOUT_MS,
    responseType: "stream"
  });

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tempPath);
    response.data.pipe(output);
    output.on("finish", resolve);
    output.on("error", reject);
    response.data.on("error", reject);
  });

  await fsPromises.rename(tempPath, destPath);
}

async function downloadTask(task) {
  if (exists(task.destPath)) {
    return { ok: true, skipped: true };
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < RETRIES) {
    attempt += 1;
    try {
      await streamDownload(task.url, task.destPath);
      return { ok: true, skipped: false };
    } catch (error) {
      lastError = error;
      try {
        await fsPromises.unlink(`${task.destPath}.tmp`);
      } catch {
        // ignore
      }

      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  return {
    ok: false,
    skipped: false,
    error: lastError?.message || "Unknown error"
  };
}

async function runDownloads(tasks, label) {
  let index = 0;
  let completed = 0;
  let downloaded = 0;
  let skipped = 0;
  const failed = [];

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= tasks.length) {
        return;
      }

      const task = tasks[current];
      const result = await downloadTask(task);
      completed += 1;
      if (result.ok) {
        if (result.skipped) {
          skipped += 1;
        } else {
          downloaded += 1;
        }
      } else {
        failed.push({
          key: task.key,
          url: task.url,
          destPath: task.destPath,
          error: result.error
        });
      }

      if (completed % 100 === 0 || completed === tasks.length) {
        process.stdout.write(
          `\r${label}: ${completed}/${tasks.length} (downloaded ${downloaded}, skipped ${skipped}, failed ${failed.length})`
        );
      }
    }
  });

  await Promise.all(workers);
  process.stdout.write("\n");

  return {
    label,
    total: tasks.length,
    downloaded,
    skipped,
    failed
  };
}

function buildCardTasks(cards) {
  const tasks = [];
  const seen = new Set();

  for (const card of cards) {
    const id = sanitizeName(card?.id);
    const url = String(card?.images?.large || card?.images?.small || "").trim();
    if (!id || !url || seen.has(id)) {
      continue;
    }

    seen.add(id);
    tasks.push({
      key: `card:${id}`,
      url,
      destPath: path.join(CARD_IMAGE_DIR, `${id}.png`)
    });
  }

  return tasks;
}

function buildSetTasks(sets) {
  const tasks = [];
  const seen = new Set();

  for (const set of sets) {
    const id = sanitizeName(set?.id);
    if (!id) {
      continue;
    }

    const logoUrl = String(set?.images?.logo || "").trim();
    const symbolUrl = String(set?.images?.symbol || "").trim();

    if (logoUrl) {
      const key = `set-logo:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push({
          key,
          url: logoUrl,
          destPath: path.join(SET_LOGOS_DIR, `${id}.png`)
        });
      }
    }

    if (symbolUrl) {
      const key = `set-symbol:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push({
          key,
          url: symbolUrl,
          destPath: path.join(SET_SYMBOLS_DIR, `${id}.png`)
        });
      }
    }
  }

  return tasks;
}

function buildSpriteTasks(speciesDexMap) {
  const tasks = [];
  const dexNumbers = [...new Set(Object.values(speciesDexMap))]
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  for (const dex of dexNumbers) {
    tasks.push({
      key: `sprite:${dex}`,
      url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`,
      destPath: path.join(POKEMON_SPRITES_DIR, `${dex}.png`)
    });
  }

  return tasks;
}

async function writeManifest(manifest) {
  const manifestPath = path.join(PUBLIC_ASSETS_DIR, "download-manifest.json");
  await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

async function main() {
  await ensureDirs();

  const latestDir = await findLatestApiDownloadDir();
  printStep(`Using latest API dump: ${latestDir || "none"}`);

  const ndjsonPath = latestDir ? path.join(latestDir, "cards.ndjson") : "";
  const cards = ndjsonPath && exists(ndjsonPath)
    ? await loadCardsFromNdjson(ndjsonPath)
    : await loadCardsFromLocalDataset();

  const sets = await loadSetsFromLatestOrLocal(latestDir);
  const speciesDexMap = await loadSpeciesMap(latestDir);

  await fsPromises.writeFile(POKEMON_DEX_MAP_PATH, JSON.stringify(speciesDexMap, null, 2), "utf8");

  const cardTasks = buildCardTasks(cards);
  const setTasks = buildSetTasks(sets);
  const spriteTasks = buildSpriteTasks(speciesDexMap);

  printStep(`Card image tasks: ${cardTasks.length}`);
  printStep(`Set image tasks: ${setTasks.length}`);
  printStep(`Pokemon sprite tasks: ${spriteTasks.length}`);

  const cardResult = await runDownloads(cardTasks, "Cards");
  const setResult = await runDownloads(setTasks, "Sets");
  const spriteResult = await runDownloads(spriteTasks, "Sprites");

  const allFailed = [...cardResult.failed, ...setResult.failed, ...spriteResult.failed];
  if (allFailed.length) {
    await fsPromises.writeFile(
      path.join(PUBLIC_ASSETS_DIR, "download-failures.json"),
      JSON.stringify(allFailed, null, 2),
      "utf8"
    );
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    concurrency: CONCURRENCY,
    retries: RETRIES,
    sources: {
      cards: ndjsonPath && exists(ndjsonPath) ? ndjsonPath : path.join(LOCAL_DATA_DIR, "cards", "en"),
      sets: latestDir ? path.join(latestDir, "packs.sets.json") : path.join(LOCAL_DATA_DIR, "sets", "en.json"),
      species: latestDir ? path.join(latestDir, "pokemons.species.json") : "https://pokeapi.co/api/v2/pokemon-species"
    },
    results: {
      cards: {
        totalTasks: cardResult.total,
        downloaded: cardResult.downloaded,
        skipped: cardResult.skipped,
        failed: cardResult.failed.length
      },
      sets: {
        totalTasks: setResult.total,
        downloaded: setResult.downloaded,
        skipped: setResult.skipped,
        failed: setResult.failed.length
      },
      sprites: {
        totalTasks: spriteResult.total,
        downloaded: spriteResult.downloaded,
        skipped: spriteResult.skipped,
        failed: spriteResult.failed.length
      }
    }
  };

  await writeManifest(manifest);

  printStep("Asset download complete.");
  printStep(`Failures: ${allFailed.length}`);
}

main().catch((error) => {
  console.error("Asset download failed:", error.message);
  process.exitCode = 1;
});
