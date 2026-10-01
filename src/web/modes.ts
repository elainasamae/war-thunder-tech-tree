import type { Mode, VehicleType } from './types';

export const modes = [
  { code: 'ab', label: '街机' },
  { code: 'rb', label: '历史' },
  { code: 'trb', label: '历史（陆战）' },
  { code: 'sb', label: '全真' },
  { code: 'tsb', label: '全真（陆战）' },
] as const;

export const availableModes = (type: VehicleType) =>
  modes.filter((mode) => type === 'aviation' || !['trb', 'tsb'].includes(mode.code));

// Aircraft retain the same flight model in ground battles; only their rating differs.
export const performanceMode = (mode: Mode): 'ab' | 'rb' | 'sb' =>
  mode === 'trb' ? 'rb' : mode === 'tsb' ? 'sb' : mode;

export const normalizeMode = (mode: Mode, type: VehicleType): Mode =>
  type === 'aviation' ? mode : performanceMode(mode);

export const modeLabel = (mode: Mode) => modes.find((item) => item.code === mode)!.label;
