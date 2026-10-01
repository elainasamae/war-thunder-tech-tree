import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  LockKeyhole,
  Route,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { modDescriptions } from './modDescriptions';
import ModConnections from './ModConnections';
import { planModifications, type TierRequirements } from './modPlanner';
import { modeLabel, performanceMode } from './modes';
import { formatNumber, loadDetail, loadModNames, vehicleName } from './data';
import type {
  DetailTab,
  Json,
  JsonObject,
  Mode,
  ModNames,
  NameIndex,
  Vehicle,
  VehicleType,
} from './types';

const allTabs: { id: DetailTab; label: string }[] = [
  { id: 'basic', label: '载具资料' },
  { id: 'equipment', label: '辅助设备' },
  { id: 'specifications', label: '车辆性能' },
  { id: 'ammunition', label: '弹药数据' },
  { id: 'loadouts', label: '挂载数据' },
  { id: 'modifications', label: '改装件' },
];
const labels: Record<string, string> = {
  forward_speed: '前进极速',
  reverse_speed: '倒车极速',
  weight: '战斗全重',
  engine_power: '发动机功率',
  power_to_weight: '推重比',
  turret_horizontal: '炮塔水平转速',
  turret_vertical: '炮塔垂直转速',
  reload: '装填时间（基础 / 王牌）',
  vertical_guidance: '俯仰角',
  maximum_speed: '最大速度',
  climb_rate: '爬升率',
  turn_time: '转弯时间',
  max_altitude: '最大高度',
  takeoff_run: '起飞滑跑距离',
  Caliber: '口径',
  'Fuze Delay': '引信延迟',
  'Fuze Sensitivity': '引信灵敏度',
  'Explosive Type': '炸药类型',
  'Explosive Mass': '装药量',
  'TNT equivalent': 'TNT 当量',
  'Projectile Mass': '弹体质量',
  Guidance: '制导方式',
  Aspect: '攻击角度',
  'Launch range': '发射距离',
  'Maximum speed': '最大速度',
  'Maximum overload': '最大过载',
  'Missile guidance time': '制导时间',
  'Lock range': '锁定距离',
  'Lock range in rear-aspect': '尾向锁定距离',
  'Lock range in all-aspect': '全向锁定距离',
  'Shoot down': '下视能力',
  Band: '波段',
  IRCCM: '红外抗干扰',
  'Cumulative jet': '破甲射流',
  Kinetic: '动能',
};
function object(value: Json | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function items(value: Json | undefined): JsonObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function text(value: Json | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? '有' : '无';
  if (Array.isArray(value)) return value.map(text).join(' / ');
  if (typeof value === 'object')
    return Object.entries(value)
      .filter(([key]) => key !== 'unit')
      .map(([key, value]) => `${labels[key] || key}: ${text(value)}`)
      .join(' · ');
  return String(value);
}
function numeric(value: Json | undefined) {
  return typeof value === 'number' ? value : 0;
}
function modeValue(value: Json, mode: Mode) {
  const record = object(value);
  if (!Object.keys(record).length) return text(value);
  const current = record[performanceMode(mode)] ?? value;
  const range = object(current);
  let result: string;
  if ('minimum' in range) result = `${text(range.minimum)} – ${text(range.maximum)}`;
  else if ('basic' in range) result = `${text(range.basic)} / ${text(range.aces)}`;
  else result = text(current);
  return `${result} ${record.unit ?? ''}`.trim();
}
function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="detail-rows">
      {rows.map(([label, value], index) => (
        <div key={`${label}-${index}`}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Equipment({ data }: { data: JsonObject }) {
  const equipment = items(data.equipment);
  const thermals = items(data.thermal_imaging);
  if (!equipment.length && !thermals.length) return <Empty />;
  return (
    <>
      <h3>车载设备</h3>
      <div className="equipment-grid">
        {equipment.map((entry, index) => (
          <div key={index} className={`equipment-item ${entry.present ? 'present' : ''}`}>
            <span>{text(entry.label)}</span>
            <b>
              {entry.present ? <Check size={17} /> : '无'}
              {entry.present && entry.quantity ? (
                <small>
                  {text(object(entry.quantity).perSalvo)} / {text(object(entry.quantity).total)}
                </small>
              ) : null}
            </b>
          </div>
        ))}
      </div>
      <h3>热成像</h3>
      {thermals.length ? (
        <Rows
          rows={thermals.map((entry) => [
            text(entry.label),
            [entry.quality === 'high' ? '高清' : '低清', entry.generation, entry.resolution]
              .filter(Boolean)
              .join(' · '),
          ])}
        />
      ) : (
        <p className="muted">未收录热成像设备。</p>
      )}
    </>
  );
}
function Ammunition({ data }: { data: JsonObject }) {
  const rounds = items(data.ammunition);
  if (!rounds.length) return <Empty />;
  return (
    <>
      <div className="detail-note">
        {text(data.weapon)} <span>穿深单位：mm · 距离单位：m</span>
      </div>
      {rounds.map((round, index) => (
        <details className="round-card" key={index} open={index === 0 || round.name === 'M829A3'}>
          <summary>
            <b>{text(round.name)}</b>
            <span className="tag">{text(round.type)}</span>
            <span>{text(round.muzzle_velocity)}</span>
          </summary>
          <div className="round-body">
            <Rows
              rows={[
                ['弹体质量', text(round.projectile_mass)],
                ['初速', text(round.muzzle_velocity)],
                ...items(round.characteristics).map((entry): [string, string] => [
                  labels[text(entry.label)] || text(entry.label),
                  text(entry.value),
                ]),
                ...(round.fragmentation_penetration_mm != null
                  ? [
                      ['破片穿深', `${text(round.fragmentation_penetration_mm)} mm`] as [
                        string,
                        string,
                      ],
                    ]
                  : []),
              ]}
            />
            {items(round.penetration_profiles).map((profile, profileIndex) => {
              const angles = Array.isArray(profile.angles_deg) ? profile.angles_deg.map(text) : [];
              return (
                <div className="penetration" key={profileIndex}>
                  <h4>{labels[text(profile.mechanism)] || text(profile.mechanism)}穿深</h4>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>距离 m</th>
                          {angles.map((angle) => (
                            <th key={angle}>{angle}°</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items(profile.penetration_mm).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <th>{text(row.distance_m)}</th>
                            {angles.map((angle) => (
                              <td key={angle}>{text(object(row.by_angle)[angle])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </>
  );
}
function Loadouts({ data }: { data: JsonObject }) {
  const [search, setSearch] = useState('');
  const [slot, setSlot] = useState('all');
  const [active, setActive] = useState<{
    weapon: JsonObject;
    anchor: HTMLButtonElement;
    slot?: number;
  } | null>(null);
  function openWeapon(weapon: JsonObject, anchor: HTMLButtonElement, slot?: number) {
    setActive((previous) => (previous?.anchor === anchor ? null : { weapon, anchor, slot }));
  }
  const weapons = items(data.weapons);
  const slots = Array.from({ length: numeric(data.slot_count) }, (_, index) => index + 1);
  const filtered = weapons.filter(
    (entry) =>
      text(entry.name).toLowerCase().includes(search.toLowerCase()) &&
      (slot === 'all' ||
        (Array.isArray(entry.available_slots) && entry.available_slots.includes(Number(slot)))),
  );
  if (!weapons.length) return <Empty />;
  return (
    <>
      <div className="loadout-limits">
        <span>
          最大挂载 <b>{text(data.maximum_load)}</b>
        </span>
        <span>
          单侧机翼 <b>{text(data.wing_load_maximum)}</b>
        </span>
        <span>
          最大左右差 <b>{text(data.maximum_imbalance)}</b>
        </span>
      </div>
      <div className="loadout-filters">
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="搜索挂载武器"
            placeholder="搜索武器名称…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActive(null);
            }}
          />
        </label>
        <select
          aria-label="挂点筛选"
          value={slot}
          onChange={(event) => {
            setSlot(event.target.value);
            setActive(null);
          }}
        >
          <option value="all">全部 {slots.length} 个挂点</option>
          {slots.map((slot) => (
            <option key={slot} value={slot}>
              挂点 {slot}
            </option>
          ))}
        </select>
      </div>
      <div className="table-scroll loadout-table">
        <table>
          <thead>
            <tr>
              <th>挂载武器</th>
              <th>重量</th>
              {slots.map((slot) => (
                <th key={slot}>{slot}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, index) => (
              <tr key={`${text(entry.name)}-${index}`}>
                <th>
                  <button
                    aria-haspopup="dialog"
                    aria-expanded={active?.weapon === entry && active.slot == null}
                    onClick={(event) => openWeapon(entry, event.currentTarget)}
                  >
                    <WeaponIcon url={entry.icon_url} />
                    <span>{text(entry.name)}</span>
                  </button>
                </th>
                <td>{text(entry.weight)}</td>
                {slots.map((slot) => (
                  <td key={slot}>
                    {Array.isArray(entry.available_slots) &&
                    entry.available_slots.includes(slot) ? (
                      <button
                        className="compatible"
                        aria-label={`${text(entry.name)} 挂点 ${slot} 参数`}
                        aria-haspopup="dialog"
                        aria-expanded={active?.weapon === entry && active.slot === slot}
                        onClick={(event) => openWeapon(entry, event.currentTarget, slot)}
                      >
                        <WeaponIcon url={entry.icon_url} />
                      </button>
                    ) : (
                      '·'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="muted">没有匹配的挂载武器。</p>}
      {active && (
        <DetailPopover
          className="weapon-detail-popover"
          anchor={active.anchor}
          title={text(active.weapon.name)}
          label={`${text(active.weapon.name)} 挂载详情`}
          closeLabel="关闭挂载详情"
          icon={<WeaponIcon key={text(active.weapon.icon_url)} url={active.weapon.icon_url} />}
          onClose={() => setActive(null)}
        >
          <Rows
            rows={[
              ...(active.slot != null
                ? [['当前挂点', String(active.slot)] as [string, string]]
                : []),
              ['挂载重量', text(active.weapon.weight)],
              ['可用挂点', text(active.weapon.available_slots)],
              ...items(active.weapon.parameters).map((entry): [string, string] => [
                labels[text(entry.label)] || text(entry.label),
                text(entry.value),
              ]),
            ]}
          />
          {!items(active.weapon.parameters).length && (
            <p className="detail-note">暂无更多武器参数</p>
          )}
          {active.weapon.battle_zone_damage != null && (
            <p className="detail-note">战区伤害：{text(active.weapon.battle_zone_damage)}</p>
          )}
        </DetailPopover>
      )}
    </>
  );
}
function WeaponIcon({ url }: { url: Json | undefined }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="weapon-icon" aria-hidden="true">
      {typeof url === 'string' && url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <Crosshair size={20} />
      )}
    </span>
  );
}
function ModIcon({ url }: { url: Json | undefined }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="mod-icon" aria-hidden="true">
      {typeof url === 'string' && url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <Wrench size={24} />
      )}
    </span>
  );
}
interface ModPopoverProps {
  mod: JsonObject;
  name: string;
  anchor: HTMLButtonElement;
  allUnlocked: boolean;
  chosen: boolean;
  autoIncluded: boolean;
  tierRequirement: string;
  prerequisites: string[];
  onClose: () => void;
}
interface DetailPopoverProps {
  anchor: HTMLButtonElement;
  className: string;
  title: string;
  subtitle?: string;
  label: string;
  closeLabel: string;
  icon: ReactNode;
  children: ReactNode;
  onClose: () => void;
}
function DetailPopover({
  anchor,
  className,
  title,
  subtitle,
  label,
  closeLabel,
  icon,
  children,
  onClose,
}: DetailPopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    if (!element.matches(':popover-open')) element.showPopover();
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const hosts = [anchor.closest('.detail-content'), anchor.closest('.table-scroll')];
      if (
        !anchor.isConnected ||
        hosts.some((host) => {
          if (!host) return false;
          const bounds = host.getBoundingClientRect();
          return (
            rect.bottom < bounds.top ||
            rect.top > bounds.bottom ||
            rect.right < bounds.left ||
            rect.left > bounds.right
          );
        })
      ) {
        element.hidePopover();
        return;
      }
      const bounds = element.getBoundingClientRect();
      const below = innerHeight - rect.bottom;
      const top =
        below < bounds.height + 8 && rect.top > below
          ? rect.top - bounds.height - 8
          : rect.bottom + 8;
      const next = {
        left: Math.max(8, Math.min(rect.left, innerWidth - bounds.width - 8)),
        top: Math.max(8, Math.min(top, innerHeight - bounds.height - 8)),
      };
      setPosition((previous) =>
        previous.left === next.left && previous.top === next.top ? previous : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);
  return (
    <div
      ref={panel}
      popover="auto"
      className={`detail-popover ${className}`}
      role="dialog"
      aria-label={label}
      style={position}
      onToggle={(event) => {
        if ((event.nativeEvent as ToggleEvent).newState === 'closed') {
          onClose();
          if (anchor.isConnected) anchor.focus({ preventScroll: true });
        }
      }}
    >
      <header>
        {icon}
        <div>
          <h3>{title}</h3>
          {subtitle && <small>{subtitle}</small>}
        </div>
        <button aria-label={closeLabel} onClick={() => panel.current?.hidePopover()}>
          <X size={16} />
        </button>
      </header>
      {children}
    </div>
  );
}
function ModPopover({
  mod,
  name,
  anchor,
  allUnlocked,
  chosen,
  autoIncluded,
  tierRequirement,
  prerequisites,
  onClose,
}: ModPopoverProps) {
  const description =
    typeof mod.description === 'string' ? mod.description : modDescriptions[text(mod.name)];
  const tier = ['', 'I', 'II', 'III', 'IV', 'V'][numeric(mod.tier)] || text(mod.tier);
  return (
    <DetailPopover
      anchor={anchor}
      className="mod-detail-popover"
      title={name}
      subtitle={name !== text(mod.name) ? text(mod.name) : undefined}
      label={`${name} 改装件详情`}
      closeLabel="关闭改装件详情"
      icon={<ModIcon url={mod.icon_url} />}
      onClose={onClose}
    >
      {description && <p className="mod-description">{description}</p>}
      <Rows
        rows={[
          ['等级', tier],
          ...(allUnlocked
            ? ([['解锁状态', '已解锁']] as [string, string][])
            : ([
                ['计划状态', chosen ? '已选为目标' : autoIncluded ? '自动补齐' : '未选择'],
                ['本层解锁', tierRequirement],
              ] as [string, string][])),
          ...(!allUnlocked && prerequisites.length
            ? [['前置改装件', prerequisites.join(' / ')] as [string, string]]
            : []),
          [
            '研发点',
            allUnlocked
              ? '0 RP'
              : mod.research_rp == null
                ? text(mod.research_display)
                : `${formatNumber(numeric(mod.research_rp))} RP`,
          ],
          [
            '购买费用',
            allUnlocked
              ? '0 SL'
              : mod.purchase_sl == null
                ? text(mod.purchase_display)
                : `${formatNumber(numeric(mod.purchase_sl))} SL`,
          ],
          ...(!allUnlocked && mod.ge_cost != null
            ? [['金鹰替代费用', `${formatNumber(numeric(mod.ge_cost))} GE`] as [string, string]]
            : []),
        ]}
      />
      {autoIncluded && <p className="detail-note">已作为前置配件或层级解锁条件自动加入计划。</p>}
    </DetailPopover>
  );
}
function Modifications({
  data,
  dictionary,
  allUnlocked,
}: {
  data: JsonObject;
  dictionary: ModNames | null;
  allUnlocked: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState(new Set<string>());
  const [active, setActive] = useState<{ mod: JsonObject; anchor: HTMLButtonElement } | null>(null);
  const categories = items(data.categories);
  let columnCount = 0;
  const positionedMods = categories.flatMap((category) => {
    const entries = items(category.mods);
    if (!entries.length) return [];
    const offset = columnCount;
    columnCount += Math.max(...entries.map((mod) => numeric(mod.column)), 1);
    return entries.map((mod) => ({ mod, column: offset + Math.max(numeric(mod.column), 1) }));
  });
  const mods = positionedMods.map(({ mod }) => mod);
  if (!mods.length) return <Empty />;
  const requirements = object(data.tier_requirements) as TierRequirements;
  const planMods = mods.map((mod) => ({
    id: text(mod.mod_id),
    tier: numeric(mod.tier),
    researchRp: numeric(mod.research_rp),
    prerequisites: Array.isArray(mod.requirement_ids) ? mod.requirement_ids.map(text) : [],
  }));
  const maxTier = Math.max(...mods.map((mod) => numeric(mod.tier)), 1);
  const plan = allUnlocked
    ? {
        selected: new Set(mods.map((mod) => text(mod.mod_id))),
        extraCount: 0,
        tiers: Array.from({ length: maxTier }, (_, index) => ({
          tier: index + 1,
          required: 0,
          count: 0,
          unlocked: true,
          nextUnlocked: true,
        })),
      }
    : planModifications(planMods, targets, requirements);
  const chosen = plan.selected;
  const toggleTarget = (mod: JsonObject) => {
    if (allUnlocked) return;
    setTargets((previous) => {
      const next = new Set(previous);
      const id = text(mod.mod_id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const rp = allUnlocked
    ? 0
    : mods
        .filter((mod) => chosen.has(text(mod.mod_id)))
        .reduce((sum, mod) => sum + numeric(mod.research_rp), 0);
  const sl = allUnlocked
    ? 0
    : mods
        .filter((mod) => chosen.has(text(mod.mod_id)))
        .reduce((sum, mod) => sum + numeric(mod.purchase_sl), 0);
  const translated = (mod: JsonObject) => {
    const name = text(mod.name);
    const fromDictionary = dictionary?.mods[name] || dictionary?.mods[text(mod.mod_id)];
    if (fromDictionary) return fromDictionary;
    return name
      .replace(/^Offensive (.+) belts$/, '$1 进攻弹链')
      .replace(/^New (.+) cannons$/, '新 $1 机炮')
      .replace(/^New (.+) MGs$/, '新 $1 机枪');
  };
  const byId = new Map(mods.map((mod) => [text(mod.mod_id), mod]));
  const requiredMods = (mod: JsonObject) =>
    (Array.isArray(mod.requirement_ids) ? mod.requirement_ids : [])
      .map((id) => byId.get(text(id)))
      .filter((entry): entry is JsonObject => !!entry);
  const connections = allUnlocked
    ? []
    : mods.flatMap((mod) =>
        requiredMods(mod).map((required) => ({
          from: text(required.mod_id),
          to: text(mod.mod_id),
          label: `${translated(required)} → ${translated(mod)}`,
        })),
      );
  const roman = ['', 'I', 'II', 'III', 'IV'];
  const tierRequirement = (mod: JsonObject) => {
    const tier = numeric(mod.tier);
    if (tier <= 1) return '首层可直接研发';
    const previous = plan.tiers[tier - 2];
    return `第 ${roman[tier - 1]} 层需 ${previous.required} 项，计划已选 ${previous.count} 项`;
  };
  return (
    <>
      <div className="detail-note">
        全部配件 {mods.length} 项 · {allUnlocked ? '全部已解锁' : `已选择 ${chosen.size} 项`}{' '}
        {connections.length > 0 && <em className="mod-order-note">箭头表示前置研发顺序</em>}
        <span>{allUnlocked ? '右键查看详情' : '左键选择 / 取消 · 右键查看详情'}</span>
      </div>
      <div className="mod-scroll">
        <div
          className="mod-grid"
          ref={grid}
          aria-label="改装件网格"
          style={{
            gridTemplateColumns: `92px repeat(${columnCount}, minmax(118px, 1fr))`,
            gridTemplateRows: `repeat(${maxTier}, 46px)`,
            minWidth: 92 + columnCount * 118 + columnCount * 9 + 26,
          }}
        >
          {plan.tiers.map((tier) => (
            <div
              key={tier.tier}
              className={`mod-tier-progress ${tier.nextUnlocked ? 'ready' : ''}`}
              style={{ gridColumn: 1, gridRow: tier.tier }}
            >
              <b>等级 {roman[tier.tier]}</b>
              {allUnlocked ? (
                <span>
                  <Check size={10} />
                  全部已解锁
                </span>
              ) : tier.tier < maxTier ? (
                <>
                  <small>
                    解锁 {roman[tier.tier + 1]} 需 {tier.required} 项
                  </small>
                  <span>
                    {tier.nextUnlocked ? <Check size={10} /> : <LockKeyhole size={10} />}计划{' '}
                    {tier.count} / {tier.required}
                  </span>
                </>
              ) : (
                <small>末层 · 计划 {tier.count} 项</small>
              )}
            </div>
          ))}
          {positionedMods.map(({ mod, column }) => (
            <button
              key={text(mod.mod_id)}
              data-mod-id={text(mod.mod_id)}
              aria-label={
                allUnlocked
                  ? `查看 ${translated(mod)} 改装件详情`
                  : `选择 ${translated(mod)} 改装件`
              }
              aria-pressed={allUnlocked ? undefined : targets.has(text(mod.mod_id))}
              title={
                allUnlocked
                  ? '金币载具配件已解锁，右键查看详情'
                  : chosen.has(text(mod.mod_id)) && !targets.has(text(mod.mod_id))
                    ? '已自动补齐，左键设为计划目标；右键查看详情'
                    : '左键选择或取消；右键查看详情'
              }
              aria-haspopup="dialog"
              aria-expanded={active?.mod === mod}
              className={`${allUnlocked ? 'unlocked' : chosen.has(text(mod.mod_id)) ? 'chosen' : ''} ${active?.mod === mod ? 'active' : ''} ${plan.tiers[numeric(mod.tier) - 1]?.unlocked ? '' : 'tier-locked'}`}
              style={{
                gridColumn: column + 1,
                gridRow: Math.max(numeric(mod.tier), 1),
              }}
              onClick={() => {
                setActive(null);
                toggleTarget(mod);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setActive({ mod, anchor: event.currentTarget });
              }}
              onKeyDown={(event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault();
                  setActive({ mod, anchor: event.currentTarget });
                }
              }}
            >
              <ModIcon url={mod.icon_url} />
              <b>{translated(mod)}</b>
              {chosen.has(text(mod.mod_id)) && <Check size={12} className="mod-chosen-mark" />}
            </button>
          ))}
          <ModConnections grid={grid} connections={connections} />
        </div>
      </div>
      <section className="mod-resource-summary" aria-label="改装件所需资源" aria-live="polite">
        <div>
          <b>所需资源</b>
          {allUnlocked ? (
            <p>金币载具全部改装件已解锁，无需研发或购买。</p>
          ) : plan.extraCount > 0 ? (
            <p className="mod-plan-note">
              目标 {targets.size} 项 · 自动补齐 {plan.extraCount} 项（前置关系及层级解锁）
            </p>
          ) : (
            <p>
              {targets.size
                ? `已选择 ${targets.size} 项目标配件`
                : '左键选择配件，在此查看资源合计'}
            </p>
          )}
        </div>
        <div className="mod-resource-totals">
          <span>
            研发点 <strong>{formatNumber(rp)} RP</strong>
          </span>
          <span>
            购买银狮 <strong>{formatNumber(sl)} SL</strong>
          </span>
        </div>
      </section>
      {active && (
        <ModPopover
          mod={active.mod}
          name={translated(active.mod)}
          anchor={active.anchor}
          allUnlocked={allUnlocked}
          chosen={targets.has(text(active.mod.mod_id))}
          autoIncluded={
            !allUnlocked &&
            chosen.has(text(active.mod.mod_id)) &&
            !targets.has(text(active.mod.mod_id))
          }
          tierRequirement={tierRequirement(active.mod)}
          prerequisites={requiredMods(active.mod).map(translated)}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
function Empty() {
  return (
    <div className="empty-detail">
      <p>该载具暂无这类资料</p>
      <span>可以打开 Wiki 查看原始信息。</span>
    </div>
  );
}

interface Props {
  vehicle: Vehicle;
  country: string;
  type: VehicleType;
  mode: Mode;
  chinese: boolean;
  names: NameIndex | null;
  onClose: () => void;
  onPlan: () => void;
}
export default function VehicleDetails({
  vehicle,
  country,
  type,
  mode,
  chinese,
  names,
  onClose,
  onPlan,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tabs = allTabs.filter((item) =>
    type === 'ground'
      ? item.id !== 'loadouts'
      : item.id !== 'specifications' && item.id !== 'ammunition',
  );
  const [tab, setTab] = useState<DetailTab>('basic');
  const [data, setData] = useState<JsonObject | null>(null);
  const [dictionary, setDictionary] = useState<ModNames | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      current?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    setLoading(tab !== 'basic');
    if (tab !== 'basic') {
      Promise.all([
        loadDetail(country, type, vehicle, tab),
        tab === 'modifications' ? loadModNames() : Promise.resolve(null),
      ])
        .then(([detail, translations]) => {
          if (alive) {
            setData(detail);
            if (translations) setDictionary(translations);
            setLoading(false);
          }
        })
        .catch((error) => {
          if (alive) {
            setError(error.message);
            setLoading(false);
          }
        });
    }
    return () => {
      alive = false;
    };
  }, [country, type, vehicle, tab, retry]);
  const name = vehicleName(vehicle, names, chinese);
  async function copyId() {
    try {
      await navigator.clipboard.writeText(vehicle.unit_id);
      setCopied('已复制');
    } catch {
      setCopied('复制失败，请手动复制下方 ID');
    }
  }
  const basicRows: [string, string][] = [
    ['中文名称', names?.vehicles[vehicle.unit_id] || vehicle.vehicle],
    ['英文名称', vehicle.vehicle],
    ['载具 ID', vehicle.unit_id],
    ['等级', vehicle.rank],
    ['街机权重 AB', vehicle.battle_rating_ab || '—'],
    ['历史权重 RB', vehicle.battle_rating_rb || '—'],
    ['全真权重 SB', vehicle.battle_rating_sb || '—'],
    ...(type === 'aviation'
      ? ([
          ['历史（陆战）权重 TRB', vehicle.battle_rating_trb || '—'],
          ['全真（陆战）权重 TSB', vehicle.battle_rating_tsb || '—'],
        ] as [string, string][])
      : []),
    ['研发点', vehicle.research_rp == null ? '—' : `${formatNumber(vehicle.research_rp)} RP`],
    [
      '购买费用',
      vehicle.purchase_sl == null
        ? vehicle.purchase_display || '—'
        : `${formatNumber(vehicle.purchase_sl)} SL`,
    ],
    [
      '前置载具',
      (vehicle.requirement_id
        ? names?.vehicles[vehicle.requirement_id] || names?.groups[vehicle.requirement_id]
        : null) ||
        vehicle.requirement_name ||
        '无',
    ],
  ];
  return (
    <dialog
      ref={dialog}
      className="vehicle-dialog"
      aria-labelledby="vehicle-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <div className="detail-hero-art">
            {vehicle.image_url && (
              <img
                src={vehicle.image_url}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
          <div className="detail-heading">
            <div className="eyebrow">
              载具档案 <span>/</span> 等级 {vehicle.rank}
            </div>
            <h2 id="vehicle-dialog-title">{name}</h2>
            <p>
              {vehicle.vehicle}{' '}
              <span>
                {mode.toUpperCase()} {vehicle[`battle_rating_${mode}`] || '—'}
              </span>
            </p>
          </div>
          <button className="dialog-close" aria-label="关闭载具详情" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        <div className="detail-tabs" role="tablist" aria-label="载具资料类别">
          {tabs.map((item) => (
            <button
              role="tab"
              id={`tab-${item.id}`}
              aria-controls="detail-tab-panel"
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                if (
                  event.key === 'ArrowLeft' ||
                  event.key === 'ArrowRight' ||
                  event.key === 'Home' ||
                  event.key === 'End'
                ) {
                  event.preventDefault();
                  const index = tabs.findIndex((entry) => entry.id === item.id);
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                          tabs.length;
                  setTab(tabs[next].id);
                  document.getElementById(`tab-${tabs[next].id}`)?.focus();
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="detail-content"
          key={tab}
          id="detail-tab-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          aria-busy={loading}
        >
          {loading ? (
            <div className="empty-detail">
              <span className="spinner" />
              <p>正在读取资料…</p>
            </div>
          ) : error ? (
            <div role="alert" className="empty-detail">
              <p>{error}</p>
              <button onClick={() => setRetry((value) => value + 1)}>重试</button>
            </div>
          ) : tab === 'basic' ? (
            <Rows rows={basicRows} />
          ) : !data ? (
            <Empty />
          ) : tab === 'equipment' ? (
            <Equipment data={data} />
          ) : tab === 'specifications' ? (
            <>
              <p className="detail-note">
                当前为{modeLabel(mode)}
                模式。区间值随改装与乘员熟练度变化。
              </p>
              <Rows
                rows={Object.entries(data)
                  .filter(([key]) => !['vehicle', 'source_url', 'fetch_status'].includes(key))
                  .map(([key, value]) => [labels[key] || key, modeValue(value, mode)])}
              />
            </>
          ) : tab === 'ammunition' ? (
            <Ammunition data={data} />
          ) : tab === 'loadouts' ? (
            <Loadouts data={data} />
          ) : (
            <Modifications
              data={data}
              dictionary={dictionary}
              allUnlocked={vehicle.premium_kind === 'premium'}
            />
          )}
        </div>
        <footer className="dialog-footer">
          <div className="detail-links">
            <button onClick={copyId}>
              <Copy size={15} />
              {copied || '复制 ID'}
            </button>
            {vehicle.url && (
              <a href={vehicle.url} target="_blank" rel="noopener noreferrer">
                War Thunder Wiki <ExternalLink size={14} />
              </a>
            )}
          </div>
          {vehicle.tree_section === 'researchable' && (
            <button className="primary-button" onClick={onPlan}>
              <Route size={16} />
              选择最快研发路径
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
