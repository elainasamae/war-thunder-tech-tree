import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { simulate, GROUND_DEFAULTS, guidance, type Dataset } from '../src/missiles/physics';
const ground: Dataset = JSON.parse(fs.readFileSync('Data/air-to-ground-ballistics.json', 'utf8'));
test('air-to-ground seekers distinguish TV, infrared, laser and manual control', () => {
  const get = (id: string) => ground.missiles.find((m) => m.id === id)!;
  assert.equal(guidance(get('us_agm_65a')), '电视');
  assert.equal(guidance(get('us_agm_65d')), '红外');
  assert.equal(guidance(get('us_hellfire_agm_114_k')), '激光');
  assert.equal(guidance(get('us_agm_12b_bullpup')), '指令');
  assert.ok(ground.skipped?.some((x) => x.file === 'su_kh_31a.blkx'));
});
test('ground missile snapshot preserves category, source, stationary ground targets and finite trajectories', () => {
  assert.equal(ground.missiles.length, new Set(ground.missiles.map((m) => m.id)).size);
  for (const m of ground.missiles) {
    assert.equal(m.category, 'air-to-ground');
    assert.ok(m.source.includes(ground.commit));
    const f = simulate(m, GROUND_DEFAULTS);
    assert.ok(f.samples.length > 1, m.id);
    assert.ok(
      f.samples.every((s) => Object.values(s).every(Number.isFinite)),
      m.id,
    );
    assert.ok(
      f.samples.every((s) => s.ty === 0 && s.tx === GROUND_DEFAULTS.distance && s.tz === 0),
      m.id,
    );
  }
  assert.ok(!ground.missiles.some((m) => m.id === 'su_9m342'));
});
