import { describe, expect, it } from 'vitest';
import { drawAmbient, resolveBgAt } from '../src/engine/ambient/draw';
import type { AmbientBgDraw } from '../src/engine/ambient/draw';

/** 记录调用的 2D 上下文桩:calls = 调用名序列;sig = 带参数签名(用于「随 t 演化」断言) */
function makeCtx() {
  const calls: string[] = [];
  const sig: string[] = [];
  const gradient = { addColorStop: () => {} };
  const rec = (name: string, ...args: unknown[]) => {
    calls.push(name);
    sig.push(`${name}(${args.map((a) => Math.round(Number(a) * 100) / 100).join(',')})`);
  };
  const ctx = {
    canvas: { width: 1920, height: 1080 },
    calls,
    sig,
    clearRect: (...a: unknown[]) => rec('clear', ...a),
    save: () => rec('save'),
    restore: () => rec('restore'),
    beginPath: () => rec('begin'),
    moveTo: (x: number, y: number) => rec('moveTo', x, y),
    lineTo: (x: number, y: number) => rec('lineTo', x, y),
    stroke: () => rec('stroke'),
    fill: () => rec('fill'),
    arc: (x: number, y: number, r: number) => rec('arc', x, y, r),
    fillRect: (x: number, y: number, w: number, h: number) => rec('fillRect', x, y, w, h),
    fillText: (text: string, x: number, y: number) => rec('fillText', text === undefined ? '' : String(text).charCodeAt(0), x, y),
    drawImage: (img: unknown, x: number, y: number, w: number, h: number) => rec('drawImage', x, y, w, h),
    ellipse: (x: number, y: number, rx: number, ry: number) => rec('ellipse', x, y, rx, ry),
    createRadialGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

const COLORS = { accent: '#3fb950', accent2: '#58a6ff' };

describe('drawAmbient(t) 纯函数氛围层', () => {
  it('同 t 同 seed 调用序列一致(确定性)', () => {
    const a = makeCtx();
    const b = makeCtx();
    drawAmbient(a, 3.7, { particles: true, grid: true }, 42, COLORS);
    drawAmbient(b, 3.7, { particles: true, grid: true }, 42, COLORS);
    expect(a.calls).toEqual(b.calls);
  });

  it('无状态累积:同 t 下,先画过别的时刻的 ctx 与全新 ctx 调用序列一致', () => {
    const dirty = makeCtx();
    drawAmbient(dirty, 0, { particles: true, grid: true }, 42, COLORS);
    drawAmbient(dirty, 5, { particles: true, grid: true }, 42, COLORS);
    const fresh = makeCtx();
    drawAmbient(fresh, 5, { particles: true, grid: true }, 42, COLORS);
    const tail = dirty.calls.slice(dirty.calls.length - fresh.calls.length);
    expect(tail).toEqual(fresh.calls);
  });

  it('关闭 particles/grid 时不再绘制粒子与网格', () => {
    const on = makeCtx();
    const off = makeCtx();
    drawAmbient(on, 1, { particles: true, grid: true }, 1, COLORS);
    drawAmbient(off, 1, { particles: false, grid: false }, 1, COLORS);
    expect(on.calls.length).toBeGreaterThan(off.calls.length);
    // 关闭后仍保留极光与 clear
    expect(off.calls).toContain('clear');
    expect(off.calls).toContain('fillRect');
  });

  it('粒子随 t 演化:不同 t 的调用序列不同', () => {
    const a = makeCtx();
    const b = makeCtx();
    drawAmbient(a, 0, { particles: true, grid: false }, 7, COLORS);
    drawAmbient(b, 100, { particles: true, grid: false }, 7, COLORS);
    expect(JSON.stringify(a.calls)).not.toBe(JSON.stringify(b.calls));
  });

  it('竖屏 1080×1920 同 t 同 seed 仍确定性', () => {
    const size = { w: 1080, h: 1920 };
    const a = makeCtx();
    const b = makeCtx();
    drawAmbient(a, 2.5, { particles: true, grid: true }, 9, COLORS, size);
    drawAmbient(b, 2.5, { particles: true, grid: true }, 9, COLORS, size);
    expect(a.calls).toEqual(b.calls);
  });
});

describe('背景特效(fx)与背景图', () => {
  it.each(['matrix', 'waves', 'orbs', 'balls', 'pile', 'ink'] as const)('%s:同 t 同 seed 确定性,且随 t 演化', (fx) => {
    const a1 = makeCtx();
    const a2 = makeCtx();
    drawAmbient(a1, 2.3, { particles: false, grid: false, fx }, 5, COLORS);
    drawAmbient(a2, 2.3, { particles: false, grid: false, fx }, 5, COLORS);
    expect(a1.calls).toEqual(a2.calls);
    expect(a1.sig).toEqual(a2.sig);

    const b = makeCtx();
    drawAmbient(b, 9.9, { particles: false, grid: false, fx }, 5, COLORS);
    expect(a1.sig).not.toEqual(b.sig);
  });

  it.each(['matrix', 'waves', 'orbs', 'balls', 'pile', 'ink'] as const)('%s:无状态累积', (fx) => {
    const dirty = makeCtx();
    drawAmbient(dirty, 0, { particles: false, grid: false, fx }, 11, COLORS);
    drawAmbient(dirty, 4, { particles: false, grid: false, fx }, 11, COLORS);
    const fresh = makeCtx();
    drawAmbient(fresh, 4, { particles: false, grid: false, fx }, 11, COLORS);
    const tail = dirty.calls.slice(dirty.calls.length - fresh.calls.length);
    expect(tail).toEqual(fresh.calls);
  });

  it('matrix 逐字符绘制,强度不影响布局(仅 fillStyle 不同)', () => {
    const low = makeCtx();
    const high = makeCtx();
    drawAmbient(low, 1.2, { particles: false, grid: false, fx: 'matrix', fxIntensity: 0.25 }, 3, COLORS);
    drawAmbient(high, 1.2, { particles: false, grid: false, fx: 'matrix', fxIntensity: 1 }, 3, COLORS);
    expect(low.calls).toEqual(high.calls);
    expect(low.calls.filter((c) => c === 'fillText').length).toBeGreaterThan(50);
  });

  it('fxIntensity 同时调制极光:极光 fillRect 数量不变', () => {
    const a = makeCtx();
    const b = makeCtx();
    drawAmbient(a, 1, { particles: false, grid: false, fxIntensity: 0.2 }, 3, COLORS);
    drawAmbient(b, 1, { particles: false, grid: false, fxIntensity: 1 }, 3, COLORS);
    expect(a.calls.filter((c) => c === 'fillRect')).toEqual(b.calls.filter((c) => c === 'fillRect'));
  });

  it('背景图:画在 clear 之后、极光之前,且确定性', () => {
    const bg: AmbientBgDraw = {
      img: { naturalWidth: 800, naturalHeight: 600, width: 800, height: 600 } as unknown as CanvasImageSource,
      cfg: { asset: { assetId: 'asset_x', mime: 'image/png' }, opacity: 0.5, fit: 'cover', blur: 4, motion: true },
    };
    const a = makeCtx();
    const b = makeCtx();
    drawAmbient(a, 1.5, { particles: false, grid: false }, 1, COLORS, { w: 1920, h: 1080 }, bg);
    drawAmbient(b, 1.5, { particles: false, grid: false }, 1, COLORS, { w: 1920, h: 1080 }, bg);
    expect(a.calls).toEqual(b.calls);
    expect(a.calls[0]).toBe('clear');
    expect(a.calls[1]).toBe('save');
    expect(a.calls[2]).toBe('drawImage');
    // 漂移随 t 往复:不同 t 仍是确定性绘制(可能调用序列一致,但至少不抛错且可复现)
    const c = makeCtx();
    drawAmbient(c, 8, { particles: false, grid: false }, 1, COLORS, { w: 1920, h: 1080 }, bg);
    expect(c.calls.slice(0, 3)).toEqual(a.calls.slice(0, 3));
  });

  it('balls:出场门控与点阵密度(球全部在场时字符显著增多)', () => {
    const count = (c: ReturnType<typeof makeCtx>) => c.calls.filter((x) => x === 'fillText').length;
    const early = makeCtx();
    drawAmbient(early, 0.01, { particles: false, grid: false, fx: 'balls' }, 5, COLORS);
    const later = makeCtx();
    drawAmbient(later, 6, { particles: false, grid: false, fx: 'balls' }, 5, COLORS);
    expect(count(later)).toBeGreaterThan(300);
    expect(count(later)).toBeGreaterThan(count(early));
  });

  it('balls:自定义球面字符生效且确定性,空白回退内置汉字集', () => {
    const cfg = { particles: false, grid: false, fx: 'balls' as const };
    const a1 = makeCtx();
    const a2 = makeCtx();
    drawAmbient(a1, 2, { ...cfg, fxChars: '甲乙丙丁' }, 5, COLORS);
    drawAmbient(a2, 2, { ...cfg, fxChars: '甲乙丙丁' }, 5, COLORS);
    expect(a1.sig).toEqual(a2.sig);
    const def = makeCtx();
    drawAmbient(def, 2, cfg, 5, COLORS);
    expect(a1.sig).not.toEqual(def.sig);
    const blank = makeCtx();
    drawAmbient(blank, 2, { ...cfg, fxChars: '  ' }, 5, COLORS);
    expect(blank.sig).toEqual(def.sig);
  });

  it('ink:远山/红日/飞鸟的绘制量级与确定性,不绘制字符', () => {
    const cfg = { particles: false, grid: false, fx: 'ink' as const };
    const a = makeCtx();
    const b = makeCtx();
    drawAmbient(a, 3.2, cfg, 5, COLORS);
    drawAmbient(b, 3.2, cfg, 5, COLORS);
    expect(a.sig).toEqual(b.sig);
    // 三层山脊(每层 67 段)+ 雾带 33 段 + 飞鸟 20 段,墨晕未含亦 > 200
    expect(a.calls.filter((c) => c === 'lineTo').length).toBeGreaterThan(200);
    expect(a.calls).toContain('arc'); // 朱砂红日
    expect(a.calls).not.toContain('fillText');
  });

  it('pile:文字陆续掉落堆积,自定义字符集参与且空白回退', () => {
    const cfg = { particles: false, grid: false, fx: 'pile' as const };
    const count = (c: ReturnType<typeof makeCtx>) => c.calls.filter((x) => x === 'fillText').length;
    // 出场早期在空中的字少,后期堆里字多(flash/残影双绘制也会增多)
    const early = makeCtx();
    drawAmbient(early, 0.2, cfg, 5, COLORS);
    const later = makeCtx();
    drawAmbient(later, 9, cfg, 5, COLORS);
    expect(count(later)).toBeGreaterThan(count(early));
    expect(count(later)).toBeGreaterThan(50);
    // 字符集不同 → 绘制序列不同;空白 → 与缺省一致
    const custom = makeCtx();
    drawAmbient(custom, 9, { ...cfg, fxChars: '天地玄黄' }, 5, COLORS);
    const defA = makeCtx();
    drawAmbient(defA, 9, cfg, 5, COLORS);
    expect(custom.sig).not.toEqual(defA.sig);
    const blank = makeCtx();
    drawAmbient(blank, 9, { ...cfg, fxChars: ' ' }, 5, COLORS);
    expect(blank.sig).toEqual(defA.sig);
  });

  it('fx 缺省(旧项目文件)时兼容:等同 none,不绘制特效字符', () => {
    const legacy = makeCtx();
    drawAmbient(legacy, 1, { particles: false, grid: false }, 1, COLORS);
    const none = makeCtx();
    drawAmbient(none, 1, { particles: false, grid: false, fx: 'none' }, 1, COLORS);
    expect(legacy.calls).toEqual(none.calls);
    expect(legacy.calls).not.toContain('fillText');
  });
});

describe('resolveBgAt(场景级背景图覆盖)', () => {
  const docBg = { asset: { assetId: 'a0', mime: 'image/png' }, opacity: 0.5, fit: 'cover' as const, blur: 0, motion: true };
  const s1Bg = { asset: { assetId: 'a1', mime: 'image/png' }, opacity: 0.8, fit: 'contain' as const, blur: 2, motion: false };

  it('无场景覆盖时回退文档背景', () => {
    expect(resolveBgAt(0, docBg, [undefined, undefined], [0, 5])).toBe(docBg);
    expect(resolveBgAt(9.9, docBg, [undefined, undefined], [0, 5])).toBe(docBg);
  });

  it('场景覆盖只在该场景时间段生效,未覆盖场景回退全局', () => {
    const bgs = [undefined, s1Bg, undefined];
    const starts = [0, 5, 9];
    expect(resolveBgAt(0, docBg, bgs, starts)).toBe(docBg);
    expect(resolveBgAt(4.99, docBg, bgs, starts)).toBe(docBg);
    expect(resolveBgAt(5, docBg, bgs, starts)).toBe(s1Bg);
    expect(resolveBgAt(8.9, docBg, bgs, starts)).toBe(s1Bg);
    expect(resolveBgAt(9, docBg, bgs, starts)).toBe(docBg);
  });

  it('无全局背景时场景覆盖仍生效;空起点回退全局', () => {
    expect(resolveBgAt(6, undefined, [s1Bg], [0])).toBe(s1Bg);
    expect(resolveBgAt(6, docBg, [s1Bg], [])).toBe(docBg);
    expect(resolveBgAt(6, undefined, [undefined], [0])).toBeUndefined();
  });
});
