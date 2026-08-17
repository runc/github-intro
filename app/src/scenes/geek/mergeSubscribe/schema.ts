import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const mergeSubscribeSchema = z.object({
  /** PR 编号 */
  number: z.number().int().min(1).max(99999),
  title: z.string().min(1).max(60),
  author: z.string().max(60),
  /** CI 检查项,逐条打勾 */
  checks: z.array(z.object({ label: z.string().min(1).max(24) })).min(1).max(4),
  /** 批准人(默认 YOU —— 观众亲自批准) */
  reviewer: z.string().min(1).max(20),
  mergeLabel: z.string().min(1).max(24),
  mergedLabel: z.string().min(1).max(24),
  handle: z.string().max(60),
  /** 收尾行动号召 */
  cta: z.string().max(80),
  confetti: z.boolean(),
});

export type MergeSubscribeProps = z.infer<typeof mergeSubscribeSchema>;

/**
 * GitHub 语义色(拟物,不随主题翻转):open 绿 / merged 紫。
 * Component 渲染 merged 终态;timeline 在 0 帧退回绿态,点击时刻 tween 回来。
 */
export const MERGE_GREEN = '#1f883d';
export const MERGE_GREEN_FG = '#3fb950';
export const MERGED_PURPLE = '#8250df';
export const MERGED_PURPLE_FG = '#a371f7';
export const CARD_BASE_SHADOW =
  '0 40px 100px rgba(0,0,0,.65), 0 0 90px color-mix(in srgb, var(--vk-accent) 18%, transparent), inset 0 1px 0 rgba(255,255,255,.06)';
export const CARD_MERGED_SHADOW = `0 40px 100px rgba(0,0,0,.65), 0 0 110px ${MERGED_PURPLE}66, inset 0 1px 0 rgba(255,255,255,.06)`;

export const mergeSubscribeMeta: FieldMeta[] = [
  { key: 'title', label: 'PR 标题', control: 'text', group: '内容' },
  { key: 'number', label: 'PR 编号', control: 'number', group: '内容', min: 1, max: 99999 },
  { key: 'author', label: '发起人', control: 'text', group: '内容', brandBind: 'channel' },
  {
    key: 'checks',
    label: 'CI 检查项',
    control: 'repeater',
    group: '检查',
    min: 1,
    max: 4,
    itemFields: [{ key: 'label', label: '文案', control: 'text' }],
    itemDefaults: { label: '检查通过' },
    itemTitleKey: 'label',
  },
  { key: 'reviewer', label: '批准人', control: 'text', group: '审查', placeholder: 'YOU' },
  { key: 'mergeLabel', label: '合并按钮文案', control: 'text', group: '按钮' },
  { key: 'mergedLabel', label: '已合并文案', control: 'text', group: '按钮' },
  { key: 'handle', label: 'Handle', control: 'text', group: '收尾', brandBind: 'handle' },
  { key: 'cta', label: '行动号召', control: 'text', group: '收尾' },
  { key: 'confetti', label: '合并彩带', control: 'switch', group: '特效' },
];

export function mergeSubscribeDefaults(brand: BrandKit): MergeSubscribeProps {
  return {
    number: 42,
    title: 'feat: 订阅这个频道,一期都不错过',
    author: brand.channel,
    checks: [{ label: '内容质量 · 超标' }, { label: '更新频率 · 稳定' }, { label: '广告 · 0 条' }],
    reviewer: 'YOU',
    mergeLabel: 'Merge pull request',
    mergedLabel: 'Merged',
    handle: brand.handle,
    cta: '按下 Merge = 订阅,新视频自动合入你的时间线',
    confetti: true,
  };
}
