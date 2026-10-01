import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const repository = 'https://github.com/gszabi99/War-Thunder-Datamine';
const revision = execFileSync('git', ['ls-remote', `${repository}.git`, 'HEAD'], {
  encoding: 'utf8',
}).split(/\s/)[0];
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Could not resolve game data revision');
const base = `https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/${revision}/`;
const source = `${base}char.vromfs.bin_u/config/wpcost.blkx`;
const [response, versionResponse] = await Promise.all([fetch(source), fetch(`${base}version`)]);
if (!response.ok || !versionResponse.ok) throw new Error('Game data download failed');
const costs = await response.json();
const version = (await versionResponse.text()).trim();
const byId = new Map(
  Object.entries(costs).map(([id, record]) => [id.toLowerCase(), { id, record }]),
);
const dataUrl = new URL('../Data/', import.meta.url);
const vehicles = {};
for (const file of (await readdir(dataUrl)).filter((file) => file.endsWith('-mods.json'))) {
  const data = JSON.parse(await readFile(new URL(file, dataUrl), 'utf8'));
  for (const [id, vehicle] of Object.entries(data.vehicles)) {
    if (!vehicle.categories.some((category) => category.mods.length)) continue;
    const match = byId.get(id.toLowerCase());
    if (!match) throw new Error(`No game configuration for ${id}`);
    const requirements = {};
    for (let tier = 1; tier <= 4; tier++) {
      const count = match.record[`needBuyToOpenNextInTier${tier}`];
      if (!Number.isInteger(count) || count < 0)
        throw new Error(`Invalid tier ${tier} requirement for ${id}`);
      requirements[tier] = count;
    }
    vehicles[id] = { game_unit_id: match.id, required_to_unlock_next: requirements };
  }
}
await writeFile(
  new URL('modification-tier-requirements.json', dataUrl),
  JSON.stringify(
    {
      source,
      revision,
      game_data_version: version,
      generated_at: new Date().toISOString(),
      rule_source: `${repository}/blob/${revision}/gui.vromfs.bin_u/scripts/weaponry/modstree.nut`,
      vehicle_count: Object.keys(vehicles).length,
      vehicles: Object.fromEntries(Object.entries(vehicles).sort(([a], [b]) => a.localeCompare(b))),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Saved modification tier requirements for ${Object.keys(vehicles).length} vehicles (game ${version}).`,
);
