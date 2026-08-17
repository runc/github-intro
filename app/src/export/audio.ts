/**
 * 导出音频(参考 FableCut renderAudioMix 的离线混音思路,编码改为浏览器内 WebCodecs AAC):
 * 资产解码 → 按主时间线规划裁段 → OfflineAudioContext 一次性混成整条轨 → AudioEncoder 出 AAC chunk。
 */
import type { AssetRef } from '../types';
import { getAsset } from '../io/db';
import { planAudioSegment, type AudioSegment } from './plan';

export const EXPORT_SAMPLE_RATE = 48000;

export interface MixTrackSpec {
  asset: AssetRef;
  /** 主时间线触发时刻(秒) */
  start: number;
  /** 跳过音频开头(秒) */
  offset: number;
  /** 0–1 */
  volume: number;
  /** 片段时长上限(秒,右缘裁剪);缺省播到资产末尾 */
  end?: number;
}

/** 解码资产为 AudioBuffer;资产缺失/解码失败返回 null(不阻塞导出) */
export async function decodeAsset(ref: AssetRef): Promise<AudioBuffer | null> {
  const blob = await getAsset(ref.assetId);
  if (!blob) return null;
  const ctx = new OfflineAudioContext(2, 1, EXPORT_SAMPLE_RATE); // 仅借用 decodeAudioData
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    console.warn(`[export] 音频解码失败: ${ref.name ?? ref.assetId}`);
    return null;
  }
}

/** 全部段落混成一条与文档等长的立体声轨(单声道源由渲染目标自动上混) */
export async function renderMix(
  segments: { seg: AudioSegment; buffer: AudioBuffer }[],
  total: number,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * EXPORT_SAMPLE_RATE)), EXPORT_SAMPLE_RATE);
  for (const { seg, buffer } of segments) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = seg.volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(seg.start, seg.offset, seg.duration);
  }
  return ctx.startRendering();
}

export interface AacChunkHandler {
  (chunk: EncodedAudioChunk, meta: EncodedAudioChunkMetadata | undefined): void;
}

/** f32-planar 分块喂 AudioEncoder,产出 AAC chunk(时间戳 µs);编码器错误向前抛 */
export async function encodeAac(buffer: AudioBuffer, onChunk: AacChunkHandler): Promise<void> {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const config: AudioEncoderConfig = {
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels: channels,
    bitrate: 192_000,
  };
  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) throw new Error('该浏览器不支持 AAC 音频编码,已导出无声视频');

  let encErr: DOMException | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => onChunk(chunk, meta),
    error: (e) => {
      encErr = e;
    },
  });
  encoder.configure(config);

  const planes: Float32Array[] = [];
  for (let c = 0; c < channels; c++) planes.push(buffer.getChannelData(c));
  const blockFrames = Math.round(sampleRate / 10); // 100ms 一块
  for (let off = 0; off < buffer.length; off += blockFrames) {
    if (encErr) throw encErr;
    const n = Math.min(blockFrames, buffer.length - off);
    const data = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) data.set(planes[c].subarray(off, off + n), c * n);
    encoder.encode(
      new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: n,
        numberOfChannels: channels,
        timestamp: Math.round((off / sampleRate) * 1e6),
        data,
      }),
    );
    if (encoder.encodeQueueSize > 32) await new Promise((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();
  if (encErr) throw encErr;
}

/** 便捷:spec + total → 段落(供 UI 预告混音段数/编排器共用) */
export function planSegmentFor(spec: MixTrackSpec, assetDuration: number, total: number): AudioSegment | null {
  return planAudioSegment(
    { start: spec.start, offset: spec.offset, volume: spec.volume, assetDuration, end: spec.end },
    total,
  );
}
