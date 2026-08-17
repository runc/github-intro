import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const glitchTitleSchema = z.object({
  kickerPrefix: z.string().max(40),
  ep: z.string().max(12),
  title: z.string().min(1).max(40),
  tagline: z.string().max(80),
  epTitle: z.string().max(60),
  cps: z.number().min(8).max(30),
  glitch: z.boolean(),
  glow: z.boolean(),
});

export type GlitchTitleProps = z.infer<typeof glitchTitleSchema>;

export const glitchTitleMeta: FieldMeta[] = [
  { key: 'kickerPrefix', label: 'Kicker 前缀', control: 'text', group: '内容' },
  { key: 'ep', label: '期号', control: 'text', group: '内容' },
  { key: 'epTitle', label: '期号条文案', control: 'text', group: '内容', placeholder: '【】高亮' },
  { key: 'title', label: '频道名', control: 'text', group: '内容', brandBind: 'channel' },
  { key: 'tagline', label: '标语', control: 'text', group: '内容', brandBind: 'tagline' },
  { key: 'cps', label: '打字速度', control: 'slider', group: '节奏', min: 8, max: 30, step: 1 },
  { key: 'glitch', label: '故障闪现 (Glitch)', control: 'switch', group: '特效' },
  { key: 'glow', label: '标题辉光呼吸', control: 'switch', group: '特效' },
];

export function glitchTitleDefaults(brand: BrandKit): GlitchTitleProps {
  return {
    kickerPrefix: 'OPEN SOURCE WEEKLY',
    ep: 'EP.01',
    title: brand.channel,
    tagline: brand.tagline,
    epTitle: '本期精彩,【马上开始】',
    cps: 13,
    glitch: true,
    glow: true,
  };
}
