import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../src/types';

// 用内存实现替换 IndexedDB 层
const assets = new Map<string, Blob>();
const savedProjects: Project[] = [];
vi.mock('../src/io/db', () => ({
  putAsset: vi.fn(async (id: string, blob: Blob) => void assets.set(id, blob)),
  putProject: vi.fn(async (p: Project) => void savedProjects.push(p)),
  getAsset: vi.fn(async (id: string) => assets.get(id)),
}));

const { exportProject, importProject } = await import('../src/io/projectFile');
const { defaultBrandKit } = await import('../src/types');
const { createProjectFromTemplate } = await import('../src/io/templates');

beforeEach(() => {
  assets.clear();
  savedProjects.length = 0;
});

describe('.vkit.json 导出/导入', () => {
  it('round-trip:导出再导入后项目数据等价且资产还原为 blob', async () => {
    const brand = defaultBrandKit('测试频道', '标语', '@test');
    brand.logo = { assetId: 'asset_logo', mime: 'image/png' };
    assets.set('asset_logo', new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' }));

    const { project } = createProjectFromTemplate({ name: '测试项目', brand });
    // 背景图与场景音效也是导出范围(bgImage 曾被漏扫,回归覆盖)
    const doc = project.episodes[0].documents[0];
    doc.ambient.bgImage = {
      asset: { assetId: 'asset_bg', mime: 'image/jpeg', name: 'bg.jpg' },
      opacity: 0.5,
      fit: 'cover',
      blur: 0,
      motion: true,
    };
    doc.scenes[0].sfx = { asset: { assetId: 'asset_sfx', mime: 'audio/mpeg', name: 'ding.mp3' }, volume: 0.8, offset: 0 };
    assets.set('asset_bg', new File([new Uint8Array([4, 5])], 'bg.jpg', { type: 'image/jpeg' }));
    assets.set('asset_sfx', new File([new Uint8Array([6])], 'ding.mp3', { type: 'audio/mpeg' }));

    const file = await exportProject(project, async (id) => assets.get(id));

    expect(file.format).toBe('vkit-project');
    expect(file.assets['asset_logo'].data.length).toBeGreaterThan(0);
    expect(file.assets['asset_bg']).toBeDefined();
    expect(file.assets['asset_bg'].name).toBe('bg.jpg');
    expect(file.assets['asset_sfx']).toBeDefined();

    // 清空内存资产,导入应从 base64 还原
    assets.clear();
    const restored = await importProject(file);

    expect(restored.name).toBe(project.name);
    expect(restored.brandKit.channel).toBe('测试频道');
    expect(restored.brandKit.logo?.assetId).toBe('asset_logo');
    expect(restored.episodes.length).toBe(1);
    expect(restored.episodes[0].documents[0].scenes.map((s) => s.sceneType)).toEqual([
      'core.logoReveal',
      'core.bigTitle',
    ]);
    expect(restored.episodes[0].documents[0].aspect).toBe('16:9');
    expect(restored.episodes[0].documents[0].ambient.bgImage?.asset.assetId).toBe('asset_bg');
    const blob = assets.get('asset_logo');
    expect(blob).toBeDefined();
    expect(blob!.type).toBe('image/png');
    // 导入还原为 File,素材库依赖文件名展示
    expect((assets.get('asset_bg') as File).name).toBe('bg.jpg');
    expect(savedProjects).toHaveLength(1);
  });

  it('拒绝非法格式', async () => {
    await expect(importProject({ format: 'other' } as never)).rejects.toThrow('不是 .vkit.json');
  });

  it('拒绝高于应用版本的文件', async () => {
    await expect(
      importProject({ format: 'vkit-project', version: 999, project: { version: 999 } as never, assets: {} }),
    ).rejects.toThrow('高于应用支持');
  });
});
