/**
 * 导出纯函数规划(参考 motion-anything export.js / FableCut renderAudioMix):
 * 帧表、导出尺寸(H.264 偶数)、码率启发、音频段裁剪 —— 全部无副作用,可单测。
 */

/** 栅格超采样倍数:foreignObject 1× 文字发糊,2× 再高质量缩小更锐 */
export const CAPTURE_OVERSAMPLE = 2;

/** 导出尺寸:按画幅与缩放取整到偶数(H.264 yuv420 要求) */
export function exportSize(px: { w: number; h: number }, scale: number): { w: number; h: number } {
  const even = (n: number) => {
    const v = Math.max(2, Math.round(n * scale));
    return v % 2 === 0 ? v : v + 1;
  };
  return { w: even(px.w), h: even(px.h) };
}

/**
 * 栅格化尺寸:相对导出分辨率 2× 超采样,但不超过 2× 设计稿(1080p 设计稿 → 最高 4K),
 * 避免 4K 导出再 2× 变成 8K。cssScale = 捕获宽 / 设计稿宽,交给 SVG 变换。
 */
export function captureSize(
  px: { w: number; h: number },
  scale: number,
): { w: number; h: number; cssScale: number } {
  const oversampled = exportSize(px, scale * CAPTURE_OVERSAMPLE);
  const cap = exportSize(px, CAPTURE_OVERSAMPLE);
  const w = Math.min(oversampled.w, cap.w);
  const h = Math.min(oversampled.h, cap.h);
  return { w, h, cssScale: w / px.w };
}

/**
 * 码率启发:片头/字幕是高对比文字,比实拍更吃码率。
 * W*H*fps*0.32,钳制 4–50 Mbps(1080p30 ≈ 19.9 Mbps)。
 */
export function autoBitrate(w: number, h: number, fps: number): number {
  return Math.min(50e6, Math.max(4e6, Math.round(w * h * fps * 0.32)));
}

/** 帧数:时长 × fps 四舍五入,至少 1 帧 */
export function frameCount(total: number, fps: number): number {
  return Math.max(1, Math.round(total * fps));
}

export interface AudioSegmentSpec {
  /** 主时间线上的触发时刻(秒) */
  start: number;
  /** 跳过音频开头(秒) */
  offset: number;
  /** 0–1 */
  volume: number;
  /** 音频资产时长(秒) */
  assetDuration: number;
  /** 片段时长上限(秒,右缘裁剪);缺省播到资产末尾 */
  end?: number;
}

/** 混音段:裁剪到文档时长内,越界/无内容返回 null */
export interface AudioSegment {
  start: number;
  offset: number;
  duration: number;
  volume: number;
}

export function planAudioSegment(spec: AudioSegmentSpec, total: number): AudioSegment | null {
  const volume = Math.max(0, Math.min(1, spec.volume));
  const offset = Math.max(0, spec.offset);
  const playable = spec.assetDuration - offset;
  const cap = spec.end !== undefined ? Math.min(playable, spec.end) : playable;
  if (spec.start >= total || cap <= 0 || volume <= 0) return null;
  const duration = Math.min(cap, total - spec.start);
  if (duration <= 0) return null;
  return { start: spec.start, offset, duration, volume };
}
