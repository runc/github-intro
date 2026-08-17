/**
 * 高清导出:实时采集当前标签页合成器画面(裁到 #stage),WebCodecs 编进 MP4,
 * 音频仍走离线混音(与 FO 草稿路径同一封装)。
 */
import gsap from 'gsap';
import type { BrandKit, VDocument } from '../types';
import { ASPECT_PIXELS } from '../types';
import type { Player } from '../engine/timeline/player';
import { autoBitrate, aspectClose, containDest, exportSize } from './plan';
import { pickVideoCodec, webCodecsAvailable } from './support';
import { encodeAac } from './audio';
import {
  ExportCancelled,
  mixDocumentAudio,
  type ExportHandle,
  type ExportProgress,
} from './pipeline';
import { isolateStageTrack, stopStream, waitFrames, waitStageLaidOut } from './capture';
import { ArrayBufferTarget, Muxer } from './vendor/mp4-muxer.js';

export interface LiveExportOptions {
  stream: MediaStream;
  player: Player;
  stage: HTMLElement;
  doc: VDocument;
  brand: BrandKit;
  fps: number;
  scale: number;
  includeAudio: boolean;
  onProgress?: (p: ExportProgress) => void;
  handle?: ExportHandle;
  onContainLayout?: () => Promise<void> | void;
}

export async function exportLiveMp4(opts: LiveExportOptions): Promise<Blob> {
  const { stream, player, stage, doc, brand, fps, scale, includeAudio } = opts;
  const total = player.total();
  if (total <= 0) throw new Error('文档时长为 0,请先添加场景');
  if (!webCodecsAvailable()) throw new Error('当前浏览器不支持 WebCodecs,请使用较新的 Chrome / Edge');

  const { w: W, h: H } = exportSize(ASPECT_PIXELS[doc.aspect], scale);
  const bitrate = autoBitrate(W, H, fps);
  const report = (p: ExportProgress) => opts.onProgress?.(p);

  const wasPlaying = player.isPlaying();
  const t0 = player.time();
  const wasLoop = player.loop();
  const wasSpeed = player.speed();
  player.pause();
  player.setLoop(false);
  player.setSpeed(1);

  let unsubCancel: (() => void) | undefined;
  let encoder: VideoEncoder | undefined;

  let encErr: DOMException | null = null;
  try {
    const throwIfBad = () => {
      if (opts.handle?.cancelled) throw new ExportCancelled();
      if (encErr) throw encErr;
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opts.handle) opts.handle.cancelled = true;
    };
    const onCancelEvent = () => {
      if (opts.handle) opts.handle.cancelled = true;
    };
    window.addEventListener('keydown', onEsc, true);
    window.addEventListener('vk-export-cancel', onCancelEvent);
    unsubCancel = () => {
      window.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('vk-export-cancel', onCancelEvent);
    };

    report({ phase: 'prepare', percent: 0, detail: '裁切舞台…' });
    await document.fonts.ready;
    throwIfBad();
    let track = await raceCancel(isolateStageTrack(stream, stage, 'element'), throwIfBad);
    throwIfBad();
    track.addEventListener('ended', () => {
      if (opts.handle) opts.handle.cancelled = true;
    });

    const codec = await raceCancel(pickVideoCodec(W, H, fps, bitrate), throwIfBad);
    if (!codec) throw new Error('该设备无法编码 H.264(尝试降低分辨率或帧率)');

    const mixBuffer = await raceCancel(mixDocumentAudio(player, doc, includeAudio, report), throwIfBad);

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      ...(mixBuffer
        ? { audio: { codec: 'aac' as const, numberOfChannels: Math.min(2, mixBuffer.numberOfChannels), sampleRate: mixBuffer.sampleRate } }
        : {}),
      fastStart: 'in-memory' as const,
      // 采集帧经 WebCodecs 出来时 DTS 常是文档时钟(非 0),必须平移
      firstTimestampBehavior: 'offset',
    });

    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          muxer.addVideoChunk(chunk, meta);
        } catch (e) {
          encErr = e instanceof DOMException ? e : new DOMException(e instanceof Error ? e.message : String(e));
        }
      },
      error: (e) => {
        encErr = e;
      },
    });
    encoder.configure({
      codec,
      width: W,
      height: H,
      bitrate,
      framerate: fps,
      latencyMode: 'realtime',
      bitrateMode: 'variable',
    });

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('无法创建导出画布');
    ctx.fillStyle = brand.palette.bg;
    ctx.imageSmoothingQuality = 'high';

    gsap.ticker.lagSmoothing(0);
    player.seek(0);
    await waitFrames(2);
    report({ phase: 'video', percent: 0, detail: '等待画面…' });

    let encoded = 0;
    let recOrigin = 0;
    const blitAndEncode = (src: CanvasImageSource, srcW: number, srcH: number, timestampUs: number) => {
      throwIfBad();
      ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = srcW > W || srcH > H;
      const box = containDest(srcW, srcH, W, H);
      ctx.drawImage(src, box.dx, box.dy, box.dw, box.dh);
      const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: Math.round(1e6 / fps) });
      encoder!.encode(frame, { keyFrame: encoded % (fps * 2) === 0 });
      frame.close();
      encoded++;
      const elapsed = recOrigin ? (performance.now() - recOrigin) / 1000 : 0;
      report({
        phase: 'video',
        percent: Math.min(1, elapsed / Math.max(total, 1e-6)),
        detail: `录制 ${elapsed.toFixed(1)}/${total.toFixed(1)}s`,
      });
    };

    const runEncode = (fallback: boolean) =>
      encodeFromTrack(track, {
        durationSec: total,
        fps,
        targetW: W,
        targetH: H,
        aspectWaitMs: fallback ? 8000 : 2500,
        onWarmupDone: () => {
          recOrigin = performance.now();
          report({ phase: 'video', percent: 0, detail: '开始录制…' });
          player.seek(0);
          player.play();
        },
        blitAndEncode,
        throwIfBad,
        afterFrame: async () => {
          if (encoder && encoder.encodeQueueSize > 8) {
            while (encoder.encodeQueueSize > 4) {
              throwIfBad();
              await new Promise((r) => setTimeout(r, 4));
            }
          }
        },
        onWaiting: (detail) => report({ phase: 'video', percent: 0, detail }),
      });

    try {
      await runEncode(false);
    } catch (e) {
      if (!(e instanceof NeedRegionCapture) || !opts.onContainLayout) throw e;
      report({ phase: 'video', percent: 0, detail: '改用窗口区域采集…' });
      await opts.onContainLayout();
      await waitStageLaidOut(stage, 800, () => !!opts.handle?.cancelled);
      throwIfBad();
      track = await raceCancel(isolateStageTrack(stream, stage, 'region'), throwIfBad);
      await runEncode(true);
    }

    player.pause();
    if (!encoder) throw new Error('编码器未初始化');
    await encoder.flush();
    encoder.close();
    encoder = undefined;

    if (mixBuffer) {
      report({ phase: 'finalize', percent: 0.5, detail: '编码音频…' });
      await encodeAac(mixBuffer, (chunk, meta) => muxer.addAudioChunk(chunk, meta));
    }

    report({ phase: 'finalize', percent: 0.9, detail: '封装 MP4…' });
    muxer.finalize();
    const buf = muxer.target.buffer;
    if (!buf) throw new Error('MP4 封装失败');
    if (encoded < 1) throw new Error('没有采集到画面,请确认已分享当前标签页且舞台可见');
    return new Blob([buf], { type: 'video/mp4' });
  } finally {
    unsubCancel?.();
    gsap.ticker.lagSmoothing(500, 33);
    try {
      encoder?.close();
    } catch {
      /* 已 close */
    }
    stopStream(stream);
    player.setSpeed(wasSpeed);
    player.setLoop(wasLoop);
    player.seek(t0);
    if (wasPlaying) player.play();
    else player.pause();
  }
}

interface EncodeLoop {
  onWarmupDone: () => void;
  durationSec: number;
  fps: number;
  targetW: number;
  targetH: number;
  aspectWaitMs: number;
  blitAndEncode: (src: CanvasImageSource, srcW: number, srcH: number, timestampUs: number) => void;
  throwIfBad: () => void;
  afterFrame?: () => Promise<void>;
  onWaiting?: (detail: string) => void;
}

class NeedRegionCapture extends Error {
  constructor() {
    super('NEED_REGION_CAPTURE');
  }
}

/** 让长时间 await 也能响应取消(每 40ms 轮询) */
async function raceCancel<T>(p: Promise<T>, throwIfBad: () => void): Promise<T> {
  let result: { ok: true; value: T } | { ok: false; error: unknown } | undefined;
  void p.then(
    (value) => {
      result = { ok: true, value };
    },
    (error) => {
      result = { ok: false, error };
    },
  );
  while (!result) {
    throwIfBad();
    await new Promise((r) => setTimeout(r, 40));
  }
  if (!result.ok) throw result.error;
  return result.value;
}

type TrackProcessorCtor = new (init: { track: MediaStreamTrack }) => {
  readable: ReadableStream<VideoFrame>;
};

/**
 * 不要把当前标签页的采集流接到页内 <video>:Chrome 会为防镜像把画面冻在第一帧。
 * 用 MediaStreamTrackProcessor 直接读 VideoFrame,时间戳走录制墙钟(单调递增)。
 */
async function encodeFromTrack(track: MediaStreamTrack, loop: EncodeLoop): Promise<void> {
  const Processor = (globalThis as typeof globalThis & { MediaStreamTrackProcessor?: TrackProcessorCtor })
    .MediaStreamTrackProcessor;
  if (typeof Processor !== 'function') {
    throw new Error('当前浏览器无法读取采集帧(需要 MediaStreamTrackProcessor,请使用较新的 Chrome / Edge)');
  }
  try {
    track.contentHint = 'motion';
  } catch {
    /* 旧内核 */
  }

  const reader = new Processor({ track }).readable.getReader();
  const minGapUs = Math.round((1e6 / loop.fps) * 0.85);
  let readP = reader.read();
  let recording = false;
  let recOrigin = 0;
  let lastTs = -1;
  let firstAt = 0;
  const waitStart = performance.now();

  try {
    loop.onWaiting?.('接通画面…');
    while (true) {
      loop.throwIfBad();
      if (recording && performance.now() - recOrigin >= loop.durationSec * 1000) break;
      if (!recording && performance.now() - waitStart > loop.aspectWaitMs) {
        throw loop.aspectWaitMs <= 3000
          ? new NeedRegionCapture()
          : new Error('采集没有画面。请确认分享的是「当前标签页」,不要选整个屏幕。');
      }

      const winner = await Promise.race([
        readP.then(
          (r) => ({ kind: 'frame' as const, r }),
          (e: unknown) => ({ kind: 'err' as const, e }),
        ),
        new Promise<{ kind: 'tick' }>((res) => setTimeout(() => res({ kind: 'tick' }), 40)),
      ]);
      if (winner.kind === 'tick') continue;
      if (winner.kind === 'err') {
        if (recording) break;
        throw winner.e;
      }

      readP = reader.read();
      if (winner.r.done) {
        if (recording) break;
        throw new Error('采集中断,请重新分享当前标签页后再导出');
      }

      const vf = winner.r.value;
      try {
        const srcW = vf.displayWidth || vf.codedWidth;
        const srcH = vf.displayHeight || vf.codedHeight;
        if (srcW < 2 || srcH < 2) continue;
        if (!aspectClose(srcW, srcH, loop.targetW, loop.targetH)) {
          if (!recording && performance.now() - waitStart > loop.aspectWaitMs) {
            throw new NeedRegionCapture();
          }
          continue;
        }

        if (!recording) {
          if (!firstAt) {
            firstAt = performance.now();
            loop.onWaiting?.('预热…');
          }
          if (performance.now() - firstAt < 280) continue;
          recording = true;
          recOrigin = performance.now();
          loop.onWarmupDone();
          continue;
        }

        const elapsedUs = Math.max(0, Math.round((performance.now() - recOrigin) * 1000));
        const ts = lastTs < 0 ? 0 : elapsedUs;
        if (lastTs >= 0 && ts - lastTs < minGapUs) continue;
        if (ts <= lastTs) continue;
        loop.blitAndEncode(vf, srcW, srcH, ts);
        lastTs = ts;
        await loop.afterFrame?.();
      } finally {
        vf.close();
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}