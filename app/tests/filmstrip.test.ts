import { describe, expect, it } from 'vitest';
import { defaultBrandKit } from '../src/types';
import { filmstripSchema, filmstripDefaults, filmstripMeta } from '../src/scenes/geek/filmstrip/schema';
import { getSceneDef } from '../src/scenes/registry';

describe('geek.filmstrip', () => {
  it('默认 props 通过 schema 校验', () => {
    expect(() => filmstripSchema.parse(filmstripDefaults(defaultBrandKit()))).not.toThrow();
  });

  it('today 索引超出候选列表时拒绝', () => {
    const bad = { ...filmstripDefaults(defaultBrandKit()), today: 5 };
    expect(filmstripSchema.safeParse(bad).success).toBe(false);
  });

  it('候选列表少于 2 个或多于 8 个时拒绝', () => {
    const base = filmstripDefaults(defaultBrandKit());
    expect(filmstripSchema.safeParse({ ...base, candidates: base.candidates.slice(0, 1), today: 0 }).success).toBe(false);
    expect(filmstripSchema.safeParse({ ...base, candidates: [...base.candidates, ...base.candidates] }).success).toBe(false);
  });

  it('场景已注册且 repeater 字段声明完整', () => {
    const def = getSceneDef('geek.filmstrip');
    expect(def).toBeDefined();
    const rep = filmstripMeta.find((m) => m.key === 'candidates');
    expect(rep?.control).toBe('repeater');
    expect(rep?.itemFields?.length).toBeGreaterThan(0);
    expect(rep?.itemDefaults).toBeDefined();
  });
});
