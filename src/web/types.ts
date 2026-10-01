export type VehicleType = 'ground' | 'aviation' | 'helicopter';
export type Mode = 'ab' | 'rb' | 'sb' | 'trb' | 'tsb';
export interface Country {
  code: string;
  name: string;
  name_en: string;
  flag?: string;
}
export interface CountriesIndex {
  generated_at: string;
  game_data_version?: string;
  countries: Country[];
}
export interface NameIndex {
  vehicles: Record<string, string>;
  groups: Record<string, string>;
}
export interface Vehicle {
  unit_id: string;
  vehicle: string;
  rank: string;
  rank_number: number;
  tree_section: string;
  tree_row: number | null;
  tree_column: number | null;
  tree_order: number;
  group_id: string | null;
  group_name: string | null;
  group_position: number | null;
  premium_kind: string | null;
  requirement_id: string | null;
  requirement_name: string | null;
  image_url: string | null;
  url: string | null;
  research_rp: number | null;
  research_display: string | null;
  purchase_sl: number | null;
  purchase_display: string | null;
  battle_rating_ab: string | null;
  battle_rating_rb: string | null;
  battle_rating_sb: string | null;
  battle_rating_trb?: string | null;
  battle_rating_tsb?: string | null;
}
export interface TreeData {
  country: string;
  country_code: string;
  vehicle_type: VehicleType;
  vehicle_type_name: string;
  generated_at: string;
  vehicles: Vehicle[];
}
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type DetailTab =
  'basic' | 'equipment' | 'specifications' | 'ammunition' | 'loadouts' | 'modifications';
export interface ModNames {
  categories: Record<string, string>;
  mods: Record<string, string>;
}
