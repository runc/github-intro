/**
 * Canvas 氛围层(DESIGN.md 4.7 硬规则 3):draw(t) 纯函数——给定时刻直接算出画面。
 * 粒子位置 = initial(seed) + velocity(seed) * t(按舞台环绕取模),
 * 闪烁 = sin(t·ω + phase_i(seed)),无帧间状态累积。
 * 特效矩阵(代码雨/能量波/光斑)与背景图同样满足确定性:全部由 seed + t 推出,
 * 背景图漂移用正弦往复(任意 t 可复现,无累积相位)。
 * 画布尺寸由文档画幅决定(横 1920×1080 / 竖 1080×1920);构图按比例映射,保证确定性。
 * 层次:背景图 → 极光 → 背景特效 → 透视网格 → 粒子星空。
 */

import type { AmbientBgImage, AmbientFxType } from '../../types';
import { hashStr, makeRng } from '../random';

export interface AmbientDrawConfig {
  particles: boolean;
  grid: boolean;
  fx?: AmbientFxType;
  /** 0.2–1,同时调制特效与极光强度;缺省 0.7 */
  fxIntensity?: number;
  /** 字符弹球球面字符集;留空用内置汉字集 */
  fxChars?: string;
}

export interface AmbientColors {
  accent: string;
  accent2: string;
  /** 高亮前景色(代码雨字头/弹球受光面/堆积下落字);深底近白,浅底传深墨色,缺省近白 */
  head?: string;
  /** 纸底色(水墨特效的雾带用纸色「擦」出留白);缺省暖白宣纸色 */
  paper?: string;
}

export interface AmbientSize {
  w: number;
  h: number;
}

/** 背景图运行时资源:预览层与导出管线各自解码,绘制配置来自文档 */
export interface AmbientBgDraw {
  img: CanvasImageSource;
  cfg: AmbientBgImage;
}

/**
 * 时刻 t 生效的背景图配置:场景级覆盖 > 文档全局。
 * sceneBgs 与 sceneStarts 按下标对齐(组装器 label);命中最后一个 start<=t 的场景。
 * 预览层与导出管线共用,保证「场景里设置素材只对场景有效」在两路径一致。
 */
export function resolveBgAt(
  t: number,
  docBg: AmbientBgImage | undefined,
  sceneBgs: readonly (AmbientBgImage | undefined)[],
  sceneStarts: readonly number[],
): AmbientBgImage | undefined {
  let active = -1;
  for (let i = 0; i < sceneStarts.length && i < sceneBgs.length; i++) {
    if (sceneStarts[i] <= t) active = i;
    else break;
  }
  if (active >= 0 && sceneBgs[active]) return sceneBgs[active];
  return docBg;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  ph: number;
  c: boolean;
}

const DEFAULT_SIZE: AmbientSize = { w: 1920, h: 1080 };
const PARTICLE_COUNT = 110;
const LINK_DIST = 130;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const particleCache = new Map<string, Particle[]>();

function particlesFor(seed: number, w: number, h: number): Particle[] {
  const key = w === 1920 && h === 1080 ? String(seed) : `${seed}:${w}x${h}`;
  const cached = particleCache.get(key);
  if (cached) return cached;
  const rng = makeRng(hashStr(`ambient:${key}`) ^ 0x9e3779b9);
  const ps: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: rng.range(0, w),
    y: rng.range(0, h),
    r: rng.range(0.7, 2.4),
    vx: rng.range(-11, 11),
    vy: rng.range(-8, 8),
    ph: rng.range(0, Math.PI * 2),
    c: rng.float() < 0.55,
  }));
  if (particleCache.size > 64) particleCache.clear();
  particleCache.set(key, ps);
  return ps;
}

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return `rgba(95,150,80,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const wrap = (v: number, min: number, span: number) => ((((v - min) % span) + span) % span) + min;

/** 3 输入整数哈希(代码雨字符选择):同输入同输出,无随机源 */
function hash32(a: number, b: number, c: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ b, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ c, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

// ---------------- 背景图 ----------------

/** cover/contain 布局 + 不透明度 + 模糊 + Ken Burns 正弦漂移(确定性) */
export function drawBgImage(
  ctx: CanvasRenderingContext2D,
  t: number,
  img: CanvasImageSource,
  cfg: AmbientBgImage,
  w: number,
  h: number,
): void {
  const src = img as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = src.naturalWidth || src.width || 0;
  const ih = src.naturalHeight || src.height || 0;
  if (!iw || !ih) return;
  const base = cfg.fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  // 基础 2% 放大掩盖 blur 采样在边缘留下的透明缝
  const k = cfg.motion ? 1.02 + 0.05 * Math.sin((t * 2 * Math.PI) / 24) : 1.02;
  const dw = iw * base * k;
  const dh = ih * base * k;
  const slackX = Math.max(0, (dw - w) / 2);
  const slackY = Math.max(0, (dh - h) / 2);
  const px = w / 2 + (cfg.motion ? Math.sin((t * 2 * Math.PI) / 31) * Math.min(w * 0.02, slackX) : 0);
  const py = h / 2 + (cfg.motion ? Math.cos((t * 2 * Math.PI) / 37) * Math.min(h * 0.02, slackY) : 0);
  ctx.save();
  if (cfg.blur > 0) ctx.filter = `blur(${cfg.blur}px)`;
  ctx.globalAlpha = clamp01(cfg.opacity);
  ctx.drawImage(img, px - dw / 2, py - dh / 2, dw, dh);
  ctx.restore();
}

// ---------------- 极光(基础氛围,受强度调制) ----------------

function drawAurora(ctx: CanvasRenderingContext2D, t: number, colors: AmbientColors, w: number, h: number, boost: number): void {
  const blobs = [
    {
      cx: w * (1690 / 1920) + Math.sin((t * 2 * Math.PI) / 15) * (w * (100 / 1920)),
      cy: h * (190 / 1080) + Math.cos((t * 2 * Math.PI) / 15) * (h * (70 / 1080)),
      r: Math.min(w, h) * (580 / 1080),
      color: colors.accent2,
      alpha: 0.3,
    },
    {
      cx: w * (170 / 1920) + Math.sin((t * 2 * Math.PI) / 19 + 2) * (w * (110 / 1920)),
      cy: h * (950 / 1080) + Math.cos((t * 2 * Math.PI) / 19 + 2) * (h * (80 / 1080)),
      r: Math.min(w, h) * (520 / 1080),
      color: colors.accent,
      alpha: 0.28,
    },
    {
      cx: w * 0.5 + Math.sin((t * 2 * Math.PI) / 23 + 1) * (w * (90 / 1920)),
      cy: h * 0.5 + Math.cos((t * 2 * Math.PI) / 27) * (h * (90 / 1080)),
      r: Math.min(w, h) * (460 / 1080),
      color: colors.accent2,
      alpha: 0.16,
    },
  ];
  for (const b of blobs) {
    const a = b.alpha * boost;
    const g = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.r);
    g.addColorStop(0, hexA(b.color, a));
    g.addColorStop(0.65, hexA(b.color, a * 0.35));
    g.addColorStop(1, hexA(b.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.cx - b.r, b.cy - b.r, b.r * 2, b.r * 2);
  }
}

// ---------------- 透视网格 ----------------

function drawGrid(ctx: CanvasRenderingContext2D, t: number, colors: AmbientColors, w: number, h: number): void {
  const horizon = h * (792 / 1080);
  const cx = w / 2;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hexA(colors.accent, 0.1);
  for (let k = -12; k <= 12; k++) {
    ctx.beginPath();
    ctx.moveTo(cx + k * (w * (34 / 1920)), horizon);
    ctx.lineTo(cx + k * (w * (330 / 1920)), h);
    ctx.stroke();
  }
  const rows = 13;
  const off = (t * 0.5) % 1;
  for (let i = 0; i < rows; i++) {
    const p = (i + off) / rows;
    const y = horizon + (h - horizon) * p * p;
    ctx.strokeStyle = hexA(colors.accent, 0.04 + p * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- 粒子星空 ----------------

function drawParticles(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
): void {
  const ps = particlesFor(seed, w, h);
  const SPAN_X = w + 40;
  const SPAN_Y = h + 40;
  const xs = new Float64Array(ps.length);
  const ys = new Float64Array(ps.length);
  for (let i = 0; i < ps.length; i++) {
    xs[i] = wrap(ps[i].x + ps[i].vx * t + 20, -20, SPAN_X);
    ys[i] = wrap(ps[i].y + ps[i].vy * t + 20, -20, SPAN_Y);
  }
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const dx = xs[i] - xs[j];
      const dy = ys[i] - ys[j];
      const d2 = dx * dx + dy * dy;
      if (d2 < LINK_DIST * LINK_DIST) {
        const d = Math.sqrt(d2);
        ctx.strokeStyle = hexA(colors.accent2, (1 - d / LINK_DIST) * 0.13);
        ctx.beginPath();
        ctx.moveTo(xs[i], ys[i]);
        ctx.lineTo(xs[j], ys[j]);
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const al = Math.max(0.06, 0.3 + 0.35 * Math.sin(t * 1.6 + p.ph));
    ctx.fillStyle = hexA(p.c ? colors.accent : colors.accent2, al);
    ctx.beginPath();
    ctx.arc(xs[i], ys[i], p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------- 特效:代码雨 ----------------

const MATRIX_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾈﾊﾋﾎﾏﾐﾑﾔﾕﾗﾘﾜ0123456789ABCDEF<>/{}[]=+*#$@%';

interface MatrixColumn {
  x: number;
  /** 下落速度 px/s */
  speed: number;
  /** 初始相位偏移 px */
  offset: number;
  /** 尾迹字符数 */
  trail: number;
  /** 少量空缺列,留出呼吸感 */
  skip: boolean;
  /** 少数列换第二强调色 */
  alt: boolean;
}

const matrixCache = new Map<string, { fs: number; cols: MatrixColumn[] }>();

function matrixFor(seed: number, w: number, h: number): { fs: number; cols: MatrixColumn[] } {
  const key = `${seed}:${w}x${h}`;
  const cached = matrixCache.get(key);
  if (cached) return cached;
  const fs = Math.max(16, Math.min(26, Math.round(Math.min(w, h) / 54)));
  const colW = Math.round(fs * 1.06);
  const n = Math.ceil(w / colW);
  const rng = makeRng(hashStr(`matrix:${key}`) ^ 0x9e3779b9);
  const cols: MatrixColumn[] = Array.from({ length: n }, (_, i) => ({
    x: i * colW,
    speed: rng.range(220, 560),
    offset: rng.range(0, h + 40 * fs),
    trail: Math.round(rng.range(16, 26)),
    skip: rng.float() < 0.08,
    alt: rng.float() < 0.18,
  }));
  if (matrixCache.size > 64) matrixCache.clear();
  matrixCache.set(key, { fs, cols });
  return { fs, cols };
}

function drawMatrix(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
  intensity: number,
): void {
  const { fs, cols } = matrixFor(seed, w, h);
  ctx.save();
  ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  for (let c = 0; c < cols.length; c++) {
    const col = cols[c];
    if (col.skip) continue;
    const span = h + 2 * col.trail * fs;
    const headY = wrap(col.offset + col.speed * t, -col.trail * fs, span);
    const color = col.alt ? colors.accent2 : colors.accent;
    for (let i = 0; i <= col.trail; i++) {
      const y = headY - i * fs;
      if (y < -fs || y > h + fs) continue;
      const row = Math.floor(y / fs);
      // 字符由 (列, 行, 闪烁节拍) 哈希决定:同 t 同 seed 必然一致,又随时间重洗
      const tick = Math.floor(t * 3 + (hash32(c, row, 7) % 100) / 25);
      const glyph = MATRIX_GLYPHS[hash32(c, row, tick) % MATRIX_GLYPHS.length];
      if (i === 0) {
        ctx.fillStyle = hexA(colors.head ?? '#ebf5ee', intensity);
      } else {
        const fade = Math.pow(1 - i / col.trail, 1.15);
        ctx.fillStyle = hexA(color, fade * 0.9 * intensity);
      }
      ctx.fillText(glyph, col.x + fs * 0.575, y);
    }
  }
  ctx.restore();
}

// ---------------- 特效:能量波 ----------------

interface WaveSpec {
  baseY: number;
  amp: number;
  /** 波长(px) */
  len: number;
  phase: number;
  /** 相位速度 rad/s */
  speed: number;
  alt: boolean;
}

const waveCache = new Map<string, WaveSpec[]>();

function wavesFor(seed: number, w: number, h: number): WaveSpec[] {
  const key = `${seed}:${w}x${h}`;
  const cached = waveCache.get(key);
  if (cached) return cached;
  const rng = makeRng(hashStr(`waves:${key}`) ^ 0x9e3779b9);
  const specs: WaveSpec[] = Array.from({ length: 5 }, () => ({
    baseY: rng.range(0.22, 0.82) * h,
    amp: rng.range(0.03, 0.1) * h,
    len: rng.range(0.45, 1.4) * w,
    phase: rng.range(0, Math.PI * 2),
    speed: rng.range(0.25, 0.7) * (rng.float() < 0.5 ? -1 : 1),
    alt: rng.float() < 0.4,
  }));
  if (waveCache.size > 64) waveCache.clear();
  waveCache.set(key, specs);
  return specs;
}

function drawWaves(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
  intensity: number,
): void {
  const specs = wavesFor(seed, w, h);
  const steps = 48;
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of specs) {
    const color = s.alt ? colors.accent2 : colors.accent;
    const breathe = 0.85 + 0.15 * Math.sin(t * 0.5 + s.phase);
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * (w + 80) - 40;
        const y = s.baseY + Math.sin((x / s.len) * Math.PI * 2 + s.phase + t * s.speed) * s.amp * breathe;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };
    // 双描边营造辉光:宽半透明 + 细高亮
    path();
    ctx.lineWidth = 10;
    ctx.strokeStyle = hexA(color, 0.085 * intensity);
    ctx.stroke();
    path();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = hexA(color, 0.4 * intensity);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- 特效:漂浮光斑 ----------------

interface Orb {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  alt: boolean;
}

const orbCache = new Map<string, Orb[]>();

function orbsFor(seed: number, w: number, h: number): Orb[] {
  const key = `${seed}:${w}x${h}`;
  const cached = orbCache.get(key);
  if (cached) return cached;
  const rng = makeRng(hashStr(`orbs:${key}`) ^ 0x9e3779b9);
  const m = Math.min(w, h);
  const orbs: Orb[] = Array.from({ length: 14 }, () => {
    const r = rng.range(0.05, 0.22) * m;
    return {
      x: rng.range(-r, w + r),
      y: rng.range(-r, h + r),
      r,
      // 大球慢漂(远处)、小球快移(近处),营造景深
      vx: rng.range(-14, 14) * (1 - r / (0.25 * m)),
      vy: rng.range(-22, -6) * (1 - r / (0.25 * m)),
      alpha: rng.range(0.07, 0.18),
      alt: rng.float() < 0.45,
    };
  });
  if (orbCache.size > 64) orbCache.clear();
  orbCache.set(key, orbs);
  return orbs;
}

function drawOrbs(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
  intensity: number,
): void {
  const orbs = orbsFor(seed, w, h);
  for (const o of orbs) {
    const spanX = w + 2 * o.r;
    const spanY = h + 2 * o.r;
    const x = wrap(o.x + o.vx * t, -o.r, spanX);
    const y = wrap(o.y + o.vy * t, -o.r, spanY);
    const color = o.alt ? colors.accent2 : colors.accent;
    const a = o.alpha * intensity;
    const g = ctx.createRadialGradient(x, y, 0, x, y, o.r);
    g.addColorStop(0, hexA(color, a));
    g.addColorStop(0.7, hexA(color, a * 0.4));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - o.r, y - o.r, o.r * 2, o.r * 2);
  }
}

// ---------------- 特效:字符弹球 ----------------

/** 弹球球面内置汉字集(fxChars 缺省/留空时使用) */
export const BALL_GLYPHS = '代码开源创造分享极客终端编译世界引擎未来比特字节';

/** 解析用户自定义字符集:去空白逐字符取用,空则回内置汉字集 */
export function ballGlyphsOf(fxChars: string | undefined): string[] {
  const chars = Array.from((fxChars ?? '').trim()).filter((c) => !/\s/.test(c));
  return chars.length > 0 ? chars : Array.from(BALL_GLYPHS);
}

/**
 * 弹跳物理不用帧间积分,而是「弹跳段表 + 抛体解析解」:
 * 每球由 seed 预生成段表 [{tStart, yStart, vStart}],段内 y(τ) = yStart + vStart·τ + ½g·τ²,
 * 给定 t 查段代入即得位置——同 t 必然同画面(硬规则 3),弹完静置、按周期整体重落。
 * 水平为匀速 + 边界反射(折叠三角波),全程确定性。
 */

interface PhysSeg {
  tStart: number;
  yStart: number;
  /** 段初竖直速度(px/s,canvas y 向下,负 = 向上) */
  vStart: number;
}

/** 段表查询:段内抛体解析式 y = yStart + vStart·τ + ½g·τ²(段表末段应为静止段) */
function segYAt(segs: PhysSeg[], tc: number, g: number): { y: number; vy: number } | null {
  if (tc < 0 || segs.length === 0) return null;
  let seg = segs[0];
  for (const s of segs) if (tc >= s.tStart) seg = s;
  const tau = tc - seg.tStart;
  return { y: seg.yStart + seg.vStart * tau + 0.5 * g * tau * tau, vy: seg.vStart + g * tau };
}

interface BallSpec {
  r: number;
  x0: number;
  vx: number;
  /** 出场延迟 s(t 之前球不在场) */
  t0: number;
  /** 段表结束时刻(s),之后静置在地面 */
  tEnd: number;
  /** 静置多久后整体重落 */
  cycle: number;
  /** 该球停驻线(球心 y) */
  floorY: number;
  segs: PhysSeg[];
  alt: boolean;
}

interface BallField {
  g: number;
  groundY: number;
  balls: BallSpec[];
}

const ballCache = new Map<string, BallField>();

function ballsFor(seed: number, w: number, h: number): BallField {
  const key = `${seed}:${w}x${h}`;
  const cached = ballCache.get(key);
  if (cached) return cached;
  const rng = makeRng(hashStr(`balls:${key}`) ^ 0x9e3779b9);
  const m = Math.min(w, h);
  const groundY = h - m * 0.06;
  const g = h * 2.4;
  const balls: BallSpec[] = [];
  for (let i = 0; i < 6; i++) {
    const r = m * rng.range(0.045, 0.115);
    const floorY = groundY - r;
    const e = rng.range(0.55, 0.72);
    const y0 = -r - rng.range(0, m * 0.35);
    // 段 0:自由落体;之后每段一次弹跳,速度按恢复系数 e 几何衰减
    const segs: PhysSeg[] = [{ tStart: 0, yStart: y0, vStart: 0 }];
    let vLand = Math.sqrt(2 * g * (floorY - y0));
    let t = vLand / g;
    while (vLand * e > m * 0.35 && segs.length < 15) {
      vLand *= e;
      segs.push({ tStart: t, yStart: floorY, vStart: -vLand });
      t += (2 * vLand) / g;
    }
    balls.push({
      r,
      x0: rng.range(r, w - r),
      vx: rng.range(28, 85) * (rng.float() < 0.5 ? -1 : 1),
      t0: rng.range(0, 2.2),
      tEnd: t,
      cycle: t + rng.range(2.5, 5),
      floorY,
      segs,
      alt: rng.float() < 0.4,
    });
  }
  if (ballCache.size > 64) ballCache.clear();
  ballCache.set(key, { g, groundY, balls });
  return { g, groundY, balls };
}

/** 折叠反射:匀速运动在 [min,max] 间来回反弹(确定性三角波) */
function reflect(v: number, min: number, max: number): number {
  const span = max - min;
  const m = (((v - min) % (2 * span)) + 2 * span) % (2 * span);
  return m <= span ? min + m : max - (m - span);
}

function drawBalls(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
  intensity: number,
  glyphs: string[],
): void {
  const { g, groundY, balls } = ballsFor(seed, w, h);
  ctx.save();
  // 淡地平线:让「落地」可读
  ctx.strokeStyle = hexA(colors.accent, 0.14 * intensity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.04, groundY);
  ctx.lineTo(w * 0.96, groundY);
  ctx.stroke();

  for (let bi = 0; bi < balls.length; bi++) {
    const b = balls[bi];
    const tl = t - b.t0;
    if (tl < 0) continue;
    const tc = tl % b.cycle;
    let y = b.floorY;
    let vy = 0;
    if (tc < b.tEnd) {
      let seg = b.segs[0];
      for (const s of b.segs) if (tc >= s.tStart) seg = s;
      const tau = tc - seg.tStart;
      y = seg.yStart + seg.vStart * tau + 0.5 * g * tau * tau;
      vy = seg.vStart + g * tau;
    }
    const cx = reflect(b.x0 + b.vx * tl, b.r, w - b.r);
    const d = b.floorY - y;

    // 地面阴影:越高越淡越大
    const sh = Math.max(0, 1 - d / (h * 0.75));
    ctx.fillStyle = `rgba(0,0,0,${(0.32 * sh * intensity).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(cx, groundY, b.r * (1.35 - 0.5 * sh), b.r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // 发光底
    const color = b.alt ? colors.accent2 : colors.accent;
    const glow = ctx.createRadialGradient(cx, y, 0, cx, y, b.r * 1.35);
    glow.addColorStop(0, hexA(color, 0.14 * intensity));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(cx - b.r * 1.35, y - b.r * 1.35, b.r * 2.7, b.r * 2.7);

    // squash & stretch:贴地压扁 / 高速拉伸(直接变换点阵坐标,不用 ctx transform)
    let sx = 1;
    let sy = 1;
    if (d < b.r * 0.25) {
      const q = 1 - d / (b.r * 0.25);
      sx = 1 + 0.24 * q;
      sy = 1 - 0.3 * q;
    } else if (Math.abs(vy) > h * 0.5) {
      const st = Math.min(1, Math.abs(vy) / (h * 1.4));
      sy = 1 + 0.08 * st;
      sx = 1 - 0.05 * st;
    }

    // 字符点阵球面:正交投影网格 + 左上前光照 + 经度随时间流动(旋转感)
    // 汉字笔画密于假名,字号略放大保证可读
    const ch = Math.max(10, b.r / 5.5);
    ctx.font = `${ch}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tick = Math.floor(t * 3);
    const Lx = -0.42;
    const Ly = -0.5;
    const Lz = 0.77;
    const chW = ch * 1.05;
    let row = 0;
    for (let gy = -b.r; gy <= b.r; gy += chW, row++) {
      const rowHalf = Math.sqrt(Math.max(0, b.r * b.r - gy * gy));
      for (let gx = -rowHalf; gx <= rowHalf; gx += chW) {
        const z = Math.sqrt(Math.max(0, b.r * b.r - gx * gx - gy * gy));
        const theta = Math.atan2(gx, z);
        const light = Math.max(0, (gx * Lx + gy * Ly + z * Lz) / b.r);
        const slot = Math.floor((theta / (Math.PI * 2)) * 36 + t * 1.5);
        const glyph = glyphs[hash32(hash32(bi, slot, row), tick, 0x51ed) % glyphs.length];
        const a = (0.15 + 0.85 * light) * intensity;
        ctx.fillStyle = light > 0.72 ? hexA(colors.head ?? '#ebf5ee', a) : hexA(color, a);
        ctx.fillText(glyph, cx + gx * sx, y + gy * sy);
      }
    }
  }
  ctx.restore();
}

// ---------------- 特效:文字堆积 ----------------

/**
 * 一群单字逐个从上方掉落:自由落体 → 落地小弹跳(恢复系数 0.32)→ 嵌入按列堆叠的「字山」。
 * 堆积位置由 seed 预计算(按字序模拟每列高度,中心加权),段表解析解保证确定性;
 * 落定后 22% 的字会再冒一次小泡,堆满后整体周期重落。
 */

interface PileGlyph {
  ch: string;
  x: number;
  /** 出场时刻(绝对) */
  t0: number;
  restY: number;
  /** 首次落定时刻(相对 t0,含首弹跳) */
  restT: number;
  alt: boolean;
  ph: number;
  segs: PhysSeg[];
}

interface PileField {
  g: number;
  groundY: number;
  ch: number;
  glyphs: PileGlyph[];
  cycle: number;
}

const pileCache = new Map<string, PileField>();

function pileFor(seed: number, w: number, h: number, chars: string[]): PileField {
  const key = `${seed}:${w}x${h}:${chars.length}:${hashStr(chars.join(''))}`;
  const cached = pileCache.get(key);
  if (cached) return cached;
  const rng = makeRng(hashStr(`pile:${key}`) ^ 0x9e3779b9);
  const m = Math.min(w, h);
  const ch = Math.max(18, Math.min(34, Math.round(m / 46)));
  const groundY = h - m * 0.05;
  const g = h * 2.6;
  const x0 = w * 0.2;
  const x1 = w * 0.8;
  const nc = Math.max(8, Math.floor((x1 - x0) / (ch * 1.02)));
  const colW = (x1 - x0) / nc;
  const colH = new Array<number>(nc).fill(0);
  const glyphs: PileGlyph[] = [];
  let tCursor = 0;
  for (let i = 0; i < 110; i++) {
    // 三均值近似高斯:中心列堆得高、两侧渐低,堆成小山
    const gauss = (rng.float() + rng.float() + rng.float()) / 3 - 0.5;
    let col = Math.round(nc / 2 + gauss * 2 * (nc / 2) * 0.92);
    col = Math.max(0, Math.min(nc - 1, col));
    const cx = x0 + (col + 0.5) * colW + rng.range(-0.22, 0.22) * ch;
    const y0 = -ch;
    const restY = groundY - ch * 0.55 - colH[col] * ch * 0.92;
    colH[col]++;
    const drop = restY - y0;
    const fall = Math.sqrt((2 * drop) / g);
    const vB = g * fall * 0.32;
    const bounce = (2 * vB) / g;
    const restT = fall + bounce;
    const segs: PhysSeg[] = [
      { tStart: 0, yStart: y0, vStart: 0 },
      { tStart: fall, yStart: restY, vStart: -vB },
      { tStart: restT, yStart: restY, vStart: 0 },
    ];
    const t0 = tCursor;
    tCursor += rng.range(0.06, 0.13);
    // 落定后再冒一次小泡:让堆保持「活着」
    if (rng.float() < 0.22) {
      const delay = restT + rng.range(0.8, 2.4);
      const hop = ch * rng.range(0.4, 0.8);
      const v = Math.sqrt(2 * g * hop);
      segs.push(
        { tStart: delay, yStart: restY, vStart: -v },
        { tStart: delay + (2 * v) / g, yStart: restY, vStart: 0 },
      );
    }
    glyphs.push({ ch: rng.pick(chars), x: cx, t0, restY, restT, alt: rng.float() < 0.4, ph: rng.range(0, Math.PI * 2), segs });
  }
  const field: PileField = { g, groundY, ch, glyphs, cycle: tCursor + 5.5 };
  if (pileCache.size > 64) pileCache.clear();
  pileCache.set(key, field);
  return field;
}

function drawPile(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
  intensity: number,
  chars: string[],
): void {
  const { g, groundY, glyphs, cycle, ch } = pileFor(seed, w, h, chars);
  ctx.save();
  // 淡地平线
  ctx.strokeStyle = hexA(colors.accent, 0.14 * intensity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, groundY);
  ctx.lineTo(w * 0.92, groundY);
  ctx.stroke();

  ctx.font = `${ch}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const gl of glyphs) {
    const tl = t - gl.t0;
    if (tl < 0) continue;
    const tc = tl % cycle;
    const p = segYAt(gl.segs, tc, g);
    if (!p) continue;
    const color = gl.alt ? colors.accent2 : colors.accent;
    const flying = p.y < gl.restY - 0.5 || Math.abs(p.vy) > 1;
    if (flying) {
      // 运动残影 + 亮字
      ctx.fillStyle = hexA(color, 0.18 * intensity);
      ctx.fillText(gl.ch, gl.x, p.y - p.vy * 0.05);
      ctx.fillStyle = hexA(colors.head ?? '#ebf5ee', 0.92 * intensity);
      ctx.fillText(gl.ch, gl.x, p.y);
    } else {
      // 落地闪光 + 堆顶更亮 + 轻微闪烁
      const flash = Math.max(0, 1 - (tc - gl.restT) / 0.12);
      const twinkle = 0.62 + 0.16 * Math.sin(t * 1.3 + gl.ph);
      const heightLight = 0.4 + 0.4 * (1 - gl.restY / groundY);
      const a = Math.min(1, (twinkle * (0.6 + 0.4 * heightLight) + flash * 0.4) * intensity);
      ctx.fillStyle = flash > 0.5 ? hexA(colors.head ?? '#ebf5ee', a) : hexA(color, a);
      ctx.fillText(gl.ch, gl.x, gl.restY);
    }
  }
  ctx.restore();
}

// ---------------- 特效:水墨山水 ----------------

/**
 * 四层确定性绘制(全由 seed + t 推出,无帧间状态):
 *   红日(朱砂柔边盘,画在山后)→ 三层远山(高斯峰包络 + 缓慢视差漂移 + 纸色雾带)
 *   → 墨晕(滴墨周期性晕开:瓣状不规则边缘 + 积墨深边 + 水洗淡出)→ 人字飞鸟(翅膀扇动横渡)。
 * 墨晕周期相位错开,场景开场(t=0,shot 页冻结帧)即有一部分墨已在场。
 */

interface InkBlob {
  /** 中心(画幅比例)+ 椭圆压扁 */
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** 基准半径(min(w,h) 比例) */
  r: number;
  /** 周期起点(秒);开场即有部分墨晕在场 */
  t0: number;
  /** 晕开时长(秒) */
  spread: number;
  /** 全周期 = 晕开 + 驻留 + 水洗 */
  cycle: number;
  /** 墨在纸上缓慢走笔(px/s,按画幅比例) */
  driftX: number;
  driftY: number;
  /** 边缘不规则谐波相位 */
  ph1: number;
  ph2: number;
  ph3: number;
  /** 墨色深浅(个体差异) */
  depth: number;
}

interface InkMountain {
  /** 山脚基准线(h 比例) */
  baseY: number;
  /** 填充透明度 */
  alpha: number;
  peaks: { cx: number; amp: number; sig: number }[];
  /** 缓慢漂移参数 */
  driftAmp: number;
  driftSpeed: number;
  ph: number;
}

interface InkBird {
  /** 基准高度(h 比例) */
  y: number;
  x0: number;
  /** 水平速度(px/s,按画幅比例) */
  v: number;
  ph: number;
  /** 扇翅角速度(rad/s) */
  flap: number;
  scale: number;
}

interface InkSpec {
  blobs: InkBlob[];
  mountains: InkMountain[];
  sun: { x: number; y: number; r: number; ph: number };
  birds: InkBird[];
}

const inkCache = new Map<string, InkSpec>();

function inkFor(seed: number, w: number, h: number): InkSpec {
  const key = `${seed}:${w}x${h}`;
  const cached = inkCache.get(key);
  if (cached) return cached;
  const rng = makeRng(hashStr(`ink:${key}`) ^ 0x9e3779b9);

  const blobs: InkBlob[] = Array.from({ length: 5 }, () => {
    const cycle = rng.range(16, 24);
    const spread = rng.range(4, 6);
    return {
      x: rng.range(0.12, 0.88),
      y: rng.range(0.14, 0.86),
      sx: rng.range(0.8, 1.25),
      sy: rng.range(0.8, 1.25),
      r: rng.range(0.055, 0.15),
      t0: rng.range(0, cycle),
      spread,
      cycle,
      driftX: rng.range(-8, 8),
      driftY: rng.range(-5, 5),
      ph1: rng.range(0, Math.PI * 2),
      ph2: rng.range(0, Math.PI * 2),
      ph3: rng.range(0, Math.PI * 2),
      depth: rng.float(),
    };
  });

  // 远淡近浓三层山;峰值位置铺到画幅外少许,漂移时不露边
  const makeLayer = (baseY: number, alpha: number, n: number, ampLo: number, ampHi: number): InkMountain => ({
    baseY,
    alpha,
    peaks: Array.from({ length: n }, () => ({
      cx: rng.range(-0.15, 1.15),
      amp: rng.range(ampLo, ampHi),
      sig: rng.range(0.14, 0.3),
    })),
    driftAmp: rng.range(0.012, 0.025),
    driftSpeed: rng.range(0.04, 0.08),
    ph: rng.range(0, Math.PI * 2),
  });
  const mountains: InkMountain[] = [
    makeLayer(0.62, 0.11, 4, 0.05, 0.1),
    makeLayer(0.74, 0.17, 5, 0.06, 0.13),
    makeLayer(0.86, 0.25, 4, 0.08, 0.16),
  ];

  const birds: InkBird[] = Array.from({ length: 5 }, () => ({
    y: rng.range(0.16, 0.45),
    x0: rng.range(0, 1),
    v: rng.range(0.02, 0.05) * w * (rng.float() < 0.5 ? -1 : 1),
    ph: rng.range(0, Math.PI * 2),
    flap: rng.range(1.3, 2.3),
    scale: rng.range(0.7, 1.25),
  }));

  const spec: InkSpec = {
    blobs,
    mountains,
    sun: { x: rng.range(0.14, 0.86), y: rng.range(0.1, 0.26), r: rng.range(0.05, 0.085), ph: rng.range(0, Math.PI * 2) },
    birds,
  };
  if (inkCache.size > 64) inkCache.clear();
  inkCache.set(key, spec);
  return spec;
}

/** 平滑缓动(晕开先慢后快再收) */
const easeInOut = (p: number) => {
  const q = Math.max(0, Math.min(1, p));
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
};

/** 墨晕:瓣状路径 + 中心淡边缘深的径向渐变 + 双描边积墨边 */
function drawInkBlob(
  ctx: CanvasRenderingContext2D,
  b: InkBlob,
  cx: number,
  cy: number,
  R: number,
  alpha: number,
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // 三次谐波调制瓣状边缘(归一化系数避免叠加失真)
    const mod = 0.72 + 0.28 * (0.6 * Math.sin(2 * a + b.ph1) + 0.4 * Math.sin(5 * a + b.ph2) + 0.3 * Math.sin(9 * a + b.ph3));
    const px = cx + Math.cos(a) * R * mod * b.sx;
    const py = cy + Math.sin(a) * R * mod * b.sy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  // fill 自动闭合子路径;中心淡、边缘深(水墨积墨感)
  const g = ctx.createRadialGradient(cx, cy, R * 0.04, cx, cy, R);
  g.addColorStop(0, hexA(color, alpha * 0.5));
  g.addColorStop(0.6, hexA(color, alpha * 0.68));
  g.addColorStop(0.88, hexA(color, alpha * 0.92));
  g.addColorStop(1, hexA(color, alpha));
  ctx.fillStyle = g;
  ctx.fill();
  // 双描边积墨边:宽淡 + 细深
  ctx.strokeStyle = hexA(color, alpha * 0.3);
  ctx.lineWidth = Math.max(2, R * 0.22);
  ctx.stroke();
  ctx.strokeStyle = hexA(color, alpha * 0.5);
  ctx.lineWidth = Math.max(1, R * 0.06);
  ctx.stroke();
  ctx.restore();
}

function drawInk(
  ctx: CanvasRenderingContext2D,
  t: number,
  seed: number,
  colors: AmbientColors,
  w: number,
  h: number,
  intensity: number,
): void {
  const spec = inkFor(seed, w, h);
  const paper = colors.paper ?? '#e8e2d0';
  const m = Math.min(w, h);

  // ---- 红日(山后) ----
  {
    const s = spec.sun;
    const r = s.r * m * (1 + 0.05 * Math.sin(t * 0.5 + s.ph));
    const x = s.x * w;
    const y = s.y * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(colors.accent2, 0.4 * intensity));
    g.addColorStop(0.75, hexA(colors.accent2, 0.2 * intensity));
    g.addColorStop(1, hexA(colors.accent2, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 三层远山 + 层间纸色雾带 ----
  const mistBands: { y: number; half: number }[] = [];
  spec.mountains.forEach((layer, li) => {
    const off = Math.sin(t * layer.driftSpeed + layer.ph) * layer.driftAmp * w;
    const base = layer.baseY * h;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, h + 20);
    ctx.lineTo(-20, base);
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const x = -20 + ((w + 40) * i) / steps;
      let y = base;
      for (const p of layer.peaks) {
        const dx = (x - (p.cx * w + off)) / (p.sig * w);
        y -= p.amp * h * Math.exp(-dx * dx);
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 20, h + 20);
    ctx.fillStyle = hexA(colors.accent, layer.alpha * intensity);
    ctx.fill();
    ctx.restore();
    // 下一层山脚处的雾带
    const next = spec.mountains[li + 1];
    if (next) {
      mistBands.push({ y: ((layer.baseY + next.baseY) / 2) * h, half: 0.028 * h });
    }
  });
  mistBands.push({ y: 0.955 * h, half: 0.02 * h });
  for (const band of mistBands) {
    const lines = 10;
    for (let i = 0; i <= lines; i++) {
      const p = i / lines;
      const y = band.y - band.half + 2 * band.half * p;
      const a = Math.sin(Math.PI * p) * (0.22 + 0.08 * Math.sin(t * 0.35 + p * 3.1));
      ctx.strokeStyle = hexA(paper, a * intensity);
      ctx.lineWidth = band.half * 2.4;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(w + 20, y);
      ctx.stroke();
    }
  }

  // ---- 墨晕 ----
  for (const b of spec.blobs) {
    const tc = ((t - b.t0) % b.cycle + b.cycle) % b.cycle;
    const S = b.spread;
    const fadeStart = S + 2;
    if (tc > fadeStart + 4) continue;
    let alpha: number;
    let R: number;
    if (tc < S) {
      const p = easeInOut(tc / S);
      R = b.r * m * (0.05 + 0.95 * p);
      alpha = Math.min(1, tc / (S * 0.14));
    } else if (tc < fadeStart) {
      R = b.r * m;
      alpha = 1;
    } else {
      // 水洗:墨被冲散,边缘再外扩一点,整体淡出
      const q = (tc - fadeStart) / 4;
      R = b.r * m * (1 + 0.1 * q);
      alpha = 1 - easeInOut(q);
    }
    if (alpha <= 0.01) continue;
    // 墨随水缓慢走笔(driftX/Y 为 px/s)
    const cx = b.x * w + b.driftX * t;
    const cy = b.y * h + b.driftY * t;
    const depth = (0.5 + 0.5 * b.depth) * (0.34 + 0.1 * Math.sin(t * 0.4 + b.ph1));
    drawInkBlob(ctx, b, cx, cy, R, alpha * depth * intensity, colors.accent);
  }

  // ---- 人字飞鸟 ----
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const b of spec.birds) {
    const x = wrap(b.x0 * w + b.v * t, -80, w + 80);
    const y = b.y * h + Math.sin(t * 0.8 + b.ph) * 10;
    const wing = Math.sin(t * b.flap + b.ph);
    const W = 30 * b.scale;
    const H = 16 * b.scale;
    ctx.strokeStyle = hexA(colors.accent, 0.34 * intensity);
    ctx.lineWidth = Math.max(2, 3.5 * b.scale);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - W * 0.45, y - 4 * b.scale - wing * H * 0.25);
    ctx.lineTo(x - W, y - wing * H);
    ctx.moveTo(x, y);
    ctx.lineTo(x + W * 0.45, y - 4 * b.scale - wing * H * 0.25);
    ctx.lineTo(x + W, y - wing * H);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAmbient(
  ctx: CanvasRenderingContext2D,
  t: number,
  config: AmbientDrawConfig,
  seed: number,
  colors: AmbientColors,
  size: AmbientSize = DEFAULT_SIZE,
  bg?: AmbientBgDraw,
): void {
  const { w, h } = size;
  const intensity = clamp01(config.fxIntensity ?? 0.7);
  const fx = config.fx ?? 'none';
  ctx.clearRect(0, 0, w, h);
  if (bg) drawBgImage(ctx, t, bg.img, bg.cfg, w, h);
  // 强度同时调制极光(默认 0.7 → 与旧版 0.3 持平略强,拉满 1 → 明显更亮);
  // 水墨特效下极光降为极淡的纸面晕染,避免科技感光斑破坏留白
  drawAurora(ctx, t, colors, w, h, fx === 'ink' ? 0.22 : 0.55 + intensity * 0.75);
  if (fx === 'matrix') drawMatrix(ctx, t, seed, colors, w, h, intensity);
  if (fx === 'waves') drawWaves(ctx, t, seed, colors, w, h, intensity);
  if (fx === 'orbs') drawOrbs(ctx, t, seed, colors, w, h, intensity);
  if (fx === 'balls') drawBalls(ctx, t, seed, colors, w, h, intensity, ballGlyphsOf(config.fxChars));
  if (fx === 'pile') drawPile(ctx, t, seed, colors, w, h, intensity, ballGlyphsOf(config.fxChars));
  if (fx === 'ink') drawInk(ctx, t, seed, colors, w, h, intensity);
  if (config.grid) drawGrid(ctx, t, colors, w, h);
  if (config.particles) drawParticles(ctx, t, seed, colors, w, h);
}
