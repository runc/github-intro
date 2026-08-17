import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const repoCardSchema = z.object({
  owner: z.string().min(1).max(60),
  repo: z.string().min(1).max(60),
  desc: z.string().max(200),
  lang: z.string().max(30),
  langColor: z.string(),
  stars: z.number().int().min(0).max(9_999_999),
  forks: z.number().int().min(0).max(9_999_999),
  badge: z.string().max(20),
});

export type RepoCardProps = z.infer<typeof repoCardSchema>;

export const repoCardMeta: FieldMeta[] = [
  { key: 'owner', label: 'Owner', control: 'text', group: '内容' },
  { key: 'repo', label: 'Repo', control: 'text', group: '内容' },
  { key: 'desc', label: '一句话介绍', control: 'textarea', group: '内容' },
  { key: 'badge', label: '徽标', control: 'text', group: '内容' },
  { key: 'lang', label: '语言', control: 'text', group: '元数据' },
  { key: 'langColor', label: '语言色', control: 'color', group: '元数据', live: true },
  { key: 'stars', label: 'Stars', control: 'number', group: '元数据', min: 0, max: 9_999_999 },
  { key: 'forks', label: 'Forks', control: 'number', group: '元数据', min: 0, max: 9_999_999 },
];

export function repoCardDefaults(_brand: BrandKit): RepoCardProps {
  return {
    owner: 'motiondivision',
    repo: 'motion',
    desc: 'A modern animation library for the web —— 声明式 API,驱动高性能动画',
    lang: 'TypeScript',
    langColor: '#3178c6',
    stars: 26800,
    forks: 920,
    badge: 'Public',
  };
}

/** 26800 → 26.8k */
export function fmtCount(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}
