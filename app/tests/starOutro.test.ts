import { describe, expect, it } from 'vitest';
import { defaultBrandKit } from '../src/types';
import { starOutroSchema, starOutroDefaults, starOutroMeta, fmtCount } from '../src/scenes/geek/starOutro/schema';
import { getSceneDef } from '../src/scenes/registry';
import { createProjectFromTemplate } from '../src/io/templates';

describe('geek.starOutro', () => {
  it('默认 props 通过 schema 校验', () => {
    expect(() => starOutroSchema.parse(starOutroDefaults(defaultBrandKit()))).not.toThrow();
  });

  it('空 owner/repo、空引导语拒绝', () => {
    const base = starOutroDefaults(defaultBrandKit());
    expect(starOutroSchema.safeParse({ ...base, owner: '' }).success).toBe(false);
    expect(starOutroSchema.safeParse({ ...base, repo: '' }).success).toBe(false);
    expect(starOutroSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('场景已注册,handle/tagline 默认绑定 Brand Kit', () => {
    const def = getSceneDef('geek.starOutro');
    expect(def).toBeDefined();
    expect(def?.aspects).toContain('9:16');
    expect(starOutroMeta.find((m) => m.key === 'handle')?.brandBind).toBe('handle');
    expect(starOutroMeta.find((m) => m.key === 'tagline')?.brandBind).toBe('tagline');
  });

  it('fmtCount 千位缩写', () => {
    expect(fmtCount(26800)).toBe('26.8k');
    expect(fmtCount(920)).toBe('920');
    expect(fmtCount(1000)).toBe('1k');
  });

  it('开源极客片尾模板:单场景,横竖屏各一份', () => {
    const { project } = createProjectFromTemplate({ name: '片尾', brand: defaultBrandKit(), templateId: 'geek-outro' });
    expect(project.episodes[0].documents).toHaveLength(2);
    for (const doc of project.episodes[0].documents) {
      expect(doc.scenes.map((s) => s.sceneType)).toEqual(['geek.starOutro']);
      expect(doc.transitions).toHaveLength(0);
    }
  });
});
