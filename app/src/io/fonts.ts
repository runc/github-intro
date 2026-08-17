/**
 * 字体(DESIGN.md 4.9):内置字体走系统栈兜底;用户上传字体经 FontFace 注册并存 assets 表(M2 扩展)。
 */

export interface BuiltinFont {
  id: string;
  label: string;
  stack: string;
}

export const BUILTIN_FONTS: BuiltinFont[] = [
  { id: 'system-sans', label: '系统无衬线', stack: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif' },
  { id: 'system-mono', label: '系统等宽', stack: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace' },
  { id: 'system-serif', label: '系统衬线', stack: '"Songti SC", "Noto Serif CJK SC", Georgia, serif' },
  { id: 'cn-kai', label: '中式楷体', stack: '"Kaiti SC", "STKaiti", "KaiTi", "TW-Kai", "Noto Serif CJK SC", "Songti SC", serif' },
];

const byId = new Map(BUILTIN_FONTS.map((f) => [f.id, f]));

export function fontStack(id: string): string {
  return byId.get(id)?.stack ?? BUILTIN_FONTS[0].stack;
}
