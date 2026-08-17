/**
 * 标签页合成器采集(方案 C):getDisplayMedia + Element/Region Capture 裁到 #stage。
 * 像素来自 Chromium 合成器,与预览同源;分辨率随舞台铺满后的设备像素。
 */

type CaptureGlobals = typeof globalThis & {
  CropTarget?: { fromElement(element: Element): Promise<unknown> };
  RestrictionTarget?: { fromElement(element: Element): Promise<unknown> };
  MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => {
    readable: ReadableStream<VideoFrame>;
  };
  CaptureController?: new () => { setFocusBehavior?: (b: 'focus-captured-surface' | 'no-focus-change') => void };
};

type BrowserCaptureTrack = MediaStreamTrack & {
  cropTo?: (target: unknown) => Promise<void>;
  restrictTo?: (target: unknown) => Promise<void>;
};

const g = globalThis as CaptureGlobals;

export function liveCaptureAvailable(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return false;
  if (typeof g.MediaStreamTrackProcessor !== 'function') return false;
  return typeof g.CropTarget === 'function' || typeof g.RestrictionTarget === 'function';
}

export async function requestTabCapture(fps: number): Promise<MediaStream> {
  const opts: Record<string, unknown> = {
    video: {
      frameRate: { ideal: fps, max: Math.max(fps, 60) },
      displaySurface: 'browser',
    },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    systemAudio: 'exclude',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'exclude',
  };
  if (typeof g.CaptureController === 'function') {
    const controller = new g.CaptureController();
    controller.setFocusBehavior?.('no-focus-change');
    opts.controller = controller;
  }
  const stream = await navigator.mediaDevices.getDisplayMedia(opts as Parameters<MediaDevices['getDisplayMedia']>[0]);
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stopStream(stream);
    throw new Error('未获得视频轨道');
  }
  const surface = track.getSettings().displaySurface;
  if (surface && surface !== 'browser') {
    stopStream(stream);
    throw new Error('请在分享弹窗中选择「Chrome 标签页 / 当前标签页」,不要选整个屏幕或窗口');
  }
  return stream;
}

export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}

async function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** 舞台在 .stage-scaler 的 CSS scale 下,Element Capture 常不出帧;无 scale 时优先 Element Capture 拿满分辨率层。 */
export async function isolateStageTrack(
  stream: MediaStream,
  stage: HTMLElement,
  prefer: 'element' | 'region' | 'auto' = 'auto',
): Promise<MediaStreamTrack> {
  const track = stream.getVideoTracks()[0] as BrowserCaptureTrack | undefined;
  if (!track) throw new Error('未获得视频轨道');
  const visual = stage.getBoundingClientRect();
  const unscaled = visual.width >= stage.offsetWidth * 0.92;
  const wantElement = prefer === 'element' || (prefer === 'auto' && unscaled);
  const Crop = g.CropTarget;
  const Restrict = g.RestrictionTarget;

  const reset = async () => {
    try {
      if (typeof track.restrictTo === 'function') await track.restrictTo(null);
    } catch {
      /* 未施加过 */
    }
    try {
      if (typeof track.cropTo === 'function') await track.cropTo(null);
    } catch {
      /* 未施加过 */
    }
  };

  const applyRestrict = async () => {
    if (!Restrict || typeof track.restrictTo !== 'function') return false;
    try {
      const target = await withTimeout(Restrict.fromElement(stage), 4000, '裁切舞台超时');
      await withTimeout(track.restrictTo(target), 4000, '裁切舞台超时');
      return true;
    } catch {
      return false;
    }
  };

  const applyCrop = async () => {
    if (!Crop || typeof track.cropTo !== 'function') return false;
    try {
      const target = await withTimeout(Crop.fromElement(stage), 4000, '裁切舞台超时');
      await withTimeout(track.cropTo(target), 4000, '裁切舞台超时');
      return true;
    } catch {
      return false;
    }
  };

  await reset();
  if (wantElement) {
    if (await applyRestrict()) return track;
    if (await applyCrop()) return track;
  } else {
    if (await applyCrop()) return track;
    if (await applyRestrict()) return track;
  }
  throw new Error('当前浏览器不支持标签页区域采集(需要较新的 Chrome / Edge)');
}

export function waitFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

/** 等纯净全屏后舞台铺满(ResizeObserver 改 scale) */
export async function waitStageLaidOut(
  stage: HTMLElement,
  timeoutMs = 1200,
  shouldAbort?: () => boolean,
): Promise<void> {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (shouldAbort?.()) return;
    const r = stage.getBoundingClientRect();
    if (r.width >= 160 && r.height >= 160) {
      await waitFrames(2);
      return;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
}