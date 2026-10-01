import { readFile, writeFile } from 'node:fs/promises';

const source = 'https://wiki.warthunder.com/aviation';
const response = await fetch(source);
if (!response.ok) throw new Error(`Wiki request failed: ${response.status}`);
const html = await response.text();
const match = html.match(/window\.WT_UnitList = '([^\n]*?)';/);
if (!match) throw new Error('Wiki aircraft rating list was not found');
const units = new Map(JSON.parse(match[1]).map((unit) => [unit[0], unit]));
const dataUrl = new URL('../Data/', import.meta.url);
const index = JSON.parse(await readFile(new URL('countries.json', dataUrl), 'utf8'));
const vehicles = {};
for (const country of index.countries) {
  const tree = JSON.parse(
    await readFile(new URL(`${country.code}-aviation.json`, dataUrl), 'utf8'),
  );
  for (const vehicle of tree.vehicles) {
    const ratings = units.get(vehicle.unit_id)?.[4];
    if (!ratings || !Number.isInteger(ratings.trb) || !Number.isInteger(ratings.tsb)) {
      throw new Error(`Missing ground battle aircraft ratings: ${vehicle.unit_id}`);
    }
    // The Wiki list stores zero-based rating steps: 0 -> 1.0, 1 -> 1.3, 2 -> 1.7.
    vehicles[vehicle.unit_id] = {
      battle_rating_trb: (ratings.trb / 3 + 1).toFixed(1),
      battle_rating_tsb: (ratings.tsb / 3 + 1).toFixed(1),
    };
  }
}
await writeFile(
  new URL('aircraft-ground-battle-ratings.json', dataUrl),
  JSON.stringify({ source, generated_at: new Date().toISOString(), vehicles }, null, 2) + '\n',
);
console.log(`Updated TRB and TSB ratings for ${Object.keys(vehicles).length} aircraft.`);
