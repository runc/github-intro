/**
 * seeded PRNG(DESIGN.md 4.4 硬规则 2 / 4.5)
 * mulberry32 + 文档级 seed 派生子流:
 * 改一个场景的文本不影响另一个场景的随机(stream 以 docSeed + sceneId + stream 名哈希派生)。
 */

export interface Rng {
  /** [0, 1) 均匀分布 */
  float(): number;
  range(min: number, max: number): number;
  /** [min, max] 整数 */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  sign(): number;
}

/** xfnv1a 字符串哈希,32 位 */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    float: next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** 从文档 seed 派生指定场景、指定名字的随机子流 */
export function deriveRng(docSeed: number, sceneId: string, stream: string): Rng {
  return makeRng(hashStr(`${docSeed}:${sceneId}:${stream}`) ^ 0x9e3779b9);
}
