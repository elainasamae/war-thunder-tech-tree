export interface MotorStage {
  start: number;
  duration: number;
  force: number;
  massStart: number;
  massEnd: number;
}
export interface Rocket {
  motorStages?: MotorStage[];
  mass: number;
  caliber: number;
  CxK?: number;
  force: number;
  force1?: number;
  force2?: number;
  force3?: number;
  timeFire: number;
  timeFire1?: number;
  timeFire2?: number;
  timeFire3?: number;
  massEnd?: number;
  massEnd1?: number;
  massEnd2?: number;
  massEnd3?: number;
  fireDelay?: number;
  timeLife: number;
  maxDistance?: number;
  loadFactorMax?: number;
  guidanceType?: string;
  guidance?: {
    guidanceAutopilot?: {
      reqAccelMax?: number;
      propNavMult?: number;
      timeOut?: number;
      loftEnabled?: boolean;
      loftElevation?: number;
    };
    radarSeeker?: { active?: boolean };
    irSeeker?: unknown;
  };
}
export interface Missile {
  id: string;
  name: string;
  file: string;
  source: string;
  rocket: Rocket;
}
export interface Dataset {
  repository: string;
  commit: string;
  version: string;
  sourceDate: string;
  missiles: Missile[];
}
export interface Conditions {
  launchAltitude: number;
  launchSpeed: number;
  launchAngle: number;
  targetAltitude: number;
  distance: number;
  targetSpeed: number;
  targetCourse: number;
  loft: boolean;
}
export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  speed: number;
  mach: number;
  thrust: number;
  mass: number;
  g: number;
  distance: number;
}
export interface Flight {
  missile: Missile;
  samples: Sample[];
  reason: string;
  closest: number;
  peakSpeed: number;
  peakAltitude: number;
}
export const DEFAULTS: Conditions = {
  launchAltitude: 5000,
  launchSpeed: 1200,
  launchAngle: 0,
  targetAltitude: 5000,
  distance: 20000,
  targetSpeed: 900,
  targetCourse: 180,
  loft: true,
};
export const COLORS = ['#4c6ef5', '#ec6d43', '#15a6a1', '#a15be0'];
export function missileName(m: Missile) {
  return m.name
    .replace(/AIM ?(\d+)/, 'AIM-$1')
    .replace(/^R ?(\d+)/, 'R-$1')
    .replace(/^PL ?(\d+)/, 'PL-$1')
    .replace(/^AAM ?(\d+)/, 'AAM-$1')
    .replace('PYTON', 'PYTHON')
    .replace(/(120C) (\d)/, '$1-$2')
    .replace(/(R-77) 1/, '$1-1');
}
export function guidance(m: Missile) {
  const r = m.rocket;
  return r.guidanceType === 'ir' || r.guidanceType === 'infrared' || r.guidanceType === 'optical'
    ? '红外'
    : r.guidance?.radarSeeker?.active
      ? '主动雷达'
      : r.guidanceType === 'radar'
        ? '半主动雷达'
        : '其他';
}
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export function atmosphere(height: number) {
  const h = clamp(height, 0, 25000);
  const temperature = h <= 11000 ? 288.15 - 0.0065 * h : 216.65;
  const pressure =
    h <= 11000
      ? 101325 * (temperature / 288.15) ** 5.25588
      : 22632.06 * Math.exp((-(h - 11000) * 9.80665) / (287.05 * temperature));
  return {
    density: pressure / (287.05 * temperature),
    sound: Math.sqrt(1.4 * 287.05 * temperature),
  };
}
export function motor(r: Rocket, t: number) {
  if (r.motorStages) {
    let mass = r.mass;
    let thrust = 0;
    for (const stage of r.motorStages) {
      if (t < stage.start) continue;
      const f = stage.duration === 0 ? 1 : Math.min(1, (t - stage.start) / stage.duration);
      mass -= (stage.massStart - stage.massEnd) * f;
      if (f < 1) thrust += stage.force;
    }
    return { mass, thrust };
  }
  let start = r.fireDelay ?? 0,
    mass = r.mass;
  const forces = [r.force, r.force1, r.force2, r.force3];
  const times = [r.timeFire, r.timeFire1, r.timeFire2, r.timeFire3];
  const ends = [r.massEnd, r.massEnd1, r.massEnd2, r.massEnd3];
  for (let i = 0; i < 4; i++) {
    const duration = times[i] ?? 0;
    if (duration <= 0) continue;
    const end = ends[i] ?? mass;
    if (t < start) return { thrust: 0, mass };
    if (t < start + duration)
      return { thrust: forces[i] ?? 0, mass: mass + ((end - mass) * (t - start)) / duration };
    mass = end;
    start += duration;
  }
  return { thrust: 0, mass };
}
type V = [number, number, number];
const norm = (v: V) => Math.hypot(...v);
const dot = (a: V, b: V) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
// Original, deliberately approximate game visualizer. No Gaijin/StatShark flight code is used.
// Drag law and ideal tracking are assumptions, not extracted game algorithms.
export function simulate(missile: Missile, c: Conditions, dt = 0.02): Flight {
  if (Object.values(c).some((v) => typeof v === 'number' && !Number.isFinite(v)) || dt <= 0)
    throw new Error('请输入有效的发射条件');
  const r = missile.rocket,
    a = (c.launchAngle * Math.PI) / 180,
    course = (c.targetCourse * Math.PI) / 180;
  let p: V = [0, c.launchAltitude, 0],
    v: V = [(c.launchSpeed / 3.6) * Math.cos(a), (c.launchSpeed / 3.6) * Math.sin(a), 0];
  const tv: V = [
    (c.targetSpeed / 3.6) * Math.cos(course),
    0,
    (c.targetSpeed / 3.6) * Math.sin(course),
  ];
  const samples: Sample[] = [];
  let closest = Infinity,
    peakSpeed = 0,
    peakAltitude = c.launchAltitude,
    reason = '达到存活时间',
    travel = 0;
  const stop = Math.min(r.timeLife, 180);
  const ap = r.guidance?.guidanceAutopilot;
  for (let t = 0; t <= stop; t += dt) {
    const target: V = [c.distance + tv[0] * t, c.targetAltitude, tv[2] * t];
    const rel: V = target.map((x, i) => x - p[i]) as V;
    const distance = norm(rel);
    const speed = Math.max(norm(v), 1);
    const air = atmosphere(p[1]);
    const mach = speed / air.sound;
    const mot = motor(r, t);
    closest = Math.min(closest, distance);
    peakSpeed = Math.max(peakSpeed, speed);
    peakAltitude = Math.max(peakAltitude, p[1]);
    let steering: V = [0, 0, 0];
    if (t >= (ap?.timeOut ?? 0) && distance > 1) {
      const rv = tv.map((x, i) => x - v[i]) as V;
      const omega = cross(rel, rv).map((x) => x / (distance * distance)) as V;
      const closing = Math.max(0, -dot(rel, rv) / distance);
      const turn = cross(omega, v.map((x) => x / speed) as V);
      steering = turn.map((x) => x * (ap?.propNavMult ?? 3) * closing) as V;
      // Initial pitch bias only: this is not the game's loft PID/termination logic.
      if (c.loft && ap?.loftEnabled && distance > Math.max(7000, c.distance * 0.55)) {
        const pitch = ((ap.loftElevation ?? 0) * Math.PI) / 180;
        const desired: V = [Math.cos(pitch), Math.sin(pitch), 0];
        const tangent = dot(desired, v) / speed;
        steering = desired.map((x, i) => (x - (tangent * v[i]) / speed) * speed * 0.3) as V;
      }
      const max = (ap?.reqAccelMax ?? r.loadFactorMax ?? 10) * 9.80665;
      const length = norm(steering);
      if (length > max) steering = steering.map((x) => (x * max) / length) as V;
    }
    if (samples.length === 0 || Math.round(t / dt) % 5 === 0)
      samples.push({
        t,
        x: p[0],
        y: p[1],
        z: p[2],
        tx: target[0],
        ty: target[1],
        tz: target[2],
        speed: speed * 3.6,
        mach,
        thrust: mot.thrust,
        mass: mot.mass,
        g: norm(steering) / 9.80665,
        distance,
      });
    if (distance < 20) {
      reason = '接近目标（20 m 内）';
      break;
    }
    if (p[1] < 0) {
      reason = '触地';
      break;
    }
    if (travel > (r.maxDistance ?? Infinity)) {
      reason = '达到参数距离限制';
      break;
    }
    const cd =
      (mach < 0.8 ? 0.2 : mach < 1.2 ? 0.2 + (mach - 0.8) : 0.3 + 0.3 * Math.exp(-(mach - 1.2))) *
      (r.CxK ?? 1);
    const drag = (0.5 * air.density * speed * speed * cd * Math.PI * r.caliber * r.caliber) / 4;
    const acc = steering.map(
      (x, i) =>
        x +
        (((mot.thrust - drag) / Math.max(mot.mass, 1)) * v[i]) / speed -
        (i === 1 ? 9.80665 : 0),
    ) as V;
    const next = v.map((x, i) => x + acc[i] * dt) as V;
    p = p.map((x, i) => x + (v[i] + next[i]) * 0.5 * dt) as V;
    travel += speed * dt;
    v = next;
    if (!p.every(Number.isFinite) || !v.every(Number.isFinite)) {
      reason = '数值计算停止';
      break;
    }
  }
  return { missile, samples, reason, closest, peakSpeed: peakSpeed * 3.6, peakAltitude };
}
