import {
  ArrowRight,
  Crosshair,
  Download,
  Languages,
  Minus,
  Plane,
  Plus,
  Radar,
  RotateCcw,
  Route,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { registerResearchTool } from './webmcp';
import { formatNumber, loadCountries, loadNames, loadTree, vehicleName } from './data';
import { planResearch } from './planner';
import { availableModes, modes, normalizeMode } from './modes';
import TechTree from './TechTree';
import VehicleDetails from './VehicleDetails';
import type { CountriesIndex, Mode, NameIndex, TreeData, Vehicle, VehicleType } from './types';

const types = [
  { code: 'ground', label: '陆军', icon: Shield },
  { code: 'aviation', label: '空军', icon: Plane },
  { code: 'helicopter', label: '直升机', icon: Radar },
] as const;
const badges: Record<string, string> = {
  usa: 'US',
  germany: 'DE',
  ussr: 'SU',
  britain: 'GB',
  japan: 'JP',
  china: 'CN',
  italy: 'IT',
  france: 'FR',
  sweden: 'SE',
  israel: 'IL',
};
function readSettings(): { country: string; type: VehicleType; mode: Mode; chinese: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem('wt-settings') || '{}');
    const type = types.some((type) => type.code === value.type) ? value.type : 'ground';
    return {
      country: Object.hasOwn(badges, value.country) ? value.country : 'usa',
      type,
      mode: normalizeMode(modes.some((mode) => mode.code === value.mode) ? value.mode : 'rb', type),
      chinese: value.chinese !== false,
    };
  } catch {
    return { country: 'usa', type: 'ground', mode: 'rb', chinese: true };
  }
}
const initial = readSettings();
export default function App() {
  const [index, setIndex] = useState<CountriesIndex | null>(null);
  const [names, setNames] = useState<NameIndex | null>(null);
  const [countryCode, setCountryCode] = useState(initial.country);
  const [type, setType] = useState<VehicleType>(initial.type);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [chinese, setChinese] = useState(initial.chinese);
  const [tree, setTree] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(new Set<string>());
  const [expanded, setExpanded] = useState(new Set<string>());
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState('all');
  const [special, setSpecial] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [detail, setDetail] = useState<Vehicle | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState('');
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadCountries(), loadNames()])
      .then(([countries, translations]) => {
        if (alive) {
          setIndex(countries);
          setNames(translations);
        }
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setDetail(null);
    setSelected(new Set());
    setExpanded(new Set());
    setRouteInfo('');
    setQuery('');
    setRank('all');
    setPlanOpen(false);
    setQuickPlanOpen(false);
    setTargetId('');
    setTargetQuery('');
    loadTree(countryCode, type)
      .then((data) => {
        if (alive) {
          setTree(data);
          setLoading(false);
          viewport.current?.scrollTo(0, 0);
        }
      })
      .catch((error) => {
        if (alive) {
          setTree(null);
          setLoading(false);
          setError(error.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [countryCode, type, retry]);
  useEffect(() => {
    try {
      localStorage.setItem(
        'wt-settings',
        JSON.stringify({ country: countryCode, type, mode, chinese }),
      );
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [countryCode, type, mode, chinese]);

  const country = index?.countries.find((country) => country.code === countryCode);
  const activeTree =
    tree?.country_code === countryCode && tree.vehicle_type === type && !loading ? tree : null;
  const selectedVehicles =
    activeTree?.vehicles.filter((vehicle) => selected.has(vehicle.unit_id)) ?? [];
  const totalRp = selectedVehicles.reduce((sum, vehicle) => sum + (vehicle.research_rp ?? 0), 0);
  const totalSl = selectedVehicles.reduce((sum, vehicle) => sum + (vehicle.purchase_sl ?? 0), 0);
  const filteredTree = useMemo(() => {
    if (!activeTree) return null;
    const search = query.trim().toLocaleLowerCase();
    return {
      ...activeTree,
      vehicles: activeTree.vehicles.filter(
        (vehicle) =>
          (rank === 'all' || vehicle.rank === rank) &&
          (special || vehicle.tree_section === 'researchable') &&
          (!search ||
            `${vehicle.vehicle} ${names?.vehicles[vehicle.unit_id] || ''} ${vehicle.unit_id}`
              .toLocaleLowerCase()
              .includes(search)),
      ),
    };
  }, [activeTree, names, query, rank, special]);
  const ranks = [...new Set(activeTree?.vehicles.map((vehicle) => vehicle.rank) ?? [])];
  const researchTargets =
    activeTree?.vehicles.filter((vehicle) => vehicle.tree_section === 'researchable') ?? [];
  const matchingTargets = researchTargets.filter((vehicle) =>
    `${vehicle.vehicle} ${names?.vehicles[vehicle.unit_id] || ''} ${vehicle.unit_id}`
      .toLocaleLowerCase()
      .includes(targetQuery.trim().toLocaleLowerCase()),
  );
  const quickTarget =
    matchingTargets.find((vehicle) => vehicle.unit_id === targetId) ?? matchingTargets[0];
  const clear = () => {
    setSelected(new Set());
    setRouteInfo('');
    setPlanOpen(false);
  };
  function toggleSelection(vehicle: Vehicle) {
    if (vehicle.tree_section === 'researchable') setTargetId(vehicle.unit_id);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(vehicle.unit_id)) next.delete(vehicle.unit_id);
      else next.add(vehicle.unit_id);
      return next;
    });
    setRouteInfo('');
  }
  function selectRoute(vehicle: Vehicle) {
    if (!activeTree) return;
    const route = planResearch(activeTree, vehicle);
    setSelected(new Set(route.vehicles.map((item) => item.unit_id)));
    setExpanded(new Set());
    setQuery('');
    setRank('all');
    setSpecial(true);
    setDetail(null);
    setPlanOpen(true);
    setQuickPlanOpen(false);
    setTargetId(vehicle.unit_id);
    setRouteInfo(
      `目标：${vehicleName(vehicle, names, chinese)} · 补充 ${route.extraCount} 辆满足等级解锁`,
    );
  }
  function exportPlan() {
    const content = {
      country: countryCode,
      type,
      mode,
      game_data_version: index?.game_data_version,
      total_research_rp: totalRp,
      total_purchase_sl: totalSl,
      vehicles: selectedVehicles.map((vehicle) => ({
        unit_id: vehicle.unit_id,
        name: vehicleName(vehicle, names, chinese),
        rank: vehicle.rank,
        research_rp: vehicle.research_rp,
        purchase_sl: vehicle.purchase_sl,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `wt-plan-${countryCode}-${type}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  useEffect(() => {
    if (!activeTree) return;
    return registerResearchTool(activeTree, (vehicle) => {
      flushSync(() => selectRoute(vehicle));
    });
  }, [activeTree, names, chinese]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-caption">
          选择国家 <span>NATIONS</span>
        </div>
        <nav aria-label="国家选择" className="nation-list">
          {index?.countries.map((item) => (
            <button
              key={item.code}
              className={`nation ${countryCode === item.code ? 'active' : ''}`}
              aria-pressed={countryCode === item.code}
              onClick={() => setCountryCode(item.code)}
            >
              <span className={`nation-badge ${item.code}`}>{badges[item.code]}</span>
              <span>
                <b>{item.name}</b>
                <small>{item.name_en}</small>
              </span>
              {countryCode === item.code && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <nav className="type-tabs" aria-label="兵种">
            {types.map((item) => (
              <button
                key={item.code}
                className={type === item.code ? 'active' : ''}
                aria-pressed={type === item.code}
                onClick={() => {
                  setType(item.code);
                  setMode((previous) => normalizeMode(previous, item.code));
                }}
              >
                <item.icon size={17} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="live-dot" /> 本地数据已就绪
            <small>
              游戏版本 {index?.game_data_version ?? '—'}
              <br />
              {index?.generated_at.slice(0, 10) ?? '正在读取数据'}
            </small>
            <p>
              非官方社区项目
              <br />
              War Thunder © Gaijin
            </p>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="page-header">
          <div>
            <div className="eyebrow">
              战争雷霆 <span>/</span> 载具数据库
            </div>
            <h1>
              {country?.name ?? '科技树'}
              <span>科技树</span>
              <small>{country?.name_en?.toUpperCase() ?? 'TECH TREE'}</small>
            </h1>
          </div>
          <div className="header-controls">
            <div className="mode-control">
              <span>战斗模式</span>
              <div className="mode-tabs" aria-label="战斗模式">
                {availableModes(type).map((item) => (
                  <button
                    key={item.code}
                    className={mode === item.code ? 'active' : ''}
                    aria-pressed={mode === item.code}
                    onClick={() => setMode(item.code)}
                  >
                    {item.label} <small>{item.code.toUpperCase()}</small>
                  </button>
                ))}
              </div>
            </div>
            <button className="language-button" onClick={() => setChinese((value) => !value)}>
              <Languages size={16} />
              {chinese ? '中文名称' : 'English names'}
            </button>
          </div>
        </header>
        <section className="workspace" aria-label="科技树工作区">
          <div className="tree-toolbar">
            <div className="tree-title">
              <Crosshair size={16} />
              <b>{types.find((item) => item.code === type)?.label}科技树</b>
              <span>{activeTree?.vehicles.length ?? '—'} 辆载具</span>
            </div>
            <div className="filters">
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="搜索载具"
                  placeholder="搜索名称或载具 ID…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    viewport.current?.scrollTo(0, 0);
                  }}
                />
                {query && (
                  <button aria-label="清空搜索" onClick={() => setQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </label>
              <select
                aria-label="等级筛选"
                value={rank}
                onChange={(event) => {
                  setRank(event.target.value);
                  viewport.current?.scrollTo(0, 0);
                }}
              >
                <option value="all">全部等级</option>
                {ranks.map((rank) => (
                  <option key={rank} value={rank}>
                    等级 {rank}
                  </option>
                ))}
              </select>
              <label className="special-filter">
                <input
                  type="checkbox"
                  checked={special}
                  onChange={(event) => setSpecial(event.target.checked)}
                />
                特殊载具
              </label>
            </div>
          </div>
          <div className="tree-viewport" ref={viewport} aria-busy={loading}>
            {error ? (
              <div className="empty-state" role="alert">
                <Shield size={32} />
                <h2>数据读取失败</h2>
                <p>{error}</p>
                <button className="primary-button" onClick={() => setRetry((value) => value + 1)}>
                  重新加载
                </button>
              </div>
            ) : loading || !index || !names ? (
              <div className="empty-state">
                <span className="spinner" />
                <p>正在加载科技树…</p>
              </div>
            ) : !filteredTree?.vehicles.length ? (
              <div className="empty-state">
                <Search size={32} />
                <h2>没有找到匹配载具</h2>
                <p>尝试其他名称，或调整等级和特殊载具筛选。</p>
                <button
                  onClick={() => {
                    setQuery('');
                    setRank('all');
                    setSpecial(true);
                  }}
                >
                  重置筛选
                </button>
              </div>
            ) : (
              <TechTree
                tree={filteredTree}
                names={names}
                chinese={chinese}
                mode={mode}
                selected={selected}
                expanded={expanded}
                zoom={zoom}
                maxRank={Math.max(
                  ...(activeTree?.vehicles.map((vehicle) => vehicle.rank_number) ?? [0]),
                )}
                onSelect={toggleSelection}
                onDetails={setDetail}
                onGroup={(id) =>
                  setExpanded((previous) => {
                    return previous.has(id) ? new Set() : new Set([id]);
                  })
                }
              />
            )}
          </div>
          <div className="tree-bottom">
            <div className="legend">
              <span>
                <i />
                常规
              </span>
              <span>
                <i className="gold" />
                金币
              </span>
              <span>
                <i className="green" />
                联队
              </span>
              <span>
                <i className="purple" />
                活动
              </span>
              <em>点击选择 · 右键 / ⓘ 查看详情</em>
            </div>
            <div className="zoom-controls">
              <button
                aria-label="缩小科技树"
                disabled={zoom <= 0.6}
                onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.1).toFixed(1)))}
              >
                <Minus size={14} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="放大科技树"
                disabled={zoom >= 1.4}
                onClick={() => setZoom((value) => Math.min(1.4, +(value + 0.1).toFixed(1)))}
              >
                <Plus size={14} />
              </button>
              <button aria-label="重置缩放" onClick={() => setZoom(1)}>
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        </section>
        <section className="plan-bar" aria-label="研发计划">
          <div className="plan-label">
            <span className="plan-symbol">↗</span>
            <div>
              <b>研发计划</b>
              <small>
                {routeInfo ? '按研发点估算 · 从零进度开始' : '选择载具，计算你的研发投入'}
              </small>
            </div>
          </div>
          <div className="plan-stat">
            <span>已选择</span>
            <strong>
              {selectedVehicles.length}
              <small> 辆</small>
            </strong>
          </div>
          <div className="plan-stat">
            <span>研发点</span>
            <strong className="rp-total">
              {formatNumber(totalRp)}
              <small> RP</small>
            </strong>
          </div>
          <div className="plan-stat">
            <span>购买银狮</span>
            <strong>
              {formatNumber(totalSl)}
              <small> SL</small>
            </strong>
          </div>
          <div className="plan-actions">
            <button
              className="quick-plan-button"
              disabled={!researchTargets.length}
              aria-expanded={quickPlanOpen}
              aria-controls="quick-research-panel"
              onClick={() => {
                setQuickPlanOpen((value) => !value);
                setTargetQuery('');
                setPlanOpen(false);
              }}
            >
              <Route size={15} /> 快速研发
            </button>
            <button
              aria-label="清空选择"
              title="清空选择"
              disabled={!selectedVehicles.length}
              onClick={clear}
            >
              <Trash2 size={16} />
            </button>
            <button
              className="primary-button"
              disabled={!selectedVehicles.length}
              onClick={() => {
                setPlanOpen((value) => !value);
                setQuickPlanOpen(false);
              }}
            >
              查看计划 <ArrowRight size={15} />
            </button>
          </div>
        </section>
        {quickPlanOpen && (
          <section
            className="plan-panel quick-research-panel"
            id="quick-research-panel"
            aria-label="快速研发计算"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuickPlanOpen(false);
            }}
          >
            <div className="plan-panel-header">
              <div>
                <b>快速研发</b>
                <p>选择目标，自动补齐前置载具和等级解锁所需载具，计算资源合计。</p>
              </div>
              <button aria-label="关闭快速研发" onClick={() => setQuickPlanOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form
              className="quick-research-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (quickTarget) selectRoute(quickTarget);
              }}
            >
              <label>
                搜索目标
                <input
                  aria-label="搜索研发目标"
                  autoFocus
                  placeholder="输入载具名称或 ID…"
                  value={targetQuery}
                  onChange={(event) => setTargetQuery(event.target.value)}
                />
              </label>
              <label>
                目标载具
                <select
                  aria-label="目标载具"
                  value={quickTarget?.unit_id ?? ''}
                  disabled={!matchingTargets.length}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  {!matchingTargets.length && <option value="">没有匹配的可研发载具</option>}
                  {matchingTargets.map((vehicle) => (
                    <option key={vehicle.unit_id} value={vehicle.unit_id}>
                      {vehicleName(vehicle, names, chinese)} · 等级 {vehicle.rank}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="submit" disabled={!quickTarget}>
                <Route size={16} /> 计算研发路线
              </button>
            </form>
            <p className="quick-research-note">
              从零进度按研发点估算，未扣除已拥有载具；银狮仅包含载具购买费用。采用贪心规划，不保证全局最低费用。
            </p>
          </section>
        )}
        {planOpen && selectedVehicles.length > 0 && (
          <section className="plan-panel">
            <div className="plan-panel-header">
              <div>
                <b>已选载具 · {selectedVehicles.length} 辆</b>
                <p>
                  {routeInfo || '手动选择的研发计划'}
                  {selectedVehicles.some((vehicle) => vehicle.purchase_sl == null) &&
                    ' · 金鹰/礼包等费用另计'}
                </p>
              </div>
              <button onClick={exportPlan}>
                <Download size={15} />
                导出 JSON
              </button>
              <button aria-label="关闭计划" onClick={() => setPlanOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="route-resources" role="group" aria-label="到达目标所需资源">
              <span>
                载具 <b>{selectedVehicles.length} 辆</b>
              </span>
              <span>
                研发点 <b>{formatNumber(totalRp)} RP</b>
              </span>
              <span>
                购买银狮 <b>{formatNumber(totalSl)} SL</b>
              </span>
            </div>
          </section>
        )}
      </main>
      {detail && activeTree && (
        <VehicleDetails
          key={detail.unit_id}
          vehicle={detail}
          country={countryCode}
          type={type}
          mode={mode}
          chinese={chinese}
          names={names}
          onClose={() => setDetail(null)}
          onPlan={() => selectRoute(detail)}
        />
      )}
    </div>
  );
}
