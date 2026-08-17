import { describe, expect, it } from 'vitest';
import { defaultBrandKit } from '../src/types';
import { createProjectFromTemplate } from '../src/io/templates';

describe('内置模板', () => {
  it('开源极客片头同时生成横屏 16:9 与竖屏 9:16 两份文档', () => {
    const { project } = createProjectFromTemplate({
      name: 'GitHub 快讲',
      brand: defaultBrandKit('宝玉', 'code · craft · share', '@baoyu'),
      templateId: 'geek-intro',
    });
    const docs = project.episodes[0].documents;
    expect(docs.map((d) => d.aspect)).toEqual(['16:9', '9:16']);
    expect(docs.map((d) => d.name)).toEqual(['片头', '片头竖屏']);
    for (const doc of docs) {
      expect(doc.scenes.map((s) => s.sceneType)).toEqual(['geek.terminal', 'geek.repoCard', 'geek.glitchTitle']);
      expect(doc.kind).toBe('motion');
    }
  });

  it('极简片头默认只有横屏一份', () => {
    const { project } = createProjectFromTemplate({
      name: '极简',
      brand: defaultBrandKit(),
      templateId: 'minimal-intro',
    });
    expect(project.episodes[0].documents).toHaveLength(1);
    expect(project.episodes[0].documents[0].aspect).toBe('16:9');
  });

  it('胶片快讲片头:filmstrip 打头,横竖屏各一份,全程 cut 转场', () => {
    const { project } = createProjectFromTemplate({
      name: '胶片快讲',
      brand: defaultBrandKit(),
      templateId: 'filmstrip-intro',
    });
    const docs = project.episodes[0].documents;
    expect(docs.map((d) => d.aspect)).toEqual(['16:9', '9:16']);
    for (const doc of docs) {
      expect(doc.scenes.map((s) => s.sceneType)).toEqual(['geek.filmstrip', 'geek.repoCard', 'geek.glitchTitle']);
      expect(doc.transitions.every((t) => t.type === 'cut')).toBe(true);
      // filmstrip 场景 props 经过 schema 校验且 today 指向有效帧
      const strip = doc.scenes[0];
      expect(strip.props.candidates).toHaveLength(5);
      expect(strip.props.today).toBe(2);
    }
  });
});
