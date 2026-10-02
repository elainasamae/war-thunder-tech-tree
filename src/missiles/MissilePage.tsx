import { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  Search,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  X,
  Plane,
  Shield,
  GitBranch,
} from 'lucide-react';
import {
  COLORS,
  DEFAULTS,
  guidance,
  missileName,
  simulate,
  type Conditions,
  type Dataset,
  type Flight,
} from './physics';
const fields: [keyof Conditions, string, number, number, number, string][] = [
  ['launchAltitude', '发射高度', 0, 25000, 100, 'm'],
  ['launchSpeed', '发射速度', 100, 2500, 50, 'km/h'],
  ['launchAngle', '发射仰角', -60, 60, 1, '°'],
  ['targetAltitude', '目标高度', 0, 25000, 100, 'm'],
  ['distance', '初始距离', 500, 100000, 500, 'm'],
  ['targetSpeed', '目标速度', 0, 2500, 50, 'km/h'],
  ['targetCourse', '目标航向', 0, 360, 5, '°'],
];
const num = (v: number, d = 0) => v.toLocaleString('zh-CN', { maximumFractionDigits: d });
const nearest = (f: Flight, t: number) =>
  f.samples[Math.min(f.samples.length - 1, Math.max(0, Math.round(t / 0.1)))];
type View = 'side' | 'top' | '3d' | 'speed';
function Plot({
  flights,
  time,
  view,
  rotation,
}: {
  flights: Flight[];
  time: number;
  view: View;
  rotation: number;
}) {
  const [compact, setCompact] = useState(window.innerWidth < 680);
  useEffect(() => {
    const resize = () => setCompact(window.innerWidth < 680);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const width = compact ? 450 : 1000,
    height = compact ? 310 : 460,
    pad = compact ? 54 : 62;
  const project = (x: number, y: number, z: number, t: number, speed: number): [number, number] =>
    view === 'speed'
      ? [t, speed]
      : view === 'side'
        ? [x / 1000, y / 1000]
        : view === 'top'
          ? [x / 1000, z / 1000]
          : [
              (x * Math.cos(rotation) - z * Math.sin(rotation)) / 1000,
              (y + (x * Math.sin(rotation) + z * Math.cos(rotation)) * 0.28) / 1000,
            ];
  const pts = flights.flatMap((f) =>
    f.samples.flatMap((s) => [
      project(s.x, s.y, s.z, s.t, s.speed),
      ...(view === 'speed' ? [] : [project(s.tx, s.ty, s.tz, s.t, 0)]),
    ]),
  );
  let minX = Math.min(0, ...pts.map((p) => p[0])),
    maxX = Math.max(1, ...pts.map((p) => p[0])),
    minY = Math.min(0, ...pts.map((p) => p[1])),
    maxY = Math.max(1, ...pts.map((p) => p[1]));
  const marginX = (maxX - minX) * 0.04,
    marginY = (maxY - minY) * 0.08;
  minX -= marginX;
  maxX += marginX;
  minY -= marginY;
  maxY += marginY;
  const xy = (p: [number, number]) => [
    pad + ((p[0] - minX) / (maxX - minX)) * (width - pad - 22),
    height - pad - ((p[1] - minY) / (maxY - minY)) * (height - pad - 22),
  ];
  const line = (f: Flight, target = false) =>
    f.samples
      .filter((s) => s.t <= time)
      .map((s) =>
        xy(target ? project(s.tx, s.ty, s.tz, s.t, 0) : project(s.x, s.y, s.z, s.t, s.speed))
          .map((n) => n.toFixed(2))
          .join(','),
      )
      .join(' ');
  const ylabel =
    view === 'speed'
      ? '速度 (km/h)'
      : view === 'side'
        ? '高度 (km)'
        : view === 'top'
          ? '横向距离 (km)'
          : '投影高度 (km)';
  return (
    <svg
      className="flight-plot"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="导弹弹道曲线"
    >
      <title>导弹与目标的近似模拟弹道</title>
      {Array.from({ length: 6 }, (_, i) => {
        const fx = pad + (i * (width - pad - 22)) / 5,
          fy = height - pad - (i * (height - pad - 22)) / 5;
        return (
          <g key={i}>
            <line x1={fx} x2={fx} y1={22} y2={height - pad} className="grid" />
            <line x1={pad} x2={width - 22} y1={fy} y2={fy} className="grid" />
            <text x={fx} y={height - pad + 25} textAnchor="middle">
              {num(minX + ((maxX - minX) * i) / 5, 1)}
            </text>
            <text x={pad - 10} y={fy + 4} textAnchor="end">
              {num(minY + ((maxY - minY) * i) / 5, view === 'speed' ? 0 : 1)}
            </text>
          </g>
        );
      })}
      <text x={width / 2} y={height - 10} textAnchor="middle">
        {view === 'speed' ? '飞行时间 (s)' : view === '3d' ? '水平投影 (km)' : '纵向距离 (km)'}
      </text>
      <text transform={`translate(15 ${height / 2}) rotate(-90)`} textAnchor="middle">
        {ylabel}
      </text>
      {flights.map((f, i) => {
        const s = nearest(f, time);
        if (!s) return null;
        const p = xy(project(s.x, s.y, s.z, s.t, s.speed));
        const target = xy(project(s.tx, s.ty, s.tz, s.t, 0));
        return (
          <g key={f.missile.id}>
            <polyline points={line(f)} stroke={COLORS[i]} strokeWidth="3" fill="none" />
            <circle cx={p[0]} cy={p[1]} r="5" fill={COLORS[i]}>
              <title>
                {missileName(f.missile)} · {num(s.speed)} km/h · {num(s.t, 1)} s
              </title>
            </circle>
            {view !== 'speed' && i === 0 && (
              <>
                <polyline
                  points={line(f, true)}
                  stroke="#8090aa"
                  strokeWidth="2"
                  strokeDasharray="7 5"
                  fill="none"
                />
                <rect x={target[0] - 5} y={target[1] - 5} width="10" height="10" fill="#8090aa">
                  <title>目标</title>
                </rect>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
export default function MissilePage() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('全部'),
    [selected, setSelected] = useState<string[]>(['us_aim_120a', 'su_r_27er']);
  const [conditions, setConditions] = useState<Conditions>(DEFAULTS),
    [applied, setApplied] = useState<Conditions>(DEFAULTS),
    [inputError, setInputError] = useState('');
  const [view, setView] = useState<View>('side'),
    [rotation, setRotation] = useState(0.45),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(2),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/air-to-air-ballistics.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((j: Dataset) => {
        if (!j.missiles?.length) throw Error();
        setData(j);
        setSelected((old) => {
          const ok = old.filter((id) => j.missiles.some((m) => m.id === id));
          return ok.length ? ok : [j.missiles[0].id];
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('导弹参数加载失败，请重试。');
      });
    return () => controller.abort();
  }, [retry]);
  const flights = useMemo(
    () =>
      data?.missiles
        .filter((m) => selected.includes(m.id))
        .sort((a, b) => selected.indexOf(a.id) - selected.indexOf(b.id))
        .map((m) => simulate(m, applied)) ?? [],
    [data, selected, applied],
  );
  const duration = Math.max(1, ...flights.map((f) => f.samples.at(-1)?.t ?? 0));
  useEffect(() => {
    setPlaying(false);
    setTime(duration);
  }, [flights, duration]);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        elapsed = ((now - previous) / 1000) * rate;
      previous = now;
      setTime((t) => {
        if (t + elapsed >= duration) {
          setPlaying(false);
          return duration;
        }
        return t + elapsed;
      });
    }, 40);
    return () => clearInterval(timer);
  }, [playing, rate, duration]);
  const filtered =
    data?.missiles.filter(
      (m) =>
        (kind === '全部' || guidance(m) === kind) &&
        `${missileName(m)} ${m.id}`
          .toLowerCase()
          .replaceAll('-', '')
          .includes(query.toLowerCase().replaceAll('-', '')),
    ) ?? [];
  const dirty = JSON.stringify(conditions) !== JSON.stringify(applied);
  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s,
    );
  }
  function calculate() {
    const bad = fields.find(
      ([key, , min, max]) =>
        !Number.isFinite(Number(conditions[key])) ||
        Number(conditions[key]) < min ||
        Number(conditions[key]) > max,
    );
    if (bad) {
      setInputError(`${bad[1]}应在 ${bad[2]}–${bad[3]} ${bad[5]} 内`);
      return;
    }
    setInputError('');
    setApplied({ ...conditions });
  }
  return (
    <div className="missile-app">
      <header className="missile-header">
        <a href="/" className="brand">
          <Crosshair size={24} />
          <span>
            战争雷霆 <b>弹道实验室</b>
          </span>
        </a>
        <nav aria-label="页面导航">
          <a href="/">
            <Plane size={16} />
            科技树
          </a>
          <a href="/u/">
            <Shield size={16} />
            UID 黑名单
          </a>
          <a href="/m/" aria-current="page">
            空空导弹
          </a>
        </nav>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <span className="eyebrow">AIR-TO-AIR</span>
            <h1>空空导弹弹道</h1>
          </div>
          <span className="model-label">近似模拟 · 非游戏原始弹道</span>
        </div>
        {error ? (
          <div role="alert" className="load-error">
            {error}
            <button onClick={() => setRetry((n) => n + 1)}>重新加载</button>
          </div>
        ) : !data ? (
          <div className="load-error">正在加载游戏参数…</div>
        ) : (
          <div className="workspace">
            <aside className="glass missile-picker">
              <div className="panel-heading">
                <h2>导弹选择</h2>
                <span>{data.missiles.length} 个参数型号</span>
              </div>
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="搜索导弹"
                  placeholder="搜索 AIM-120、R-73…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select aria-label="制导类型" value={kind} onChange={(e) => setKind(e.target.value)}>
                {['全部', '红外', '主动雷达', '半主动雷达', '其他'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <p className="selection-hint">已选 {selected.length} / 4 · 同条件比较</p>
              <div className="missile-list">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    className={`missile-option ${selected.includes(m.id) ? 'selected' : ''}`}
                    disabled={!selected.includes(m.id) && selected.length >= 4}
                    onClick={() => toggle(m.id)}
                    aria-pressed={selected.includes(m.id)}
                  >
                    <span className="checkmark">{selected.includes(m.id) ? '✓' : '+'}</span>
                    <span>
                      <strong>{missileName(m)}</strong>
                      <small>
                        {guidance(m)} · {num(m.rocket.mass, 1)} kg
                      </small>
                    </span>
                  </button>
                ))}
                {!filtered.length && <p className="empty">没有匹配的导弹</p>}
              </div>
            </aside>
            <section className="results">
              <div className="glass conditions">
                <div className="panel-heading">
                  <h2>发射条件</h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setConditions(DEFAULTS);
                      setApplied(DEFAULTS);
                      setInputError('');
                    }}
                  >
                    <RotateCcw size={14} />
                    重置
                  </button>
                </div>
                <div className="conditions-grid">
                  {fields.map(([key, label, min, max, step, unit]) => (
                    <label key={key}>
                      <span>
                        {label}
                        <small>{unit}</small>
                      </span>
                      <input
                        type="number"
                        aria-label={label}
                        min={min}
                        max={max}
                        step={step}
                        value={Number.isNaN(conditions[key]) ? '' : Number(conditions[key])}
                        onChange={(e) =>
                          setConditions((c) => ({
                            ...c,
                            [key]: e.target.value === '' ? NaN : Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="conditions-footer">
                  <label className="loft">
                    <input
                      type="checkbox"
                      checked={conditions.loft}
                      onChange={(e) => setConditions((c) => ({ ...c, loft: e.target.checked }))}
                    />
                    启用高抛近似（仅有高抛参数的型号）
                  </label>
                  <button className="primary" onClick={calculate} disabled={!selected.length}>
                    计算弹道{dirty ? ' · 条件已修改' : ''}
                  </button>
                </div>
                <p className="course-note">
                  目标航向：0° 同向远离，180° 迎面，90° 横向。目标保持匀速、等高。
                </p>
                {inputError && (
                  <p role="alert" className="input-error">
                    {inputError}
                  </p>
                )}
              </div>
              <div className="glass plot-panel">
                <div className="plot-toolbar">
                  <div className="view-tabs" role="group" aria-label="图表视图">
                    {(['side', 'top', '3d', 'speed'] as View[]).map((v, i) => (
                      <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                        {['侧视弹道', '俯视弹道', '空间投影', '速度曲线'][i]}
                      </button>
                    ))}
                  </div>
                  <span>
                    {num(time, 1)} / {num(duration, 1)} s
                  </span>
                </div>
                {flights.length ? (
                  <>
                    <Plot flights={flights} time={time} view={view} rotation={rotation} />
                    {view === '3d' && (
                      <label className="rotation">
                        投影角度
                        <input
                          type="range"
                          aria-label="投影角度"
                          min="-3.14"
                          max="3.14"
                          step=".01"
                          value={rotation}
                          onChange={(e) => setRotation(Number(e.target.value))}
                        />
                      </label>
                    )}
                    <div className="legend">
                      {flights.map((f, i) => (
                        <button key={f.missile.id} onClick={() => toggle(f.missile.id)}>
                          <i style={{ background: COLORS[i] }} />
                          {missileName(f.missile)}
                          <X size={12} />
                        </button>
                      ))}
                      {view !== 'speed' && (
                        <span>
                          <i className="target-marker" />
                          目标（虚线）
                        </span>
                      )}
                    </div>
                    <div className="playback">
                      <button
                        aria-label={playing ? '暂停回放' : '播放弹道'}
                        onClick={() => {
                          if (time >= duration) setTime(0);
                          setPlaying((p) => !p);
                        }}
                      >
                        {playing ? <Pause size={17} /> : <Play size={17} />}
                      </button>
                      <input
                        type="range"
                        aria-label="回放时间"
                        min={0}
                        max={duration}
                        step=".1"
                        value={time}
                        onChange={(e) => {
                          setPlaying(false);
                          setTime(Number(e.target.value));
                        }}
                      />
                      <select
                        aria-label="回放速度"
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                      >
                        {[0.5, 1, 2, 4, 8].map((n) => (
                          <option key={n} value={n}>
                            {n}×
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="empty-plot">
                    <Crosshair size={38} />
                    <p>从左侧选择导弹，查看弹道</p>
                  </div>
                )}
              </div>
              {flights.length > 0 && (
                <div className="glass telemetry">
                  <div className="panel-heading">
                    <h2>飞行数据</h2>
                    <span>游标 {num(time, 1)} s · 超出存活时间时显示末帧</span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>导弹</th>
                          <th>当前速度</th>
                          <th>当前高度</th>
                          <th>当前推力</th>
                          <th>最近距离</th>
                          <th>模拟结束原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flights.map((f, i) => {
                          const s = nearest(f, time);
                          return (
                            <tr key={f.missile.id}>
                              <th>
                                <i style={{ background: COLORS[i] }} />
                                {missileName(f.missile)}
                              </th>
                              <td>{num(s.speed)} km/h</td>
                              <td>{num(s.y)} m</td>
                              <td>{num(s.thrust)} N</td>
                              <td>{num(f.closest, 1)} m</td>
                              <td>{f.reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <details className="glass source-panel">
                <summary>
                  <GitBranch size={16} />
                  数据来源与计算方式 · 游戏 {data.version}
                </summary>
                <div className="source-content">
                  <p>
                    参数：
                    <a href={data.repository} target="_blank" rel="noreferrer">
                      gszabi99 / War-Thunder-Datamine <ExternalLink size={13} />
                    </a>
                    ，提交{' '}
                    <a
                      href={`${data.repository}/commit/${data.commit}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {data.commit.slice(0, 12)}
                    </a>
                    ，时间 {new Date(data.sourceDate).toLocaleDateString('zh-CN')}
                    。每个参数型号保留原始文件链接；不保证所有型号当前都可装备。
                  </p>
                  <p>
                    本页使用自编的点质量模拟：标准大气、分段推力、燃烧时线性减重、重力、理想比例导引，以及按游戏
                    CxK
                    缩放的经验阻力系数。高抛仅按参数仰角加入初段抬升，新式多推进段暂按编号顺序燃烧，未复现游戏脉冲触发逻辑；未复现游戏
                    PID、高抛退出条件、迎角阻力、气动力限制、外部气压对推力的修正、雷达/红外捕获、干扰或目标机动。未提供导航系数时采用
                    3、过载上限采用 10
                    G；这些是模型假设。结果用于游戏弹道趋势展示，不能作为实际命中距离。
                  </p>
                  <p>
                    参考{' '}
                    <a
                      href="https://statshark.net/missilecalculator"
                      target="_blank"
                      rel="noreferrer"
                    >
                      StatShark 导弹计算器
                    </a>
                    的发射条件和图表组织。其公开前端调用服务端 CalcMissileRange
                    接口；目前未查到其服务端算法和明确的上游仓库声明，本页不调用该接口，也不声称与其结果一致。
                  </p>
                  <div className="parameter-cards">
                    {flights.map((f) => {
                      const r = f.missile.rocket;
                      return (
                        <article key={f.missile.id}>
                          <a href={f.missile.source} target="_blank" rel="noreferrer">
                            {missileName(f.missile)}
                            <ExternalLink size={13} />
                          </a>
                          <dl>
                            <dt>初始质量</dt>
                            <dd>{num(r.mass, 2)} kg</dd>
                            <dt>第一级推力 / 时长</dt>
                            <dd>
                              {num(r.motorStages?.[0]?.force ?? r.force)} N /{' '}
                              {num(r.motorStages?.[0]?.duration ?? r.timeFire, 2)} s
                            </dd>
                            <dt>第二级推力 / 时长</dt>
                            <dd>
                              {r.motorStages?.[1]
                                ? `${num(r.motorStages[1].force)} N / ${num(r.motorStages[1].duration, 2)} s`
                                : r.timeFire1
                                  ? `${num(r.force1 ?? 0)} N / ${num(r.timeFire1, 2)} s`
                                  : '无'}
                            </dd>
                            <dt>存活时间</dt>
                            <dd>{r.timeLife} s</dd>
                            <dt>高抛参数</dt>
                            <dd>
                              {r.guidance?.guidanceAutopilot?.loftEnabled
                                ? `${r.guidance.guidanceAutopilot.loftElevation ?? '未提供'}°`
                                : '无'}
                            </dd>
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </details>
            </section>
          </div>
        )}
      </main>
      <footer>非官方项目 · 游戏内容 © Gaijin Entertainment · 弹道为近似模拟</footer>
    </div>
  );
}
