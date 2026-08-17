/** 类型声明:vendored mp4-muxer(MIT, https://github.com/Vanilagy/mp4-muxer),仅声明导出器用到的接口 */
export interface Mp4MuxerTarget {
  buffer?: ArrayBuffer;
}

export declare class ArrayBufferTarget implements Mp4MuxerTarget {
  buffer: ArrayBuffer;
}

export interface Mp4MuxerOptions {
  target: Mp4MuxerTarget;
  video?: { codec: 'avc' | 'hevc' | 'vp9' | 'av1'; width: number; height: number; frameRate?: number };
  audio?: { codec: 'aac' | 'opus'; numberOfChannels: number; sampleRate: number };
  fastStart?: false | 'in-memory' | 'fragmented' | 'per-frame';
  /** 采集轨首包时间戳常不是 0;offset = 整轨平移使第一包为 0 */
  firstTimestampBehavior?: 'strict' | 'offset' | 'cross-track-offset';
}

export declare class Muxer {
  constructor(options: Mp4MuxerOptions);
  readonly target: Mp4MuxerTarget;
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void;
  finalize(): void;
}
