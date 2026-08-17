import { describe, expect, it } from 'vitest';
import type { Project, SceneInstance, VDocument } from '../src/types';
import { referencedAssetIds, scanAssetUsage } from '../src/io/assetUsage';
import { defaultBrandKit } from '../src/types';

function makeScene(id: string, overrides: Partial<SceneInstance> = {}): SceneInstance {
  return { id, sceneType: 'core.bigTitle', version: 1, props: {}, brandBindings: {}, ...overrides };
}

function makeDoc(id: string, name: string, overrides: Partial<VDocument> = {}): VDocument {
  return {
    id,
    name,
    kind: 'motion',
    aspect: '16:9',
    scenes: [],
    transitions: [],
    ambient: { particles: false, grid: false, scanlines: false, vignette: true },
    seed: 1,
    ...overrides,
  };
}

function makeProject(name: string, docs: VDocument[]): Project {
  return {
    version: 1,
    id: 'p1',
    name,
    brandKit: defaultBrandKit(),
    episodes: [{ id: 'ep1', ep: 'EP.01', title: 't', documents: docs }],
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('资产引用扫描', () => {
  it('referencedAssetIds 覆盖 logo / 背景图 / BGM / 场景音效 / 场景背景图(bgImage 回归)', () => {
    const project = makeProject('P', [
      makeDoc('d1', '片头', {
        ambient: {
          particles: false,
          grid: false,
          scanlines: false,
          vignette: true,
          bgImage: { asset: { assetId: 'asset_bg', mime: 'image/png' }, opacity: 0.5, fit: 'cover', blur: 0, motion: true },
        },
        audioTracks: [
          { id: 'at1', name: 'BGM', asset: { assetId: 'asset_bgm', mime: 'audio/mpeg' }, start: 0, offset: 0, volume: 0.6, muted: false },
        ],
        scenes: [
          makeScene('s1', { sfx: { asset: { assetId: 'asset_sfx', mime: 'audio/mpeg' }, volume: 0.8, offset: 0 } }),
          makeScene('s2', {
            bgImage: { asset: { assetId: 'asset_sbg', mime: 'image/png' }, opacity: 0.6, fit: 'cover', blur: 0, motion: true },
          }),
        ],
      }),
    ]);
    project.brandKit.logo = { assetId: 'asset_logo', mime: 'image/png' };

    expect([...referencedAssetIds(project)].sort()).toEqual(['asset_bg', 'asset_bgm', 'asset_logo', 'asset_sbg', 'asset_sfx']);
  });

  it('scanAssetUsage 输出带项目/文档/用途的标签,未引用资产不出现', () => {
    const shared = { asset: { assetId: 'asset_bg', mime: 'image/png' }, opacity: 0.5, fit: 'cover' as const, blur: 0, motion: true };
    const project = makeProject('测试项目', [
      makeDoc('d1', '片头', {
        ambient: { particles: false, grid: false, scanlines: false, vignette: true, bgImage: shared },
        scenes: [makeScene('s1', { sfx: { asset: { assetId: 'asset_sfx', mime: 'audio/mpeg' }, volume: 0.8, offset: 0 } })],
      }),
      makeDoc('d2', '片尾', {
        ambient: { particles: false, grid: false, scanlines: false, vignette: true, bgImage: shared },
        audioTracks: [
          { id: 'at2', name: '片尾曲', asset: { assetId: 'asset_outro', mime: 'audio/mpeg' }, start: 5, offset: 0, volume: 0.7, muted: false },
        ],
      }),
    ]);
    project.brandKit.logo = { assetId: 'asset_logo', mime: 'image/png' };

    const usage = scanAssetUsage([project]);

    expect(usage.get('asset_bg')).toEqual(['测试项目 · 片头 · 背景图', '测试项目 · 片尾 · 背景图']);
    expect(usage.get('asset_sfx')).toEqual(['测试项目 · 片头 · 大字标题揭示 音效']);
    expect(usage.get('asset_outro')).toEqual(['测试项目 · 片尾 · 音轨「片尾曲」']);
    expect(usage.get('asset_logo')).toEqual(['测试项目 · 品牌 Logo']);
    expect(usage.has('asset_missing')).toBe(false);
  });

  it('场景背景图覆盖带场景名标签', () => {
    const project = makeProject('P', [
      makeDoc('d1', '片头', {
        scenes: [
          makeScene('s1', {
            bgImage: { asset: { assetId: 'asset_sbg', mime: 'image/png' }, opacity: 0.6, fit: 'cover', blur: 0, motion: true },
          }),
        ],
      }),
    ]);
    const usage = scanAssetUsage([project]);
    expect(usage.get('asset_sbg')).toEqual(['P · 片头 · 大字标题揭示 背景图']);
  });

  it('多项目:同名引用标签不重复,跨项目分别列出', () => {
    const doc = makeDoc('d1', '片头', {
      ambient: {
        particles: false,
        grid: false,
        scanlines: false,
        vignette: true,
        bgImage: { asset: { assetId: 'asset_bg', mime: 'image/png' }, opacity: 0.5, fit: 'cover', blur: 0, motion: true },
      },
    });
    const a = makeProject('项目A', [doc]);
    const b = makeProject('项目B', [makeDoc('d1', '片头', { ambient: doc.ambient })]);

    const usage = scanAssetUsage([a, b]);

    expect(usage.get('asset_bg')).toEqual(['项目A · 片头 · 背景图', '项目B · 片头 · 背景图']);
  });
});
