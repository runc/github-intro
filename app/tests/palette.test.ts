import { describe, expect, it } from 'vitest';
import { isLightPalette, THEME_PRESETS } from '../src/types';
import { BUILTIN_FONTS } from '../src/io/fonts';

describe('主题预设与浅色判定', () => {
  it('light 预设判为浅色底,dark 预设判为深色底', () => {
    const lightIds = ['github-light', 'mist-blue', 'paper', 'sakura', 'ink-wash'];
    for (const p of THEME_PRESETS) {
      expect(isLightPalette(p.palette)).toBe(lightIds.includes(p.id));
    }
  });

  it('预设 id 唯一', () => {
    expect(new Set(THEME_PRESETS.map((p) => p.id)).size).toBe(THEME_PRESETS.length);
  });

  it('水墨山水预设携带呼应字体与氛围,字体 id 均已内置', () => {
    const ink = THEME_PRESETS.find((p) => p.id === 'ink-wash');
    expect(ink?.fonts).toBeDefined();
    for (const f of Object.values(ink!.fonts!)) {
      expect(BUILTIN_FONTS.some((b) => b.id === f)).toBe(true);
    }
    // 氛围联动:水墨特效,关掉科幻向的网格/扫描线/粒子
    expect(ink?.ambient?.fx).toBe('ink');
    expect(ink?.ambient?.particles).toBe(false);
    expect(ink?.ambient?.grid).toBe(false);
    expect(ink?.ambient?.scanlines).toBe(false);
  });

  it('light 预设的强调色在浅底上仍有足够对比(相对亮度差 > 0.25)', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    };
    for (const p of THEME_PRESETS.filter((x) => isLightPalette(x.palette))) {
      for (const c of [p.palette.accent, p.palette.accent2]) {
        expect(lum(p.palette.bg) - lum(c)).toBeGreaterThan(0.25);
      }
    }
  });

  it('非法色按深色兜底', () => {
    expect(isLightPalette({ bg: 'zzz', bgDeep: '#000', accent: '#000', accent2: '#000' })).toBe(false);
  });
});
