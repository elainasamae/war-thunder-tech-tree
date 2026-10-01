import type { TreeData, Vehicle } from './types';

export const CARD_WIDTH = 154;
export const CARD_HEIGHT = 113;
const GAP = 18;
const ROW_GAP = 32;
const LEFT = 72;
const RIGHT = 24;
const SECTION_GAP = 24;
const TOP = 50;
export interface CardLayout {
  vehicle: Vehicle;
  x: number;
  y: number;
  groupCount: number;
  groupId: string | null;
  groupLead: boolean;
  members: Vehicle[];
}
export interface RankLayout {
  rank: string;
  number: number;
  y: number;
  height: number;
}
export function buildLayout(tree: TreeData, availableWidth = 0) {
  const cards: CardLayout[] = [];
  const ranks: RankLayout[] = [];
  const nodes = new Map<string, { x: number; y: number; height: number }>();
  const researchColumns = tree.vehicle_type === 'helicopter' ? 3 : 5;
  const columns = researchColumns + 2;
  const minimumWidth = LEFT + columns * CARD_WIDTH + (columns - 1) * GAP + SECTION_GAP + RIGHT;
  const width = Math.max(minimumWidth, availableWidth);
  const columnGap = GAP + (width - minimumWidth) / (columns - 1);
  const columnX = (column: number) =>
    LEFT + column * (CARD_WIDTH + columnGap) + (column >= researchColumns ? SECTION_GAP : 0);
  const specialStart = columnX(researchColumns);
  const dividerX = (columnX(researchColumns - 1) + CARD_WIDTH + specialStart) / 2;
  let y = TOP;
  for (const rank of [...new Set(tree.vehicles.map((vehicle) => vehicle.rank_number))].sort(
    (a, b) => a - b,
  )) {
    const vehicles = tree.vehicles.filter((vehicle) => vehicle.rank_number === rank);
    const slots = new Map<string, Vehicle[]>();
    for (const vehicle of vehicles) {
      const key = vehicle.group_id || vehicle.unit_id;
      slots.set(key, [...(slots.get(key) ?? []), vehicle]);
    }
    const lanes = new Map<string, Vehicle[][]>();
    for (const members of slots.values()) {
      members.sort(
        (a, b) =>
          (a.group_position ?? 999) - (b.group_position ?? 999) || a.tree_order - b.tree_order,
      );
      const first = members[0];
      const key = `${first.tree_section}-${first.tree_column}`;
      lanes.set(key, [...(lanes.get(key) ?? []), members]);
    }
    let bottom = y + 50;
    for (const lane of lanes.values()) {
      let nextFreeRow = 1;
      lane.sort(
        (a, b) => (a[0].tree_row ?? 1) - (b[0].tree_row ?? 1) || a[0].tree_order - b[0].tree_order,
      );
      for (const members of lane) {
        const first = members[0];
        const shown = [first];
        const column =
          Math.max(1, first.tree_column ?? 1) -
          1 +
          (first.tree_section === 'premium' ? researchColumns : 0);
        const x = columnX(column);
        // Some source trees assign two independent vehicles to the same slot.
        // Folder members belong to a floating panel, so they never reserve rows.
        const row = Math.max(Math.max(1, first.tree_row ?? 1), nextFreeRow);
        const cardY = y + 52 + (row - 1) * (CARD_HEIGHT + ROW_GAP);
        for (const [index, vehicle] of shown.entries()) {
          const cy = cardY + index * (CARD_HEIGHT + ROW_GAP);
          cards.push({
            vehicle,
            x,
            y: cy,
            groupId: first.group_id,
            groupCount: members.length,
            groupLead: index === 0,
            members,
          });
          nodes.set(vehicle.unit_id, { x, y: cy, height: CARD_HEIGHT });
        }
        for (const member of members) {
          if (!nodes.has(member.unit_id))
            nodes.set(member.unit_id, { x, y: cardY, height: CARD_HEIGHT });
        }
        if (first.group_id) nodes.set(first.group_id, { x, y: cardY, height: CARD_HEIGHT });
        bottom = Math.max(bottom, cardY + shown.length * (CARD_HEIGHT + ROW_GAP));
        nextFreeRow = row + shown.length;
      }
    }
    ranks.push({ rank: vehicles[0].rank, number: rank, y, height: bottom - y + 12 });
    y = bottom + 20;
  }
  const edges = cards.flatMap((card) => {
    const from = card.vehicle.requirement_id ? nodes.get(card.vehicle.requirement_id) : null;
    if (!from || (from.x === card.x && from.y === card.y)) return [];
    const sx = from.x + CARD_WIDTH / 2,
      sy = from.y + from.height + 2;
    const ex = card.x + CARD_WIDTH / 2,
      ey = card.y - 3,
      mid = (sy + ey) / 2;
    return [{ id: card.vehicle.unit_id, path: `M ${sx} ${sy} V ${mid} H ${ex} V ${ey}` }];
  });
  return { cards, ranks, edges, width, height: y + 20, dividerX, specialStart };
}
