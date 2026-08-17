import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { BrandKit } from '../../../types';

export const terminalSchema = z.object({
  owner: z.string().min(1).max(60),
  repo: z.string().min(1).max(60),
  cps: z.number().min(8).max(30),
  /** 空串 = 跟随品牌 accent */
  borderColor: z.string(),
});

export type TerminalProps = z.infer<typeof terminalSchema>;

export const terminalMeta: FieldMeta[] = [
  { key: 'owner', label: 'Owner', control: 'text', group: '内容' },
  { key: 'repo', label: 'Repo', control: 'text', group: '内容' },
  { key: 'cps', label: '打字速度', control: 'slider', group: '节奏', min: 8, max: 30, step: 1 },
  { key: 'borderColor', label: '边框光色', control: 'color', group: '视觉', live: true, clearable: true },
];

export function terminalDefaults(_brand: BrandKit): TerminalProps {
  return {
    owner: 'motiondivision',
    repo: 'motion',
    cps: 16,
    borderColor: '',
  };
}
