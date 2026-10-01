import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLayout, CARD_HEIGHT, CARD_WIDTH } from '../src/web/layout';
import { planResearch, unlockRequirement } from '../src/web/planner';
import { availableModes, normalizeMode, performanceMode } from '../src/web/modes';
import { planModifications, type PlanMod, type TierRequirements } from '../src/web/modPlanner';
import type { CountriesIndex, TreeData } from '../src/web/types';
import { readdirSync } from 'node:fs';

function read<T>(file: string): T {
  return JSON.parse(readFileSync(new URL(`../Data/${file}`, import.meta.url), 'utf8'));
}
const countries = read<CountriesIndex>('countries.json').countries;
const trees = countries.flatMap((country) =>
  (['ground', 'aviation', 'helicopter'] as const).map((type) =>
    read<TreeData>(`${country.code}-${type}.json`),
  ),
);

test('all 30 trees retain their 2,660 vehicles, unique IDs and all mode ratings', () => {
  assert.equal(countries.length, 10);
  assert.equal(trees.length, 30);
  assert.equal(
    trees.reduce((sum, tree) => sum + tree.vehicles.length, 0),
    2660,
  );
  for (const tree of trees) {
    assert.equal(new Set(tree.vehicles.map((v) => v.unit_id)).size, tree.vehicles.length);
    for (const vehicle of tree.vehicles) {
      for (const mode of ['ab', 'rb', 'sb'] as const)
        assert.ok(vehicle[`battle_rating_${mode}`] && vehicle[`battle_rating_${mode}`] !== '—');
    }
  }
});

test('tree slots never overlap and retain all folder members at narrow and wide widths', () => {
  for (const tree of trees) {
    for (const width of [0, 2200]) {
      const layout = buildLayout(tree, width);
      assert.ok(layout.cards.length > 0);
      assert.equal(layout.cards.flatMap((card) => card.members).length, tree.vehicles.length);
      for (const [index, card] of layout.cards.entries()) {
        assert.ok(
          card.x >= 0 &&
            card.x + CARD_WIDTH <= layout.width &&
            card.y + CARD_HEIGHT <= layout.height,
        );
        for (const other of layout.cards.slice(index + 1)) {
          const overlaps =
            card.x < other.x + CARD_WIDTH &&
            other.x < card.x + CARD_WIDTH &&
            card.y < other.y + CARD_HEIGHT &&
            other.y < card.y + CARD_HEIGHT;
          assert.ok(
            !overlaps,
            `${tree.country_code}-${tree.vehicle_type}: ${card.vehicle.unit_id} overlaps ${other.vehicle.unit_id}`,
          );
        }
      }
    }
  }
});

test('every researchable target produces a closed route with valid tier unlocks and totals', () => {
  for (const tree of trees) {
    for (const target of tree.vehicles.filter((v) => v.tree_section === 'researchable')) {
      const route = planResearch(tree, target);
      const ids = new Set(route.vehicles.map((v) => v.unit_id));
      assert.ok(ids.has(target.unit_id));
      assert.equal(ids.size, route.vehicles.length);
      for (const vehicle of route.vehicles) {
        if (vehicle.requirement_id) {
          const prerequisite = tree.vehicles.find((v) => v.unit_id === vehicle.requirement_id);
          const group = tree.vehicles.filter((v) => v.group_id === vehicle.requirement_id);
          if (prerequisite) assert.ok(ids.has(prerequisite.unit_id));
          else if (group.length) assert.ok(group.some((v) => ids.has(v.unit_id)));
        }
      }
      for (const rank of [...new Set(tree.vehicles.map((v) => v.rank_number))].filter(
        (rank) => rank < target.rank_number,
      )) {
        const available = tree.vehicles.filter(
          (v) => v.rank_number === rank && v.tree_section === 'researchable',
        ).length;
        assert.ok(
          route.vehicles.filter((v) => v.rank_number === rank && v.tree_section === 'researchable')
            .length >= Math.min(available, unlockRequirement(tree.vehicle_type, rank)),
          `${target.unit_id}: rank ${rank}`,
        );
      }
      assert.equal(
        route.totalRp,
        route.vehicles.reduce((sum, v) => sum + (v.research_rp ?? 0), 0),
      );
      assert.equal(
        route.totalSl,
        route.vehicles.reduce((sum, v) => sum + (v.purchase_sl ?? 0), 0),
      );
    }
  }
});

test('cyclic prerequisites terminate without duplicating vehicles', () => {
  const original = trees[0];
  const a = { ...original.vehicles[0], requirement_id: original.vehicles[1].unit_id };
  const b = { ...original.vehicles[1], requirement_id: a.unit_id };
  const route = planResearch({ ...original, vehicles: [a, b] }, a);
  assert.equal(route.vehicles.length, 2);
});

test('all aircraft have ground battle ratings, available only for aviation', () => {
  const ratings = read<{
    vehicles: Record<string, { battle_rating_trb: string; battle_rating_tsb: string }>;
  }>('aircraft-ground-battle-ratings.json');
  const aircraft = trees
    .filter((tree) => tree.vehicle_type === 'aviation')
    .flatMap((tree) => tree.vehicles);
  assert.equal(Object.keys(ratings.vehicles).length, aircraft.length);
  for (const vehicle of aircraft) {
    for (const mode of ['trb', 'tsb'] as const) {
      assert.match(ratings.vehicles[vehicle.unit_id][`battle_rating_${mode}`], /^\d+\.[037]$/);
    }
  }
  assert.equal(ratings.vehicles['p-26a_34_m2'].battle_rating_trb, '1.0');
  assert.equal(ratings.vehicles['f_16c_block_50'].battle_rating_trb, '12.7');
  assert.deepEqual(
    availableModes('aviation').map((mode) => mode.code),
    ['ab', 'rb', 'trb', 'sb', 'tsb'],
  );
  for (const type of ['ground', 'helicopter'] as const) {
    assert.deepEqual(
      availableModes(type).map((mode) => mode.code),
      ['ab', 'rb', 'sb'],
    );
    assert.equal(normalizeMode('trb', type), 'rb');
    assert.equal(normalizeMode('tsb', type), 'sb');
  }
  assert.equal(performanceMode('trb'), 'rb');
  assert.equal(performanceMode('tsb'), 'sb');
});

test('modification dependencies use real per-vehicle IDs and preserve the Su-30 missile chain', () => {
  const data = read<{ vehicle_count: number; vehicles: Record<string, Record<string, string[]>> }>(
    'modification-dependencies.json',
  );
  assert.equal(data.vehicle_count, Object.keys(data.vehicles).length);
  let edgeCount = 0;
  for (const file of readdirSync(new URL('../Data/', import.meta.url)).filter((file) =>
    file.endsWith('-mods.json'),
  )) {
    const index = read<{
      vehicles: Record<string, { categories: { mods: { mod_id: string }[] }[] }>;
    }>(file);
    for (const [id, vehicle] of Object.entries(index.vehicles)) {
      const ids = new Set(
        vehicle.categories.flatMap((category) => category.mods.map((mod) => mod.mod_id)),
      );
      if (!ids.size) continue;
      const dependencies = data.vehicles[id];
      assert.ok(dependencies, `Missing dependency list: ${id}`);
      for (const [target, prerequisites] of Object.entries(dependencies)) {
        assert.ok(ids.has(target));
        for (const prerequisite of prerequisites) {
          assert.ok(ids.has(prerequisite));
          assert.notEqual(prerequisite, target);
          edgeCount++;
        }
      }
    }
  }
  assert.ok(edgeCount > 5000);
  const chain = data.vehicles.su_30sm2;
  assert.deepEqual(chain.mig_29_r_73, ['mig_29_r_27et']);
  assert.deepEqual(chain.mig_29_r_27er, ['mig_29_r_73']);
  assert.deepEqual(chain.su_r_77_1, ['mig_29_r_27er']);
  assert.equal(chain.structure_str, undefined);
  assert.equal(chain.su_x29td_x59m, undefined);
});

test('every modification target satisfies previous-tier counts and direct prerequisites', () => {
  const gates = read<{ vehicles: Record<string, { required_to_unlock_next: TierRequirements }> }>(
    'modification-tier-requirements.json',
  );
  const deps = read<{ vehicles: Record<string, Record<string, string[]>> }>(
    'modification-dependencies.json',
  );
  for (const file of readdirSync(new URL('../Data/', import.meta.url)).filter((file) =>
    file.endsWith('-mods.json'),
  )) {
    const index = read<{
      vehicles: Record<
        string,
        { categories: { mods: { mod_id: string; tier: number; research_rp: number }[] }[] }
      >;
    }>(file);
    for (const [id, vehicle] of Object.entries(index.vehicles)) {
      const mods: PlanMod[] = vehicle.categories.flatMap((category) =>
        category.mods.map((mod) => ({
          id: mod.mod_id,
          tier: mod.tier,
          researchRp: mod.research_rp ?? 0,
          prerequisites: deps.vehicles[id]?.[mod.mod_id] ?? [],
        })),
      );
      if (!mods.length) continue;
      assert.ok(gates.vehicles[id], `Missing tier requirements: ${id}`);
      const requirements = gates.vehicles[id].required_to_unlock_next;
      for (const target of mods) {
        const plan = planModifications(mods, new Set([target.id]), requirements);
        assert.ok(plan.selected.has(target.id));
        for (const selected of mods.filter((mod) => plan.selected.has(mod.id))) {
          assert.ok(
            plan.tiers[selected.tier - 1].unlocked,
            `${id}: tier ${selected.tier} locked for ${selected.id}`,
          );
          for (const prerequisite of selected.prerequisites)
            assert.ok(plan.selected.has(prerequisite));
        }
      }
    }
  }
  assert.deepEqual(gates.vehicles.su_30sm2.required_to_unlock_next, { 1: 1, 2: 3, 3: 3, 4: 3 });
});

test('modification plan uses each previous tier, preserves explicit choices and removes automatic extras with targets', () => {
  const mods: PlanMod[] = [
    { id: 'a', tier: 1, researchRp: 100, prerequisites: [] },
    { id: 'b', tier: 1, researchRp: 1000, prerequisites: [] },
    { id: 'c', tier: 2, researchRp: 200, prerequisites: ['a'] },
    { id: 'd', tier: 2, researchRp: 500, prerequisites: [] },
    { id: 'e', tier: 3, researchRp: 300, prerequisites: ['c'] },
  ];
  const requirements = { 1: 2, 2: 2 };
  const plan = planModifications(mods, new Set(['e']), requirements);
  assert.deepEqual([...plan.selected].sort(), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(plan.extraCount, 4);
  assert.equal(plan.tiers[2].unlocked, true);
  const empty = planModifications(mods, new Set(), requirements);
  assert.equal(empty.selected.size, 0);
  assert.equal(empty.tiers[1].unlocked, false);
  const chosen = planModifications(mods, new Set(['b', 'c']), { 1: 1 });
  assert.ok(chosen.selected.has('b'));
  assert.ok(chosen.selected.has('a'));
  assert.equal(chosen.extraCount, 1);
});
