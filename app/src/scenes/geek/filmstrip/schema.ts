import { z } from 'zod';
import type { FieldMeta } from '../../types';
import type { Aspect, BrandKit } from '../../../types';

/** 快进时掠过的候选仓库(今日项目也是其中一帧,经 today 索引选中) */
const repoBriefSchema = z.object({
  owner: z.string().min(1).max(60),
  repo: z.string().min(1).max(60),
  stars: z.number().int().min(0).max(9_999_999),
  lang: z.string().max(30),
});

export const filmstripSchema = z
  .object({
    candidates: z.array(repoBriefSchema).min(2).max(8),
    /** 今日项目在胶片条中的帧索引(回退落点) */
    today: z.number().int().min(0),
    pickLabel: z.string().min(1).max(40),
    speed: z.enum(['normal', 'fast']),
    showStars: z.boolean(),
    accentFrame: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.today >= v.candidates.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['today'], message: '今日项目索引超出候选列表范围' });
    }
  });

export type FilmstripProps = z.infer<typeof filmstripSchema>;
export type RepoBrief = z.infer<typeof repoBriefSchema>;

/**
 * 胶片条布局:Component 渲染结构、timeline 计算行程,共用此常量。
 * 9:16 纵向滚动,其余画幅横向。
 */
export function filmLayout(aspect: Aspect): { axis: 'x' | 'y'; frameW: number; frameH: number; gap: number } {
  return aspect === '9:16'
    ? { axis: 'y', frameW: 720, frameH: 380, gap: 56 }
    : { axis: 'x', frameW: 420, frameH: 300, gap: 56 };
}

const itemFields: FieldMeta[] = [
  { key: 'owner', label: 'Owner', control: 'text' },
  { key: 'repo', label: 'Repo', control: 'text' },
  { key: 'lang', label: '语言', control: 'text' },
  { key: 'stars', label: 'Stars', control: 'number', min: 0, max: 9_999_999 },
];

export const filmstripMeta: FieldMeta[] = [
  {
    key: 'candidates',
    label: '候选仓库',
    control: 'repeater',
    group: '内容',
    min: 2,
    max: 8,
    itemFields,
    itemDefaults: { owner: 'owner', repo: 'repo', lang: 'TypeScript', stars: 1000 },
    itemTitleKey: 'repo',
  },
  {
    key: 'today',
    label: '今日项目',
    control: 'select',
    group: '内容',
    coerce: 'number',
    optionsFn: (props) => {
      const list = Array.isArray(props.candidates) ? (props.candidates as RepoBrief[]) : [];
      return list.map((c, i) => ({ value: String(i), label: `${i} · ${c.owner}/${c.repo}` }));
    },
  },
  { key: 'pickLabel', label: '选中标语', control: 'text', group: '内容', placeholder: "TODAY'S PICK 后缀文案" },
  {
    key: 'speed',
    label: '快进节奏',
    control: 'select',
    group: '节奏',
    options: [
      { value: 'normal', label: '正常' },
      { value: 'fast', label: '快' },
    ],
  },
  { key: 'showStars', label: '显示 Stars', control: 'switch', group: '视觉', live: true },
  { key: 'accentFrame', label: '视窗跟随品牌色', control: 'switch', group: '视觉', live: true },
];

export function filmstripDefaults(_brand: BrandKit): FilmstripProps {
  return {
    candidates: [
      { owner: 'sharkdp', repo: 'bat', stars: 52000, lang: 'Rust' },
      { owner: 'BurntSushi', repo: 'ripgrep', stars: 50000, lang: 'Rust' },
      { owner: 'motiondivision', repo: 'motion', stars: 26800, lang: 'TypeScript' },
      { owner: 'charmbracelet', repo: 'vhs', stars: 18000, lang: 'Go' },
      { owner: 'antfu-collective', repo: 'ni', stars: 17000, lang: 'TypeScript' },
    ],
    today: 2,
    pickLabel: '今日开源',
    speed: 'normal',
    showStars: true,
    accentFrame: true,
  };
}
