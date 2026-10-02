import fs from 'node:fs/promises';
const repo = 'gszabi99/War-Thunder-Datamine';
const request = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'WarThunderTechTree' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
const snapshot = JSON.parse(await fs.readFile('Data/air-to-air-ballistics.json', 'utf8'));
const head = await request(`https://api.github.com/repos/${repo}/commits/${snapshot.commit}`);
const sha = head.sha;
const path = 'aces.vromfs.bin_u/gamedata/weapons/rocketguns';
const files = await request(`https://api.github.com/repos/${repo}/contents/${path}?ref=${sha}`);
// Aircraft/helicopter-launched families. Do not select all atgm_tank/rocket_tank files:
// those types also occur in land-launched weapons.
const selected = files.filter(
  (x) =>
    /^(us_(agm_|hellfire_agm_)|su_(kh_|9m(114|120|123|127|17)|s_25l)|cn_(akd_|ba_|yj91)|fr_(as20|as30|as37_armat)|uk_(brimstone_dm|martlet)|euro_hot|spike_er|zt_6_mokopa|sa_zt_35_ingwe)/.test(
      x.name,
    ) && !/(default|switzerland|_heli|_notlaserchannel|_haslaserchannel)/.test(x.name),
);
const missiles = [];
const skipped = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    weapons: while (cursor < selected.length) {
      const f = selected[cursor++];
      const data = await request(
        `https://raw.githubusercontent.com/${repo}/${sha}/${path}/${f.name}`,
      );
      const r = data.rocket;
      if (
        !r ||
        (!r.guidance && r.controlSensitivity === undefined) ||
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
            ) {
              skipped.push({ file: f.name, reason: '当前模型不支持流量/比冲发动机字段' });
              continue weapons;
            }
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
        category: 'air-to-ground',
        id: r.bulletName ?? f.name.replace('.blkx', ''),
        name: (r.bulletName ?? f.name.replace('.blkx', ''))
          .replace(/^(us|su|uk|fr|cn|il|it|jp|sw|sa)_/, '')
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
  'Data/air-to-ground-ballistics.json',
  JSON.stringify({
    repository: `https://github.com/${repo}`,
    commit: sha,
    version: version.trim(),
    sourceDate: head.commit.committer.date,
    fetchedAt: new Date().toISOString(),
    missiles: unique,
    skipped,
  }),
);
console.log(
  JSON.stringify({
    count: unique.length,
    skipped,
    commit: sha,
    version: version.trim(),
    names: unique.map((x) => x.name),
  }),
);
