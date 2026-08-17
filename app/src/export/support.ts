/**
 * 导出能力探测:WebCodecs 视频编码(H.264 候选梯子)与 AAC 音频编码。
 */

const AVC_CANDIDATES = [
  'avc1.640034', // High 5.2 · 4K60
  'avc1.640033', // High 5.1 · 4K30
  'avc1.64002A', // High 4.2 · 1080p60
  'avc1.640028', // High 4.0 · 1080p30
  'avc1.4D402A', // Main 4.2
  'avc1.4D0028', // Main 4.0
  'avc1.42E01E',
  'avc1.42001f',
];

export function webCodecsAvailable(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

/** 依序探测平台在该尺寸/帧率/码率下实际可用的 H.264 codec 串 */
export async function pickVideoCodec(w: number, h: number, fps: number, bitrate: number): Promise<string | null> {
  for (const codec of AVC_CANDIDATES) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width: w,
        height: h,
        bitrate,
        framerate: fps,
        latencyMode: 'quality',
        bitrateMode: 'variable',
      });
      if (res.supported) return codec;
    } catch {
      // 尝试下一个候选
    }
  }
  return null;
}

export async function aacEncodeSupported(sampleRate = 48000, channels = 2): Promise<boolean> {
  if (typeof window === 'undefined' || !('AudioEncoder' in window)) return false;
  try {
    const res = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels: channels,
      bitrate: 192_000,
    });
    return !!res.supported;
  } catch {
    return false;
  }
}
