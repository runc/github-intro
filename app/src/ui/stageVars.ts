import type { CSSProperties } from 'react';
import type { BrandKit } from '../types';
import { isLightPalette } from '../types';
import { fontStack } from '../io/fonts';

/**
 * live 字段通道(DESIGN.md 4.6):色板/字体写为舞台上的 CSS 变量,换色零重建。
 * 前景/面板/边框由色板亮度派生:浅色底配深字,深色底配浅字(light 主题支持)。
 */
export function stageCssVars(brand: BrandKit): CSSProperties {
  const { palette, fonts } = brand;
  const light = isLightPalette(palette);
  return {
    '--vk-bg': palette.bg,
    '--vk-bg-deep': palette.bgDeep,
    '--vk-accent': palette.accent,
    '--vk-accent2': palette.accent2,
    '--vk-fg': light ? '#1f2328' : '#f2f4f8',
    '--vk-fg-dim': light ? 'rgba(31, 35, 40, 0.58)' : 'rgba(240, 246, 252, 0.55)',
    '--vk-panel': light ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.05)',
    '--vk-line': light ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.16)',
    // Glitch 重影混合:深底 screen(发光感),浅底 multiply(否则彩色重影被洗成白)
    '--vk-glitch-blend': light ? 'multiply' : 'screen',
    '--vk-font-heading': fontStack(fonts.heading),
    '--vk-font-body': fontStack(fonts.body),
    '--vk-font-mono': fontStack(fonts.mono),
  } as CSSProperties;
}

export const STAGE_BACKGROUND = [
  'radial-gradient(1200px 700px at 72% 18%, color-mix(in srgb, var(--vk-accent2) 10%, transparent), transparent 60%)',
  'radial-gradient(1000px 800px at 18% 88%, color-mix(in srgb, var(--vk-accent) 12%, transparent), transparent 60%)',
  'linear-gradient(180deg, var(--vk-bg), var(--vk-bg-deep))',
].join(',');
