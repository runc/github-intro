/**
 * 内置模板(DESIGN.md 3.4):场景类型的有序组合 + 转场 + 默认 props。
 * GitHub「开源极客片头」同时产出横屏 16:9 与竖屏 9:16 两份文档,顶栏可切换。
 */
import type { Aspect, BrandKit, VDocument } from '../types';
import { defaultTransitions, emptyDocument, uid } from '../types';
import { instantiateScene } from '../scenes/registry';

export interface TemplateDef {
  id: string;
  title: string;
  description: string;
  kind: 'motion' | 'cover';
  /** 新建时为每个画幅生成一份文档;缺省仅 16:9 */
  aspects?: Aspect[];
  build: (brand: BrandKit, aspect: Aspect) => VDocument;
}

function docFrom(name: string, brand: BrandKit, sceneTypes: string[], aspect: Aspect): VDocument {
  const doc = emptyDocument(name, 'motion', aspect);
  doc.scenes = sceneTypes.map((t) => instantiateScene(t, brand));
  doc.transitions = defaultTransitions(sceneTypes.length).map((t, i) =>
    i === 0 ? { ...t, type: 'dissolve' as const, overlap: 0.6 } : t,
  );
  return doc;
}

function geekIntro(brand: BrandKit, aspect: Aspect): VDocument {
  const name = aspect === '9:16' ? '片头竖屏' : aspect === '4:3' ? '片头 4:3' : '片头';
  const doc = docFrom(name, brand, ['geek.terminal', 'geek.repoCard', 'geek.glitchTitle'], aspect);
  doc.transitions = doc.transitions.map(() => ({ type: 'cut' as const, overlap: 0 }));
  doc.ambient = { particles: true, grid: true, scanlines: true, vignette: true, fx: 'matrix', fxIntensity: 0.8 };
  return doc;
}

/** 胶片快讲:快进掠过候选仓库 → 回退选中今日项目 → 仓库卡片 → Glitch 标题(全程 cut,保持镜头连续感) */
function filmstripIntro(brand: BrandKit, aspect: Aspect): VDocument {
  const name = aspect === '9:16' ? '片头竖屏' : '片头';
  const doc = docFrom(name, brand, ['geek.filmstrip', 'geek.repoCard', 'geek.glitchTitle'], aspect);
  doc.transitions = doc.transitions.map(() => ({ type: 'cut' as const, overlap: 0 }));
  doc.ambient = { particles: true, grid: true, scanlines: true, vignette: true, fx: 'waves', fxIntensity: 0.7 };
  return doc;
}

/** 片尾:求 Star 引导单场景,末帧定格便于录屏收尾 */
function geekOutro(brand: BrandKit, aspect: Aspect): VDocument {
  const name = aspect === '9:16' ? '片尾竖屏' : '片尾';
  const doc = docFrom(name, brand, ['geek.starOutro'], aspect);
  doc.ambient = { particles: true, grid: true, scanlines: true, vignette: true, fx: 'waves', fxIntensity: 0.6 };
  return doc;
}

export const BUILTIN_TEMPLATES: TemplateDef[] = [
  {
    id: 'geek-intro',
    title: '开源极客片头',
    description: '终端 git clone → 仓库卡片 → Glitch 标题;同时生成横屏与竖屏',
    kind: 'motion',
    aspects: ['16:9', '9:16'],
    build: geekIntro,
  },
  {
    id: 'geek-intro-portrait',
    title: '开源极客片头(竖屏)',
    description: '终端 git clone → 仓库卡片 → Glitch 标题;仅竖屏 9:16(Shorts / Reels)',
    kind: 'motion',
    aspects: ['9:16'],
    build: geekIntro,
  },
  {
    id: 'filmstrip-intro',
    title: '胶片快讲片头',
    description: '胶片快进掠过候选仓库 → 回退选中今日项目 → 仓库卡片 → Glitch 标题;同时生成横屏与竖屏',
    kind: 'motion',
    aspects: ['16:9', '9:16'],
    build: filmstripIntro,
  },
  {
    id: 'geek-outro',
    title: '开源极客片尾',
    description: '求 Star 引导:感谢语 → Star 按钮计数 → 仓库链接 → 关注收尾;同时生成横屏与竖屏',
    kind: 'motion',
    aspects: ['16:9', '9:16'],
    build: geekOutro,
  },
  {
    id: 'minimal-intro',
    title: '极简片头',
    description: 'Logo 落版 → 大字标题揭示',
    kind: 'motion',
    build: (brand, aspect) => docFrom('片头', brand, ['core.logoReveal', 'core.bigTitle'], aspect),
  },
  {
    id: 'blank',
    title: '空白文档',
    description: '从场景库自行搭建',
    kind: 'motion',
    build: (_brand, aspect) => {
      const doc = emptyDocument('片头', 'motion', aspect);
      doc.id = uid('doc_');
      return doc;
    },
  },
];

export function createProjectFromTemplate(opts: {
  name: string;
  brand: BrandKit;
  templateId?: string;
}): { project: import('../types').Project } {
  const { name, brand, templateId = 'minimal-intro' } = opts;
  const tpl = BUILTIN_TEMPLATES.find((t) => t.id === templateId) ?? BUILTIN_TEMPLATES[0];
  const now = new Date().toISOString();
  const aspects = tpl.aspects ?? ['16:9'];
  const documents = aspects.map((aspect) => tpl.build(brand, aspect));
  return {
    project: {
      version: 1,
      id: uid('proj_'),
      name,
      brandKit: brand,
      episodes: [{ id: uid('ep_'), ep: 'EP.01', title: name, documents }],
      updatedAt: now,
    },
  };
}
