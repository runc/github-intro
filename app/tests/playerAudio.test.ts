import { describe, expect, it } from 'vitest';
import { audioTrackState } from '../src/engine/timeline/player';

/** 音轨:start=2, offset=0.5, 音频全长 4s → 可播窗口 [2, 2+3.5) */
const spec = { start: 2, offset: 0.5, duration: 4 };

describe('audioTrackState 音轨规划器', () => {
  it('未播放时重置待播', () => {
    expect(audioTrackState(3, false, spec)).toEqual({ on: false, at: 0, reset: true });
  });

  it('触发点之前重置待播', () => {
    expect(audioTrackState(0, true, spec)).toEqual({ on: false, at: 0, reset: true });
    expect(audioTrackState(1.999, true, spec)).toEqual({ on: false, at: 0, reset: true });
  });

  it('窗口内播放,音频内位置 = offset + (t - start)', () => {
    expect(audioTrackState(2, true, spec)).toEqual({ on: true, at: 0.5, reset: false });
    expect(audioTrackState(3.25, true, spec)).toEqual({ on: true, at: 1.75, reset: false });
    expect(audioTrackState(5.49, true, spec)).toEqual({ on: true, at: 3.99, reset: false });
  });

  it('越过窗口末尾后停止(停在末尾,不重置)', () => {
    expect(audioTrackState(5.5, true, spec)).toEqual({ on: false, at: 4, reset: false });
    expect(audioTrackState(9, true, spec)).toEqual({ on: false, at: 4, reset: false });
  });

  it('循环回绕(t 跳回触发点前)重新进入重置分支', () => {
    const afterEnd = audioTrackState(6, true, spec);
    expect(afterEnd.reset).toBe(false);
    const wrapped = audioTrackState(0.1, true, spec);
    expect(wrapped).toEqual({ on: false, at: 0, reset: true });
  });

  it('offset 大于音频时长时窗口为空,始终停播', () => {
    expect(audioTrackState(2, true, { start: 2, offset: 5, duration: 4 })).toEqual({ on: false, at: 5, reset: false });
  });
});
