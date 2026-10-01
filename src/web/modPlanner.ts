export interface PlanMod {
  id: string;
  tier: number;
  researchRp: number;
  prerequisites: string[];
}
export type TierRequirements = Record<string, number>;

export function modTierStates(
  mods: PlanMod[],
  selected: Set<string>,
  requirements: TierRequirements,
) {
  const maxTier = Math.max(...mods.map((mod) => mod.tier), 1);
  let unlocked = true;
  return Array.from({ length: maxTier }, (_, index) => {
    const tier = index + 1;
    const total = mods.filter((mod) => mod.tier === tier).length;
    const count = mods.filter((mod) => mod.tier === tier && selected.has(mod.id)).length;
    const required = tier < maxTier ? requirements[tier] : 0;
    const nextUnlocked: boolean = unlocked && count >= required;
    const state = { tier, total, count, required, unlocked, nextUnlocked };
    unlocked = nextUnlocked;
    return state;
  });
}

// A deterministic RP-based estimate. Existing targets are retained, dependencies
// are closed, then each lower tier is filled with inexpensive valid candidates.
export function planModifications(
  mods: PlanMod[],
  targets: Set<string>,
  requirements: TierRequirements,
) {
  const byId = new Map(mods.map((mod) => [mod.id, mod]));
  const selected = new Set<string>();
  function closure(id: string, result: Set<string>) {
    if (result.has(id) || !byId.has(id)) return;
    result.add(id);
    for (const prerequisite of byId.get(id)!.prerequisites) closure(prerequisite, result);
  }
  for (const id of targets) closure(id, selected);
  for (let pass = 0; pass <= mods.length; pass++) {
    const before = selected.size;
    const highestTier = Math.max(
      ...mods.filter((mod) => selected.has(mod.id)).map((mod) => mod.tier),
      1,
    );
    for (let tier = highestTier - 1; tier >= 1; tier--) {
      const candidates = mods.filter((mod) => mod.tier === tier);
      const required = requirements[tier] ?? 0;
      while (candidates.filter((mod) => selected.has(mod.id)).length < required) {
        const options = candidates
          .filter((mod) => !selected.has(mod.id))
          .map((mod, order) => {
            const ids = new Set(selected);
            closure(mod.id, ids);
            const rp = [...ids]
              .filter((id) => !selected.has(id))
              .reduce((sum, id) => sum + byId.get(id)!.researchRp, 0);
            return { ids, rp, order };
          })
          .sort((a, b) => a.rp - b.rp || a.order - b.order);
        if (!options.length) break;
        for (const id of options[0].ids) selected.add(id);
      }
    }
    if (selected.size === before) break;
  }
  return {
    selected,
    extraCount: [...selected].filter((id) => !targets.has(id)).length,
    tiers: modTierStates(mods, selected, requirements),
  };
}
