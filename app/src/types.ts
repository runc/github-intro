/**
 * 数据模型(DESIGN.md 4.2)
 * Project = BrandKit + Episodes[];Episode = Documents[];Document = SceneInstance[] + 转场 + 氛围 + 音频 + seed
 */

export interface AssetRef {
  assetId: string;
  mime: string;
  name?: string;
}

/** 内置字体 id 或 'system' 系列兜底;用户上传字体的 AssetRef 形式在 io/fonts 中解析 */
export type FontRef = string;

export interface Palette {
  bg: string;
  bgDeep: string;
  accent: string;
  accent2: string;
}

export interface BrandKit {
  channel: string;
  tagline: string;
  handle: string;
  logo?: AssetRef;
  palette: Palette;
  fonts: { heading: FontRef; body: FontRef; mono: FontRef };
}

export type TransitionType = 'cut' | 'dissolve' | 'slide' | 'glitch';

export interface TransitionInstance {
  type: TransitionType;
  /** 与上一场景 out 段的重叠秒数,组装时钳制到不超过两侧 in/out */
  overlap: number;
}

/** 背景特效类型(画在极光之上、网格/粒子之下;全部 draw(t) 确定性) */
export type AmbientFxType = 'none' | 'matrix' | 'waves' | 'orbs' | 'balls' | 'pile' | 'ink';

export const AMBIENT_FX_LABELS: Record<AmbientFxType, string> = {
  none: '无',
  matrix: '代码雨',
  waves: '能量波',
  orbs: '漂浮光斑',
  balls: '字符弹球',
  pile: '文字堆积',
  ink: '水墨山水',
};

/** 背景图配置(画在氛围 canvas 最底层,导出随 canvas 快照内联,无需额外处理) */
export interface AmbientBgImage {
  asset: AssetRef;
  /** 0–1 绘制不透明度 */
  opacity: number;
  fit: 'cover' | 'contain';
  /** 0–24px 高斯模糊 */
  blur: number;
  /** Ken Burns 式缓慢漂移(确定性:正弦往复) */
  motion: boolean;
}

export type AmbientConfig = {
  particles: boolean;
  grid: boolean;
  scanlines: boolean;
  vignette: boolean;
  /** 背景特效;旧项目缺省视为 'none' */
  fx?: AmbientFxType;
  /** 特效/极光强度 0.2–1;旧项目缺省视为 0.7 */
  fxIntensity?: number;
  /** 字符弹球/文字堆积的字符集(逐字符取用);留空/缺省用内置汉字集 */
  fxChars?: string;
  /** 背景图 */
  bgImage?: AmbientBgImage;
};

export type Aspect = '16:9' | '9:16' | '4:3';

export const ASPECTS: Aspect[] = ['16:9', '9:16', '4:3'];

export const ASPECT_LABELS: Record<Aspect, string> = {
  '16:9': '横屏 16:9',
  '9:16': '竖屏 9:16',
  '4:3': '4:3',
};

export function isAspect(v: string | undefined): v is Aspect {
  return v === '16:9' || v === '9:16' || v === '4:3';
}

export interface SceneInstance {
  id: string;
  /** scenes/registry 的 key,如 'core.bigTitle' */
  sceneType: string;
  /** 该场景 schema 的版本 */
  version: number;
  props: Record<string, unknown>;
  /** 字段是否仍绑定 Brand Kit(meta.brandBind 声明的字段默认 true) */
  brandBindings: Record<string, boolean>;
  /** M3 时间轴编辑:覆盖 hold 时长 */
  holdOverride?: number;
  /** 场景音效:场景起点触发播放(播放层能力,与场景类型无关) */
  sfx?: SceneSfx;
  /** 场景背景图:仅该场景时间段内覆盖文档背景图(氛围层 live 解析,不进场景 schema) */
  bgImage?: AmbientBgImage;
}

export interface SceneSfx {
  asset: AssetRef;
  /** 0–1 */
  volume: number;
  /** 跳过音频开头(秒),用于对齐音效与画面 */
  offset: number;
}

export interface VDocument {
  id: string;
  /** 展示名:片头 / 片尾 / 封面… */
  name: string;
  kind: 'motion' | 'cover';
  aspect: Aspect;
  scenes: SceneInstance[];
  /** 长度 = max(0, scenes.length - 1) */
  transitions: TransitionInstance[];
  ambient: AmbientConfig;
  /** 多音轨(v3 起):按各自触发时刻叠加混音;第 1 条即原 BGM 铺底轨 */
  audioTracks?: AudioTrack[];
  seed: number;
}

/** 文档音轨:资产 + 触发时刻 + 偏移 + 音量 + 静音 */
export interface AudioTrack {
  id: string;
  /** 轨道名(缺省用资产名) */
  name: string;
  asset: AssetRef;
  /** 主时间线触发时刻(秒) */
  start: number;
  /** 跳过音频开头(秒) */
  offset: number;
  /** 片段时长上限(秒,右缘裁剪);缺省播到资产末尾 */
  duration?: number;
  /** 0–1 */
  volume: number;
  muted: boolean;
}

export function makeAudioTrack(asset: AssetRef, partial?: Partial<Omit<AudioTrack, 'id' | 'asset'>>): AudioTrack {
  return {
    id: uid('at_'),
    name: asset.name ?? '音轨',
    asset,
    start: 0,
    offset: 0,
    volume: 0.6,
    muted: false,
    ...partial,
  };
}

/** BGM 编辑载荷(GlobalPanel 兼容形状;编辑的总是音轨第 1 条) */
export interface DocAudio {
  asset: AssetRef;
  /** 跳过音频开头(秒) */
  offset: number;
  /** 0–1 */
  volume?: number;
}

export interface Episode {
  id: string;
  /** 如 'EP.01' */
  ep: string;
  title: string;
  documents: VDocument[];
}

export interface Project {
  /** 项目格式版本,migration 链依据 */
  version: number;
  id: string;
  name: string;
  brandKit: BrandKit;
  episodes: Episode[];
  updatedAt: string;
}

export const CURRENT_PROJECT_VERSION = 3;

export const ASPECT_PIXELS: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '4:3': { w: 1600, h: 1200 },
};

export const THEME_PRESETS: {
  id: string;
  label: string;
  palette: Palette;
  /** 呼应主题的字体搭配,预设应用时一并写入 */
  fonts?: BrandKit['fonts'];
  /** 呼应主题的氛围配置(特效/网格/暗角等),预设应用时写入当前文档 */
  ambient?: AmbientConfig;
}[] = [
  { id: 'github', label: 'GitHub 绿', palette: { bg: '#0d1117', bgDeep: '#010409', accent: '#3fb950', accent2: '#58a6ff' } },
  { id: 'violet', label: '电光紫', palette: { bg: '#14101f', bgDeep: '#070510', accent: '#a371f7', accent2: '#3fb950' } },
  { id: 'sunset', label: '日落橙', palette: { bg: '#1a1020', bgDeep: '#0c0512', accent: '#ff7b54', accent2: '#ffb26b' } },
  { id: 'champagne', label: '香槟金', palette: { bg: '#15130d', bgDeep: '#070604', accent: '#d4b06a', accent2: '#8a9a5b' } },
  { id: 'github-light', label: '亮白极客', palette: { bg: '#f6f8fa', bgDeep: '#e4e9ef', accent: '#1a7f37', accent2: '#0969da' } },
  { id: 'mist-blue', label: '晨雾蓝', palette: { bg: '#eef3f9', bgDeep: '#d8e3ef', accent: '#0b5fd7', accent2: '#0d7d6e' } },
  { id: 'paper', label: '纸墨白', palette: { bg: '#f7f4ec', bgDeep: '#e8e2d2', accent: '#b45309', accent2: '#3f6212' } },
  { id: 'sakura', label: '樱粉白', palette: { bg: '#fdf1f4', bgDeep: '#f0dbe3', accent: '#c22986', accent2: '#6d28d9' } },
  {
    // 宣纸底 + 焦墨 + 朱砂印泥;标题用楷体呼应毛笔字,正文宋体,等宽仍留给代码;
    // 氛围切水墨特效(墨晕/远山/红日/飞鸟),关掉科幻向的网格/扫描线/粒子
    id: 'ink-wash',
    label: '水墨山水',
    palette: { bg: '#f3eee1', bgDeep: '#e0d8c2', accent: '#222b2e', accent2: '#a93326' },
    fonts: { heading: 'cn-kai', body: 'system-serif', mono: 'system-mono' },
    ambient: { particles: false, grid: false, scanlines: false, vignette: true, fx: 'ink', fxIntensity: 0.85 },
  },
];

/** 相对亮度(YIQ 近似):> 0.5 视为浅色底 */
export function isLightPalette(palette: Palette): boolean {
  const n = parseInt(palette.bg.slice(1), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

export function uid(prefix = ''): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export function defaultBrandKit(channel = '我的频道', tagline = 'code · craft · share', handle = '@mychannel'): BrandKit {
  return {
    channel,
    tagline,
    handle,
    palette: { ...THEME_PRESETS[0].palette },
    fonts: { heading: 'system-sans', body: 'system-sans', mono: 'system-mono' },
  };
}

export function defaultTransitions(n: number): TransitionInstance[] {
  return Array.from({ length: Math.max(0, n - 1) }, () => ({ type: 'dissolve' as TransitionType, overlap: 0.5 }));
}

export function emptyDocument(name: string, kind: VDocument['kind'] = 'motion', aspect: Aspect = '16:9'): VDocument {
  return {
    id: uid('doc_'),
    name,
    kind,
    aspect,
    scenes: [],
    transitions: [],
    ambient: { particles: false, grid: false, scanlines: false, vignette: true, fx: 'none', fxIntensity: 0.7 },
    seed: (Math.random() * 0xffffffff) >>> 0,
  };
}
