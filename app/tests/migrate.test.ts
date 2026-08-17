import { describe, expect, it } from 'vitest';
import type { Project } from '../src/types';
import { CURRENT_PROJECT_VERSION } from '../src/types';
import { migrateProject } from '../src/engine/migrate';

function baseDoc() {
  return {
    id: 'd1',
    name: '片头',
    kind: 'motion' as const,
    aspect: '16:9' as const,
    scenes: [],
    transitions: [],
    ambient: { particles: false, grid: false, scanlines: false, vignette: true },
    seed: 1,
  };
}

function v1Project(audio?: unknown): Project {
  return {
    version: 1,
    id: 'p1',
    name: '旧项目',
    brandKit: {
      channel: 'c',
      tagline: '',
      handle: '',
      palette: { bg: '#0d1117', bgDeep: '#010409', accent: '#3fb950', accent2: '#58a6ff' },
      fonts: { heading: 'system-sans', body: 'system-sans', mono: 'system-mono' },
    },
    episodes: [
      {
        id: 'ep1',
        ep: 'EP.01',
        title: 't',
        documents: [{ ...baseDoc(), ...(audio ? { audio: audio as never } : {}) }],
      },
    ],
    updatedAt: '2026-01-01T00:00:00Z',
  } as Project;
}

/** v2:audio 已是 { asset, offset, volume? } 新形状 */
function v2Project(audio?: unknown): Project {
  const p = v1Project(undefined);
  return {
    ...p,
    version: 2,
    episodes: [{ ...p.episodes[0], documents: [{ ...baseDoc(), ...(audio ? { audio: audio as never } : {}) }] }],
  };
}

describe('项目迁移链', () => {
  it('v1 → 最新:doc.audio 并入 audioTracks 首条铺底轨', () => {
    const p = migrateProject(v1Project({ assetId: 'asset_bgm', offset: 3 }));
    expect(p.version).toBe(CURRENT_PROJECT_VERSION);
    const doc = p.episodes[0].documents[0];
    expect(doc.audioTracks).toHaveLength(1);
    expect(doc.audioTracks![0]).toMatchObject({
      id: expect.stringMatching(/^at_/),
      name: 'BGM',
      asset: { assetId: 'asset_bgm', mime: 'audio/*' },
      start: 0,
      offset: 3,
      volume: 0.6,
      muted: false,
    });
  });

  it('v2 → 最新:volume 与资产名保留', () => {
    const p = migrateProject(v2Project({ asset: { assetId: 'asset_bgm', mime: 'audio/mpeg', name: 'song.mp3' }, offset: 1, volume: 0.8 }));
    expect(p.version).toBe(CURRENT_PROJECT_VERSION);
    const t = p.episodes[0].documents[0].audioTracks![0];
    expect(t).toMatchObject({ name: 'song.mp3', offset: 1, volume: 0.8, start: 0 });
  });

  it('无 BGM 的旧项目升级后为空音轨列表', () => {
    const p = migrateProject(v1Project(undefined));
    expect(p.version).toBe(CURRENT_PROJECT_VERSION);
    expect(p.episodes[0].documents[0].audioTracks).toEqual([]);
  });

  it('拒绝高于应用版本的项目', () => {
    expect(() => migrateProject({ ...v1Project(undefined), version: CURRENT_PROJECT_VERSION + 1 })).toThrow('高于应用支持');
  });
});
