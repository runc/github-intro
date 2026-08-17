import { describe, expect, it } from 'vitest';
import { aspectClose, autoBitrate, captureSize, containDest, exportSize, frameCount, planAudioSegment } from '../src/export/plan';

describe('containDest(居中 contain)', () => {
  it('同源尺寸铺满', () => {
    expect(containDest(1920, 1080, 1920, 1080)).toEqual({ dx: 0, dy: 0, dw: 1920, dh: 1080 });
  });
  it('横源进竖画布左右留边', () => {
    const box = containDest(1920, 1080, 1080, 1920);
    expect(box.dw).toBe(1080);
    expect(box.dh).toBe(608);
    expect(box.dx).toBe(0);
    expect(box.dy).toBeGreaterThan(0);
  });
  it('竖源进横画布上下留边', () => {
    const box = containDest(1080, 1920, 1920, 1080);
    expect(box.dh).toBe(1080);
    expect(box.dw).toBe(608);
    expect(box.dy).toBe(0);
    expect(box.dx).toBeGreaterThan(0);
  });
});

describe('aspectClose(采集画幅是否已裁到目标)', () => {
  it('竖屏目标拒绝未裁切的横屏标签页', () => {
    expect(aspectClose(1920, 1080, 1080, 1920)).toBe(false);
  });
  it('竖屏目标接受竖屏采集(含 DPR 超采样)', () => {
    expect(aspectClose(1080, 1920, 1080, 1920)).toBe(true);
    expect(aspectClose(2160, 3840, 1080, 1920)).toBe(true);
  });
  it('竖屏目标接受窗口里缩小后的竖屏舞台', () => {
    expect(aspectClose(608, 1080, 1080, 1920)).toBe(true);
  });
});

describe('exportSize(H.264 偶数尺寸)', () => {
  it('原生画幅保持不变', () => {
    expect(exportSize({ w: 1920, h: 1080 }, 1)).toEqual({ w: 1920, h: 1080 });
    expect(exportSize({ w: 1080, h: 1920 }, 1)).toEqual({ w: 1080, h: 1920 });
  });

  it('缩放后仍是偶数且不小于 2', () => {
    expect(exportSize({ w: 1920, h: 1080 }, 0.5)).toEqual({ w: 960, h: 540 });
    const odd = exportSize({ w: 1921, h: 1081 }, 1);
    expect(odd.w % 2).toBe(0);
    expect(odd.h % 2).toBe(0);
    expect(exportSize({ w: 3, h: 3 }, 0.1)).toEqual({ w: 2, h: 2 });
  });
});

describe('captureSize(2× 超采样,不超过 2× 设计稿)', () => {
  it('1080p 导出栅在 4K', () => {
    expect(captureSize({ w: 1920, h: 1080 }, 1)).toEqual({ w: 3840, h: 2160, cssScale: 2 });
  });
  it('4K 导出不再 2× 成 8K', () => {
    expect(captureSize({ w: 1920, h: 1080 }, 2)).toEqual({ w: 3840, h: 2160, cssScale: 2 });
  });
  it('50% 导出栅在设计稿分辨率', () => {
    expect(captureSize({ w: 1920, h: 1080 }, 0.5)).toEqual({ w: 1920, h: 1080, cssScale: 1 });
  });
  it('竖屏同样 2×', () => {
    expect(captureSize({ w: 1080, h: 1920 }, 1)).toEqual({ w: 2160, h: 3840, cssScale: 2 });
  });
});

describe('autoBitrate(4–50 Mbps 钳制,文字向码率)', () => {
  it('1080p30 约 19.9 Mbps', () => {
    expect(autoBitrate(1920, 1080, 30)).toBe(19_906_560);
  });
  it('下限 4 Mbps', () => {
    expect(autoBitrate(320, 180, 10)).toBe(4_000_000);
  });
  it('上限 50 Mbps', () => {
    expect(autoBitrate(3840, 2160, 60)).toBe(50_000_000);
  });
});

describe('frameCount', () => {
  it('时长×fps 四舍五入,至少 1 帧', () => {
    expect(frameCount(10, 30)).toBe(300);
    expect(frameCount(0, 30)).toBe(1);
    expect(frameCount(0.016, 30)).toBe(1); // 0.48 帧 → 1
  });
});

describe('planAudioSegment(混音段裁剪)', () => {
  const base = { start: 2, offset: 0.5, volume: 0.8, assetDuration: 5 };

  it('正常段:offset 跳开头,播放到资产或文档结尾', () => {
    expect(planAudioSegment(base, 10)).toEqual({ start: 2, offset: 0.5, duration: 4.5, volume: 0.8 });
    expect(planAudioSegment(base, 4)).toEqual({ start: 2, offset: 0.5, duration: 2, volume: 0.8 }); // 钳到文档尾
  });

  it('越界与无效输入返回 null', () => {
    expect(planAudioSegment({ ...base, start: 10 }, 10)).toBeNull(); // 触发点在文档外
    expect(planAudioSegment({ ...base, offset: 5 }, 10)).toBeNull(); // 资产已被跳空
    expect(planAudioSegment({ ...base, volume: 0 }, 10)).toBeNull(); // 静音
    expect(planAudioSegment({ ...base, assetDuration: 0 }, 10)).toBeNull();
    expect(planAudioSegment({ ...base, end: 0 }, 10)).toBeNull(); // 右缘裁剪至空
  });

  it('右缘裁剪 end:片段时长受 min(可播段, end) 约束', () => {
    expect(planAudioSegment({ ...base, end: 1 }, 10)).toEqual({ start: 2, offset: 0.5, duration: 1, volume: 0.8 });
    expect(planAudioSegment({ ...base, end: 10 }, 10)).toEqual({ start: 2, offset: 0.5, duration: 4.5, volume: 0.8 }); // 超资产取可播段
    expect(planAudioSegment({ ...base, end: 2 }, 4)).toEqual({ start: 2, offset: 0.5, duration: 2, volume: 0.8 }); // 文档尾优先
  });

  it('音量钳制到 0–1', () => {
    expect(planAudioSegment({ ...base, volume: 2 }, 10)?.volume).toBe(1);
    expect(planAudioSegment({ ...base, volume: -1 }, 10)).toBeNull();
  });
});

describe('collectTrackSpecs(场景音效 + 多音轨)', () => {
  it('音轨按各自触发时刻/偏移/音量收集;场景音效起点取 sceneStarts', async () => {
    const { collectTrackSpecs } = await import('../src/export/pipeline');
    const fakePlayer = { sceneStarts: () => [0, 6.2] } as never;
    const doc = {
      scenes: [
        { sfx: { asset: { assetId: 'a1', mime: 'audio/mpeg' }, volume: 0.5, offset: 0.2 } },
        {},
      ],
      audioTracks: [
        { id: 't1', name: 'BGM', asset: { assetId: 'bgm', mime: 'audio/mpeg' }, start: 0, offset: 1.5, volume: 0.4, muted: false },
        { id: 't2', name: '转场', asset: { assetId: 'hit', mime: 'audio/mpeg' }, start: 3, offset: 0, volume: 0.9, muted: false, duration: 2.5 },
      ],
    } as never;
    const specs = collectTrackSpecs(fakePlayer, doc);
    expect(specs).toEqual([
      { asset: { assetId: 'a1', mime: 'audio/mpeg' }, start: 0, offset: 0.2, volume: 0.5 },
      { asset: { assetId: 'bgm', mime: 'audio/mpeg' }, start: 0, offset: 1.5, volume: 0.4 },
      { asset: { assetId: 'hit', mime: 'audio/mpeg' }, start: 3, offset: 0, volume: 0.9, end: 2.5 },
    ]);
  });

  it('静音音轨不参与混音;空音轨列表安全', async () => {
    const { collectTrackSpecs } = await import('../src/export/pipeline');
    const fakePlayer = { sceneStarts: () => [0] } as never;
    const doc = {
      scenes: [],
      audioTracks: [
        { id: 't1', name: 'BGM', asset: { assetId: 'bgm', mime: 'audio/mpeg' }, start: 0, offset: 0, volume: 0.4, muted: true },
      ],
    } as never;
    expect(collectTrackSpecs(fakePlayer, doc)).toEqual([]);
    const empty = { scenes: [], audioTracks: [] } as never;
    expect(collectTrackSpecs(fakePlayer, empty)).toEqual([]);
  });
});
