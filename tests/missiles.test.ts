import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  atmosphere,
  motor,
  simulate,
  DEFAULTS,
  guidance,
  type Dataset,
} from '../src/missiles/physics';
const data: Dataset = JSON.parse(fs.readFileSync('Data/air-to-air-ballistics.json', 'utf8'));
const aim = data.missiles.find((m) => m.id === 'us_aim_120a')!;
test('staged motor respects burn boundaries and interpolates the extracted masses', () => {
  const r = aim.rocket;
  assert.equal(motor(r, 0).thrust, r.force);
  assert.equal(motor(r, r.timeFire).thrust, r.force1);
  assert.equal(motor(r, r.timeFire).mass, r.massEnd);
  assert.equal(motor(r, r.timeFire + (r.timeFire1 ?? 0) + 1).thrust, 0);
  assert.equal(motor(r, r.timeFire / 2).mass, (r.mass + (r.massEnd ?? r.mass)) / 2);
});
test('standard atmosphere and seeker classification preserve actual game distinctions', () => {
  assert.ok(Math.abs(atmosphere(0).density - 1.225) < 0.002);
  assert.ok(atmosphere(10000).density < atmosphere(1000).density);
  assert.equal(guidance(aim), '主动雷达');
  assert.equal(guidance(data.missiles.find((m) => m.id === 'su_r_73')!), '红外');
});
test('every extracted missile produces finite bounded samples; integration converges', () => {
  for (const m of data.missiles) {
    const f = simulate(m, DEFAULTS);
    assert.ok(f.samples.length > 1, m.id);
    assert.ok(
      f.samples.every((s) => Object.values(s).every(Number.isFinite)),
      m.id,
    );
    assert.ok(f.samples.at(-1)!.t <= m.rocket.timeLife + 0.1, m.id);
  }
  const a = simulate(aim, DEFAULTS, 0.02),
    b = simulate(aim, DEFAULTS, 0.01);
  assert.ok(Math.abs(a.closest - b.closest) < 200);
  assert.ok(Math.abs(a.peakSpeed - b.peakSpeed) / b.peakSpeed < 0.01);
  assert.notDeepEqual(simulate(aim, { ...DEFAULTS, launchAltitude: 1000 }).samples, a.samples);
});

test('new propulsion fields preserve ignition delay and instantaneous mass changes', () => {
  const phoenix = data.missiles.find((m) => m.id === 'us_aim_54c')!;
  assert.equal(motor(phoenix.rocket, 0.2).thrust, 0);
  assert.equal(motor(phoenix.rocket, 0.5).thrust, phoenix.rocket.motorStages![0].force);
  const fireflash = data.missiles.find((m) => m.id === 'uk_fireflash')!;
  assert.equal(motor(fireflash.rocket, 2).mass, 90);
});
