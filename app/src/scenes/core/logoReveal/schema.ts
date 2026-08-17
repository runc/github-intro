import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const logoRevealSchema = z.object({
  logo: z.object({ assetId: z.string(), mime: z.string(), name: z.string().optional() }).optional(),
  channel: z.string().min(1).max(60),
  handle: z.string().max(60),
  showTagline: z.boolean(),
  showRing: z.boolean(),
  /** 空串 = 跟随品牌 accent2 */
  ringColor: z.string(),
});

export type LogoRevealProps = z.infer<typeof logoRevealSchema>;

export const logoRevealMeta: FieldMeta[] = [
  { key: 'logo', label: 'Logo 图片', control: 'image', group: '内容', brandBind: 'logo' },
  { key: 'channel', label: '频道名', control: 'text', group: '内容', brandBind: 'channel' },
  { key: 'handle', label: 'Handle', control: 'text', group: '内容', brandBind: 'handle' },
  { key: 'showTagline', label: '显示标语', control: 'switch', group: '内容' },
  { key: 'showRing', label: '装饰圆环', control: 'switch', group: '视觉', live: true },
  { key: 'ringColor', label: '圆环颜色', control: 'color', group: '视觉', live: true, clearable: true },
];

export function logoRevealDefaults(brand: BrandKit): LogoRevealProps {
  return {
    logo: brand.logo,
    channel: brand.channel,
    handle: brand.handle,
    showTagline: true,
    showRing: true,
    ringColor: '',
  };
}
