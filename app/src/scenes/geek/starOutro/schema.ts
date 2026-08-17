import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const starOutroSchema = z.object({
  kicker: z.string().max(40),
  title: z.string().min(1).max(40),
  owner: z.string().min(1).max(60),
  repo: z.string().min(1).max(60),
  stars: z.number().int().min(0).max(9_999_999),
  /** 仓库链接打字速度(字符/秒) */
  cps: z.number().min(8).max(30),
  handle: z.string().max(60),
  showTagline: z.boolean(),
  tagline: z.string().max(80),
  glow: z.boolean(),
});

export type StarOutroProps = z.infer<typeof starOutroSchema>;

export const starOutroMeta: FieldMeta[] = [
  { key: 'kicker', label: 'Kicker', control: 'text', group: '内容' },
  { key: 'title', label: '引导语', control: 'text', group: '内容' },
  { key: 'owner', label: 'Owner', control: 'text', group: '仓库' },
  { key: 'repo', label: 'Repo', control: 'text', group: '仓库' },
  { key: 'stars', label: 'Stars', control: 'number', group: '仓库', min: 0, max: 9_999_999 },
  { key: 'cps', label: '链接打字速度', control: 'slider', group: '节奏', min: 8, max: 30, step: 1 },
  { key: 'handle', label: 'Handle', control: 'text', group: '收尾', brandBind: 'handle' },
  { key: 'showTagline', label: '显示标语', control: 'switch', group: '收尾' },
  { key: 'tagline', label: '标语', control: 'text', group: '收尾', brandBind: 'tagline' },
  { key: 'glow', label: '按钮辉光呼吸', control: 'switch', group: '特效' },
];

export function starOutroDefaults(brand: BrandKit): StarOutroProps {
  return {
    kicker: 'THANKS FOR WATCHING',
    title: '觉得有用,就点个 Star',
    owner: 'motiondivision',
    repo: 'motion',
    stars: 26800,
    cps: 16,
    handle: brand.handle,
    showTagline: true,
    tagline: brand.tagline,
    glow: true,
  };
}

/** 26800 → 26.8k(与 repoCard 同款,场景保持自包含) */
export function fmtCount(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}
