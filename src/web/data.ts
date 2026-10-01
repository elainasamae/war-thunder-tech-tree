import type {
  CountriesIndex,
  DetailTab,
  JsonObject,
  ModNames,
  NameIndex,
  TreeData,
  Vehicle,
  VehicleType,
} from './types';

const cache = new Map<string, Promise<unknown>>();
export function readJson<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    const request = fetch(`${import.meta.env.BASE_URL}${file}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`读取 ${file} 失败（${response.status}）`);
        return response.json();
      })
      .catch((error) => {
        cache.delete(file); // A network failure must remain retryable.
        throw error;
      });
    cache.set(file, request);
  }
  return cache.get(file) as Promise<T>;
}
export const loadCountries = () => readJson<CountriesIndex>('countries.json');
export const loadNames = () => readJson<NameIndex>('vehicle-names-zh.json');
export const loadModNames = () => readJson<ModNames>('mod-names-zh.json');
export async function loadTree(country: string, type: VehicleType): Promise<TreeData> {
  const treeRequest = readJson<TreeData>(`${country}-${type}.json`);
  if (type !== 'aviation') return treeRequest;
  const [tree, ratings] = await Promise.all([
    treeRequest,
    readJson<{
      vehicles: Record<string, { battle_rating_trb: string; battle_rating_tsb: string }>;
    }>('aircraft-ground-battle-ratings.json'),
  ]);
  return {
    ...tree,
    vehicles: tree.vehicles.map((vehicle) => ({
      ...vehicle,
      ...ratings.vehicles[vehicle.unit_id],
    })),
  };
}
const files: Record<Exclude<DetailTab, 'basic' | 'modifications'>, string> = {
  equipment: 'vehicle-auxiliary-equipment.json',
  specifications: 'vehicle-specifications.json',
  ammunition: 'vehicle-ammunition.json',
  loadouts: 'aircraft-loadouts.json',
};
export async function loadDetail(
  country: string,
  type: VehicleType,
  vehicle: Vehicle,
  tab: DetailTab,
) {
  if (tab === 'basic') return null;
  const file = tab === 'modifications' ? `${country}-${type}-mods.json` : files[tab];
  const indexRequest = readJson<{ vehicles: Record<string, JsonObject> }>(file);
  const dependenciesRequest =
    tab === 'modifications'
      ? readJson<{ vehicles: Record<string, Record<string, string[]>> }>(
          'modification-dependencies.json',
        )
      : Promise.resolve(null);
  const tierRequest =
    tab === 'modifications'
      ? readJson<{ vehicles: Record<string, { required_to_unlock_next: Record<string, number> }> }>(
          'modification-tier-requirements.json',
        )
      : Promise.resolve(null);
  const [index, dependencies, tiers] = await Promise.all([
    indexRequest,
    dependenciesRequest,
    tierRequest,
  ]);
  const detail =
    index.vehicles[vehicle.unit_id] ??
    (tab === 'modifications' && vehicle.group_id ? index.vehicles[vehicle.group_id] : null) ??
    null;
  if (!detail || !dependencies) return detail;
  const requirements = dependencies.vehicles[vehicle.unit_id] ?? {};
  return {
    ...detail,
    tier_requirements: tiers?.vehicles[vehicle.unit_id]?.required_to_unlock_next ?? {},
    categories: (detail.categories as JsonObject[]).map((category) => ({
      ...category,
      mods: (category.mods as JsonObject[]).map((mod) => ({
        ...mod,
        requirement_ids: requirements[String(mod.mod_id)] ?? [],
      })),
    })),
  };
}
export const formatNumber = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('zh-CN');
export const vehicleName = (vehicle: Vehicle, names: NameIndex | null, chinese: boolean) =>
  chinese ? names?.vehicles[vehicle.unit_id] || vehicle.vehicle : vehicle.vehicle;
