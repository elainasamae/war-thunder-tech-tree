import fs from 'node:fs/promises';
const repo = 'gszabi99/War-Thunder-Datamine';
const request = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'WarThunderTechTree' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
const head = await request(`https://api.github.com/repos/${repo}/commits/master`);
const sha = head.sha;
const path = 'aces.vromfs.bin_u/gamedata/weapons/rocketguns';
const files = await request(`https://api.github.com/repos/${repo}/contents/${path}?ref=${sha}`);
const selected = files.filter(
  (x) =>
    /^(us_aim|su_r_|fr_(aa20|r_|matra_super|mica)|cn_(pl|sd10|ty_90)|il_(derby|pyton|shafrir)|it_aspide|jp_aam|uk_(fireflash|firestreak|redtop|skyflash|sraam)|sw_rb)/.test(
      x.name,
    ) &&
    !/(default|bol_pod|_cwp|_group|_left|_right|_f_1|_fa_18|_switzerland|_tornado|_mirage|_javelin)/.test(
      x.name,
    ),
);
const missiles = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < selected.length) {
      const f = selected[cursor++];
      const data = await request(
        `https://raw.githubusercontent.com/${repo}/${sha}/${path}/${f.name}`,
      );
      const r = data.rocket;
      if (
        !r ||
        r.bulletType !== 'aam' ||
        !r.mass ||
        !r.caliber ||
        (!r.force && !r.propulsion0) ||
        !r.timeLife
      )
        continue;
      if (!r.force) {
        let mass = r.mass;
        let previousEnd = 0;
        const stages = [];
        for (const key of Object.keys(r)
          .filter((k) => /^propulsion\d+$/.test(k))
          .sort()) {
          const prop = r[key];
          let start = previousEnd + (prop.fireDelay ?? 0);
          for (const k of Object.keys(prop)
            .filter((k) => /^impulse\d+$/.test(k))
            .sort()) {
            const impulse = prop[k];
            const end = impulse.massEnd ?? mass - (impulse.massLost ?? 0);
            if (
              !Number.isFinite(impulse.force) ||
              !Number.isFinite(end) ||
              !Number.isFinite(impulse.time)
            )
              throw Error('Unsupported motor ' + f.name);
            stages.push({
              start,
              duration: impulse.time,
              force: impulse.force,
              massStart: mass,
              massEnd: end,
            });
            mass = end;
            start += impulse.time;
            previousEnd = start;
          }
        }
        r.motorStages = stages;
      }
      missiles.push({
        id: r.bulletName ?? f.name.replace('.blkx', ''),
        name: (r.bulletName ?? f.name.replace('.blkx', ''))
          .replace(/^(us|su|uk|fr|cn|il|it|jp|sw)_/, '')
          .replaceAll('_', ' ')
          .toUpperCase(),
        file: f.name,
        source: `https://github.com/${repo}/blob/${sha}/${path}/${f.name}`,
        rocket: r,
      });
    }
  }),
);
const unique = [
  ...new Map(missiles.sort((a, b) => a.file.localeCompare(b.file)).map((x) => [x.id, x])).values(),
];
const version = await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/version`).then((r) =>
  r.text(),
);
await fs.writeFile(
  'Data/air-to-air-ballistics.json',
  JSON.stringify({
    repository: `https://github.com/${repo}`,
    commit: sha,
    version: version.trim(),
    sourceDate: head.commit.committer.date,
    fetchedAt: new Date().toISOString(),
    missiles: unique,
  }),
);
console.log(
  JSON.stringify({
    count: unique.length,
    commit: sha,
    version: version.trim(),
    names: unique.map((x) => x.name),
  }),
);
