/**
 * 导出编排器:motion-anything 式逐帧 WebCodecs 编码(H.264 + 编码器背压 + 偶数尺寸),
 * 帧内容 = DOM 舞台光栅化 + 确定性 ambient(先画 live canvas 再同步快照);
 * 音频 = FableCut 式离线混音,但直接 AAC 编码进同一 MP4(mp4-muxer),无需 ffmpeg。
 * 逐帧 seek 保证与预览逐像素一致(引擎本身确定性)。
 */
import type { BrandKit, VDocument } from '../types';
import { ASPECT_PIXELS, isLightPalette } from '../types';
import type { Player } from '../engine/timeline/player';
import { drawAmbient, resolveBgAt, type AmbientBgDraw } from '../engine/ambient/draw';
import { loadImageAsset } from '../io/assets';
import { autoBitrate, captureSize, exportSize, frameCount, type AudioSegment } from './plan';
import { aacEncodeSupported, pickVideoCodec, webCodecsAvailable } from './support';
import { prepareRaster, rasterizeStage } from './raster';
import { decodeAsset, encodeAac, renderMix, planSegmentFor, type MixTrackSpec } from './audio';
import { ArrayBufferTarget, Muxer } from './vendor/mp4-muxer.js';

export type ExportPhase = 'prepare' | 'audio' | 'video' | 'finalize';

export interface ExportProgress {
  phase: ExportPhase;
  /** 0–1 */
  percent: number;
  detail?: string;
}

export interface ExportHandle {
  cancelled: boolean;
}

export class ExportCancelled extends Error {
  constructor() {
    super('导出已取消');
  }
}

export interface ExportOptions {
  player: Player;
  /** #stage 元素(按目标像素布局) */
  stage: HTMLElement;
  doc: VDocument;
  brand: BrandKit;
  fps: number;
  /** 相对画幅像素的缩放,1 = 原生 */
  scale: number;
  includeAudio: boolean;
  onProgress?: (p: ExportProgress) => void;
  handle?: ExportHandle;
}

/** 收集文档音轨规格:场景 SFX(起点 = 组装器 label)+ 文档多音轨(静音轨不参与混音) */
export function collectTrackSpecs(player: Player, doc: VDocument): MixTrackSpec[] {
  const starts = player.sceneStarts();
  const specs: MixTrackSpec[] = [];
  doc.scenes.forEach((scene, i) => {
    const start = starts[i];
    if (scene.sfx && start !== undefined) {
      specs.push({ asset: scene.sfx.asset, start, offset: scene.sfx.offset, volume: scene.sfx.volume });
    }
  });
  for (const t of doc.audioTracks ?? []) {
    if (t.muted) continue;
    specs.push({
      asset: t.asset,
      start: Math.max(0, t.start),
      offset: Math.max(0, t.offset),
      volume: t.volume,
      end: t.duration,
    });
  }
  return specs;
}

export async function mixDocumentAudio(
  player: Player,
  doc: VDocument,
  includeAudio: boolean,
  onProgress?: (p: ExportProgress) => void,
): Promise<AudioBuffer | null> {
  const total = player.total();
  const specs = collectTrackSpecs(player, doc);
  if (!includeAudio || specs.length === 0 || !(await aacEncodeSupported())) return null;
  onProgress?.({ phase: 'audio', percent: 0, detail: '解码音效…' });
  const segments: { seg: AudioSegment; buffer: AudioBuffer }[] = [];
  for (const spec of specs) {
    const buffer = await decodeAsset(spec.asset);
    if (!buffer) continue;
    const seg = planSegmentFor(spec, buffer.duration, total);
    if (seg) segments.push({ seg, buffer });
  }
  if (segments.length === 0) return null;
  onProgress?.({ phase: 'audio', percent: 0.6, detail: '离线混音…' });
  return renderMix(segments, total);
}

export async function exportMp4(opts: ExportOptions): Promise<Blob> {
  const { player, stage, doc, brand, fps, scale, includeAudio } = opts;
  const total = player.total();
  if (total <= 0) throw new Error('文档时长为 0,请先添加场景');
  if (!webCodecsAvailable()) throw new Error('当前浏览器不支持 WebCodecs,请使用较新的 Chrome / Edge');

  const native = ASPECT_PIXELS[doc.aspect];
  const { w: W, h: H } = exportSize(native, scale);
  const cap = captureSize(native, scale);
  const bitrate = autoBitrate(W, H, fps);
  const report = (p: ExportProgress) => opts.onProgress?.(p);

  // 播放状态快照:导出期间独占 Player,结束恢复
  const wasPlaying = player.isPlaying();
  const t0 = player.time();
  const wasLoop = player.loop();
  player.pause();
  player.setLoop(false);

  try {
    report({ phase: 'prepare', percent: 0 });
    await document.fonts.ready;
    const codec = await pickVideoCodec(W, H, fps, bitrate);
    if (!codec) throw new Error('该设备无法编码 H.264(尝试降低分辨率或帧率)');

    const mixBuffer = await mixDocumentAudio(player, doc, includeAudio, report);

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      ...(mixBuffer
        ? { audio: { codec: 'aac' as const, numberOfChannels: Math.min(2, mixBuffer.numberOfChannels), sampleRate: mixBuffer.sampleRate } }
        : {}),
      fastStart: 'in-memory' as const,
    });

    let encErr: DOMException | null = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
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
      latencyMode: 'quality',
      bitrateMode: 'variable',
    });

    // ambient:画在 live canvas 上(rAF 的预览时钟会被覆盖,同步快照后即与预览无关)
    const ambCanvas = stage.querySelector('canvas');
    const ambCtx = ambCanvas?.getContext('2d') ?? null;
    // 背景图位图:与预览层共用解码缓存,画进 canvas 后随快照内联;
    // 场景级覆盖与全局背景都预解码,逐帧按 resolveBgAt 取生效配置(场景覆盖 > 全局)
    const sceneBgs = doc.scenes.map((s) => s.bgImage);
    const bgImgs = new Map<string, CanvasImageSource>();
    for (const cfg of [doc.ambient.bgImage, ...sceneBgs]) {
      if (!cfg || bgImgs.has(cfg.asset.assetId)) continue;
      const img = await loadImageAsset(cfg.asset);
      if (img) bgImgs.set(cfg.asset.assetId, img);
    }
    const sceneStarts = player.sceneStarts();
    const rc = await prepareRaster(stage);

    // 氛围层按捕获分辨率重绘,随 CSS scale 1:1 进 SVG,避免 1× PNG 被放大
    const hiAmb = document.createElement('canvas');
    hiAmb.width = cap.w;
    hiAmb.height = cap.h;
    const hiAmbCtx = hiAmb.getContext('2d');

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('无法创建导出画布');
    ctx.fillStyle = brand.palette.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';

    const colors = {
      accent: brand.palette.accent,
      accent2: brand.palette.accent2,
      head: isLightPalette(brand.palette) ? '#1f2328' : '#ebf5ee',
      paper: brand.palette.bg,
    };
    const frames = frameCount(total, fps);
    const frameDurUs = Math.round(1e6 / fps);

    const rasterAt = async (t: number, nonce?: string) => {
      player.seek(t);
      const bgCfg = resolveBgAt(t, doc.ambient.bgImage, sceneBgs, sceneStarts);
      const bgImg = bgCfg ? bgImgs.get(bgCfg.asset.assetId) : undefined;
      const bg: AmbientBgDraw | undefined = bgImg && bgCfg ? { img: bgImg, cfg: bgCfg } : undefined;
      const ambDraw = {
        particles: doc.ambient.particles,
        grid: doc.ambient.grid,
        fx: doc.ambient.fx,
        fxIntensity: doc.ambient.fxIntensity,
        fxChars: doc.ambient.fxChars,
      };
      if (ambCtx && ambCanvas) {
        drawAmbient(ambCtx, t, ambDraw, doc.seed, colors, { w: ambCanvas.width, h: ambCanvas.height }, bg);
      }
      let canvasSnaps: string[] | undefined;
      if (hiAmbCtx && ambCanvas && cap.cssScale !== 1) {
        const bgHi =
          bg && bg.cfg.blur > 0 ? { img: bg.img, cfg: { ...bg.cfg, blur: bg.cfg.blur * cap.cssScale } } : bg;
        drawAmbient(hiAmbCtx, t, ambDraw, doc.seed, colors, { w: cap.w, h: cap.h }, bgHi);
        canvasSnaps = [hiAmb.toDataURL('image/png')];
      }
      return rasterizeStage(stage, rc, native.w, native.h, cap.cssScale, canvasSnaps, nonce);
    };

    // Chromium foreignObject 首张常按 300×150 横屏占位盒布局,竖屏导出开头会闪一帧横构图。
    // 先 seek + 等两帧绘制,再丢弃一次栅格化(nonce 避免与第 0 帧 data URL 缓存撞车)。
    player.seek(0);
    void stage.offsetWidth;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (opts.handle?.cancelled) throw new ExportCancelled();
    report({ phase: 'video', percent: 0, detail: '预热栅格化…' });
    await rasterAt(0, 'warm');

    for (let i = 0; i < frames; i++) {
      if (opts.handle?.cancelled) throw new ExportCancelled();
      if (encErr) throw encErr;

      const t = Math.min(i / fps, total);
      const raster = await rasterAt(t, String(i));
      ctx.imageSmoothingEnabled = raster.width !== W || raster.height !== H;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(raster, 0, 0, W, H);

      const frame = new VideoFrame(canvas, { timestamp: i * frameDurUs, duration: frameDurUs });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      report({ phase: 'video', percent: i / frames, detail: `第 ${i + 1}/${frames} 帧` });
      // 编码器背压:队列过长时等待,避免长导出撑爆内存(motion-anything 同款策略)
      if (encoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 0));
        while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
      }
    }

    await encoder.flush();
    encoder.close();

    if (mixBuffer) {
      report({ phase: 'finalize', percent: 0.5, detail: '编码音频…' });
      await encodeAac(mixBuffer, (chunk, meta) => muxer.addAudioChunk(chunk, meta));
    }

    report({ phase: 'finalize', percent: 0.9, detail: '封装 MP4…' });
    muxer.finalize();
    const buf = muxer.target.buffer;
    if (!buf) throw new Error('MP4 封装失败');
    return new Blob([buf], { type: 'video/mp4' });
  } finally {
    player.seek(t0);
    player.setLoop(wasLoop);
    if (wasPlaying) player.play();
  }
}
