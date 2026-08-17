import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const bigTitleSchema = z.object({
  title: z.string().min(1).max(60),
  tagline: z.string().max(120),
  /** 标语打字速度(字/秒) */
  cps: z.number().min(4).max(40),
  align: z.enum(['left', 'center']),
  /** 空串 = 跟随品牌 accent */
  accentColor: z.string(),
  showCursor: z.boolean(),
});

export type BigTitleProps = z.infer<typeof bigTitleSchema>;

export const bigTitleMeta: FieldMeta[] = [
  { key: 'title', label: '大标题', control: 'text', group: '内容', brandBind: 'channel' },
  { key: 'tagline', label: '标语', control: 'text', group: '内容', brandBind: 'tagline' },
  { key: 'cps', label: '打字速度', control: 'slider', group: '节奏', min: 4, max: 40, step: 1 },
  { key: 'showCursor', label: '显示打字光标', control: 'switch', group: '节奏' },
  { key: 'align', label: '对齐', control: 'select', group: '视觉', live: true, options: [
    { value: 'left', label: '左对齐' },
    { value: 'center', label: '居中' },
  ] },
  { key: 'accentColor', label: '强调色', control: 'color', group: '视觉', live: true, clearable: true },
];

export function bigTitleDefaults(brand: BrandKit): BigTitleProps {
  return {
    title: brand.channel,
    tagline: brand.tagline,
    cps: 18,
    align: 'left',
    accentColor: '',
    showCursor: true,
  };
}
