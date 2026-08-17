import { describe, expect, it } from 'vitest';
import { defaultBrandKit } from '../src/types';
import { mergeSubscribeSchema, mergeSubscribeDefaults, mergeSubscribeMeta } from '../src/scenes/geek/mergeSubscribe/schema';
import { getSceneDef } from '../src/scenes/registry';

describe('geek.mergeSubscribe', () => {
  it('默认 props 通过 schema 校验', () => {
    expect(() => mergeSubscribeSchema.parse(mergeSubscribeDefaults(defaultBrandKit()))).not.toThrow();
  });

  it('检查项为空或多于 4 条时拒绝', () => {
    const base = mergeSubscribeDefaults(defaultBrandKit());
    expect(mergeSubscribeSchema.safeParse({ ...base, checks: [] }).success).toBe(false);
    expect(
      mergeSubscribeSchema.safeParse({ ...base, checks: [...base.checks, ...base.checks, ...base.checks] }).success,
    ).toBe(false);
  });

  it('PR 编号与标题越界拒绝', () => {
    const base = mergeSubscribeDefaults(defaultBrandKit());
    expect(mergeSubscribeSchema.safeParse({ ...base, number: 0 }).success).toBe(false);
    expect(mergeSubscribeSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('场景已注册,author/handle 默认绑定 Brand Kit,repeater 声明完整', () => {
    const def = getSceneDef('geek.mergeSubscribe');
    expect(def).toBeDefined();
    expect(def?.aspects).toContain('9:16');
    expect(mergeSubscribeMeta.find((m) => m.key === 'author')?.brandBind).toBe('channel');
    expect(mergeSubscribeMeta.find((m) => m.key === 'handle')?.brandBind).toBe('handle');
    const rep = mergeSubscribeMeta.find((m) => m.key === 'checks');
    expect(rep?.control).toBe('repeater');
    expect(rep?.itemFields?.length).toBeGreaterThan(0);
  });
});
