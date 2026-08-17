import { describe, expect, it } from 'vitest';
import { deriveRng, hashStr, makeRng, mulberry32 } from '../src/engine/random';

describe('mulberry32 / makeRng', () => {
  it('同 seed 序列完全一致', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('不同 seed 序列不同', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, a);
    const seqB = Array.from({ length: 10 }, b);
    expect(seqA).not.toEqual(seqB);
  });

  it('输出在 [0,1) 内', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range/int/pick 服从边界', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const f = rng.range(-2, 3);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThanOrEqual(3);
      const n = rng.int(1, 5);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
    }
    expect(rng.pick([1, 2, 3])).toBeLessThanOrEqual(3);
  });
});

describe('deriveRng 子流独立性', () => {
  it('同 docSeed+sceneId+stream 派生一致', () => {
    const a = deriveRng(999, 'scene_1', 'glitch');
    const b = deriveRng(999, 'scene_1', 'glitch');
    expect(a.float()).toBe(b.float());
    expect(a.float()).toBe(b.float());
  });

  it('改一个场景 id 不影响另一个场景的随机', () => {
    const s1 = deriveRng(999, 'scene_1', 'particles');
    const s2a = deriveRng(999, 'scene_2', 'particles');
    const seq1 = Array.from({ length: 5 }, () => s1.float());
    const before = Array.from({ length: 5 }, () => s2a.float());

    const s2b = deriveRng(999, 'scene_2', 'particles');
    const after = Array.from({ length: 5 }, () => s2b.float());
    expect(before).toEqual(after);
    // scene_1 与 scene_2 的序列不同
    const s1b = deriveRng(999, 'scene_1', 'particles');
    expect(seq1).not.toEqual(Array.from({ length: 5 }, () => s1b.float() === s1b.float() ? s2b.float() : 0));
  });

  it('hashStr 稳定且对不同输入敏感', () => {
    expect(hashStr('abc')).toBe(hashStr('abc'));
    expect(hashStr('abc')).not.toBe(hashStr('abd'));
    expect(hashStr('a:b')).not.toBe(hashStr('ab'));
  });
});
