import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../Data/', import.meta.url);
const cacheUrl = new URL('../artifacts/modification-dependencies/', import.meta.url);
await mkdir(cacheUrl, { recursive: true });
const vehicles = new Map();
for (const file of (await readdir(dataUrl)).filter((file) => file.endsWith('-mods.json'))) {
  const data = JSON.parse(await readFile(new URL(file, dataUrl), 'utf8'));
  for (const [id, vehicle] of Object.entries(data.vehicles)) {
    const mods = vehicle.categories.flatMap((category) => category.mods);
    if (mods.length) vehicles.set(id, { url: vehicle.source_url, mods });
  }
}
const queue = [...vehicles.entries()];
const results = {};
const failures = [];
let cursor = 0;
let done = 0;
async function collect(id, url) {
  const cacheFile = new URL(`${encodeURIComponent(id)}.json`, cacheUrl);
  try {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  } catch {
    /* Fetch missing cache entries. */
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const buttons = [...html.matchAll(/<button\b[^>]*\bdata-mod-id="([^"]+)"[^>]*>/g)];
      if (!buttons.length) throw new Error('No modification list in Wiki response');
      const dependencies = {};
      for (const button of buttons) {
        const prerequisite = button[0].match(/\bdata-mod-req-id="([^"]+)"/);
        if (prerequisite) dependencies[button[1]] = [prerequisite[1]];
      }
      const result = { dependencies, mod_ids: buttons.map((button) => button[1]) };
      await writeFile(cacheFile, JSON.stringify(result));
      return result;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
async function worker() {
  while (cursor < queue.length) {
    const [id, { url, mods }] = queue[cursor++];
    try {
      const record = await collect(id, url);
      const localIds = new Set(mods.map((mod) => mod.mod_id));
      results[id] = Object.fromEntries(
        Object.entries(record.dependencies).filter(
          ([modId, required]) => localIds.has(modId) && required.every((id) => localIds.has(id)),
        ),
      );
    } catch (error) {
      failures.push({ id, error: error.message });
    }
    done++;
    if (done % 100 === 0)
      console.log(`Collected ${done}/${queue.length}, failed ${failures.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
if (failures.length) {
  await writeFile(new URL('failures.json', cacheUrl), JSON.stringify(failures, null, 2));
  throw new Error(
    `${failures.length} Wiki requests failed. Successful results are cached; rerun to retry.`,
  );
}
const ordered = Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(
  new URL('modification-dependencies.json', dataUrl),
  JSON.stringify(
    {
      source: 'https://wiki.warthunder.com',
      generated_at: new Date().toISOString(),
      vehicle_count: queue.length,
      vehicles: ordered,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Saved ${queue.length} vehicle modification dependency lists.`);
