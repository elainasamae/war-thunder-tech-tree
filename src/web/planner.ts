import type { TreeData, Vehicle, VehicleType } from './types';

export const unlockRequirement = (type: VehicleType, rank: number) =>
  type === 'helicopter' ? 1 : type === 'aviation' && rank === 8 ? 3 : rank >= 5 ? 5 : 6;

// Preserve the native planner's greedy RP strategy and tier unlock rules.
// This is an estimate from zero progress, not a proof of global optimality.
export function planResearch(tree: TreeData, target: Vehicle) {
  const vehicles = [...tree.vehicles].sort(
    (a, b) => a.rank_number - b.rank_number || a.tree_order - b.tree_order,
  );
  const byId = new Map(vehicles.map((vehicle) => [vehicle.unit_id, vehicle]));
  const groups = new Map<string, Vehicle[]>();
  for (const vehicle of vehicles) {
    if (vehicle.group_id)
      groups.set(vehicle.group_id, [...(groups.get(vehicle.group_id) ?? []), vehicle]);
  }
  const chain = (vehicle: Vehicle, visiting = new Set<string>()): Vehicle[] => {
    if (visiting.has(vehicle.unit_id)) return [];
    const next = new Set(visiting).add(vehicle.unit_id);
    const prerequisite = vehicle.requirement_id
      ? (byId.get(vehicle.requirement_id) ??
        [...(groups.get(vehicle.requirement_id) ?? [])].sort(
          (a, b) => (a.research_rp ?? 0) - (b.research_rp ?? 0),
        )[0])
      : undefined;
    return [...(prerequisite ? chain(prerequisite, next) : []), vehicle];
  };
  const selected = new Map(chain(target).map((vehicle) => [vehicle.unit_id, vehicle]));
  const extras = new Set<string>();
  // Filling higher ranks can introduce prerequisites in earlier ranks. Revisit
  // those ranks until the plan satisfies every tier used by the target route.
  let changed = true;
  while (changed) {
    changed = false;
    for (const rank of [...new Set(vehicles.map((vehicle) => vehicle.rank_number))].sort(
      (a, b) => a - b,
    )) {
      if (rank >= target.rank_number) break;
      const available = vehicles.filter(
        (vehicle) => vehicle.rank_number === rank && vehicle.tree_section === 'researchable',
      );
      const required = Math.min(unlockRequirement(tree.vehicle_type, rank), available.length);
      while (
        [...selected.values()].filter(
          (vehicle) => vehicle.rank_number === rank && vehicle.tree_section === 'researchable',
        ).length < required
      ) {
        const candidates = available
          .filter((vehicle) => !selected.has(vehicle.unit_id))
          .map((vehicle) => {
            const fresh = chain(vehicle).filter((item) => !selected.has(item.unit_id));
            return {
              vehicle,
              fresh,
              cost: fresh.reduce((sum, item) => sum + (item.research_rp ?? 0), 0),
            };
          })
          .sort(
            (a, b) =>
              a.cost - b.cost ||
              a.fresh.length - b.fresh.length ||
              a.vehicle.tree_order - b.vehicle.tree_order,
          );
        const candidate = candidates[0];
        if (!candidate) break;
        for (const vehicle of candidate.fresh) {
          selected.set(vehicle.unit_id, vehicle);
          extras.add(vehicle.unit_id);
          changed = true;
        }
      }
    }
  }
  const route = [...selected.values()].sort(
    (a, b) => a.rank_number - b.rank_number || a.tree_order - b.tree_order,
  );
  return {
    vehicles: route,
    totalRp: route.reduce((sum, vehicle) => sum + (vehicle.research_rp ?? 0), 0),
    totalSl: route.reduce((sum, vehicle) => sum + (vehicle.purchase_sl ?? 0), 0),
    extraCount: extras.size,
  };
}
