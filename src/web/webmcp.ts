import { planResearch } from './planner';
import type { TreeData, Vehicle } from './types';

interface ModelContext {
  registerTool(tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute(input: unknown): unknown;
  }, options: { signal: AbortSignal }): void | Promise<void>;
}

export function registerResearchTool(tree: TreeData, selectRoute: (vehicle: Vehicle) => void) {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(context.registerTool({
      name: 'select_research_route',
      title: '选择研发路线',
      description: 'For a researchable vehicle in the currently displayed nation and branch, select the estimated low-RP route from zero progress and display its resource summary. Uses the same planner as the quick research button; does not spend resources.',
      inputSchema: {
        type: 'object',
        properties: { unit_id: { type: 'string', description: 'Vehicle ID in the current tech tree.' } },
        required: ['unit_id'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            Object.keys(input).length !== 1 || !('unit_id' in input) ||
            typeof input.unit_id !== 'string') throw new Error('Provide only a string unit_id.');
        const vehicle = tree.vehicles.find((item) => item.unit_id === input.unit_id);
        if (!vehicle || vehicle.tree_section !== 'researchable')
          throw new Error('Choose a researchable vehicle in the currently displayed tech tree.');
        const route = planResearch(tree, vehicle);
        selectRoute(vehicle);
        return {
          target_id: vehicle.unit_id,
          vehicle_count: route.vehicles.length,
          research_rp: route.totalRp,
          purchase_sl: route.totalSl,
          strategy: 'estimated greedy RP route from zero progress',
        };
      },
    }, { signal: lifecycle.signal })).catch(() => lifecycle.abort());
  } catch { lifecycle.abort(); }
  return () => lifecycle.abort();
}
