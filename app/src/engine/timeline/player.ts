/**
 * 播放控制器(DESIGN.md 4.5)
 * 包装主时间线:play/pause/seek/setSpeed/loop。
 * 播放头时刻不进 React state,进度条组件经 subscribeTime 用 ref 直接写 DOM。
 */
import gsap from 'gsap';

export type TimeListener = (t: number, total: number) => void;

/** 播放器驱动的音轨:el 由调用方创建(URL/音量已配好),start/offset 对齐主时间线 */
export interface PlayerAudioTrack {
  el: HTMLAudioElement;
  /** 主时间线上的触发时刻(秒) */
  start: number;
  /** 跳过音频开头(秒) */
  offset: number;
  /** 片段时长上限(秒,右缘裁剪);缺省播到资产末尾 */
  end?: number;
}

export interface AudioTrackSpec {
  start: number;
  offset: number;
  duration: number;
}

export interface AudioTrackState {
  on: boolean;
  /** 音频内应处的位置(秒) */
  at: number;
  /** off 时是否应重置回起点(回到触发点之前/循环回绕时) */
  reset: boolean;
}

/**
 * 纯函数规划器:播放头 t(含播放态)决定音轨应处的状态。
 * 播放中 t∈[start, start+dur) → 播放且音频内位置 = offset + (t - start);
 * 未播放或未到触发点 → 重置待播;已越过 → 停在末尾(循环回绕时经 reset 分支归零)。
 */
export function audioTrackState(t: number, playing: boolean, spec: AudioTrackSpec): AudioTrackState {
  const dur = Math.max(0, spec.duration - spec.offset);
  const end = spec.start + dur;
  if (!playing || t < spec.start) return { on: false, at: 0, reset: true };
  if (t >= end) return { on: false, at: spec.offset + dur, reset: false };
  return { on: true, at: spec.offset + (t - spec.start), reset: false };
}

/** 音频对主时间线的再同步阈值:超过视为 seek/回绕,硬对齐 */
const AUDIO_DRIFT = 0.35;

export class Player {
  private master: gsap.core.Timeline;
  private _total: number;
  private subs = new Set<TimeListener>();
  private lastT = -1;
  private endCbs = new Set<() => void>();
  private audio: PlayerAudioTrack[] = [];
  private tickerFn = () => {
    // 合同保险:若场景 tween 意外越过总时长,在 total 处钳停(时长由 marks 静态计算)
    if (this._total > 0 && !this.master.paused() && this.master.time() > this._total + 1e-6) {
      this.master.pause();
      this.master.time(this._total, false);
      for (const cb of this.endCbs) cb();
    }
    this.applyAudio();
    this.emit();
  };

  constructor(master: gsap.core.Timeline, total: number) {
    this.master = master;
    this._total = total;
    gsap.ticker.add(this.tickerFn);
    master.eventCallback('onComplete', () => {
      for (const cb of this.endCbs) cb();
    });
  }

  play(): void {
    if (this._total > 0 && this.master.time() >= this._total - 1e-6) {
      this.master.time(0, false);
    }
    this.master.play();
    this.emit(true);
  }

  pause(): void {
    this.master.pause();
    this.emit(true);
  }

  seek(t: number): void {
    this.master.time(Math.max(0, Math.min(t, this._total)), false);
    this.emit(true);
  }

  time(): number {
    return this.master.time();
  }

  total(): number {
    return this._total;
  }

  isPlaying(): boolean {
    return !this.master.paused() && this.master.isActive();
  }

  setSpeed(scale: number): void {
    this.master.timeScale(scale);
    for (const tr of this.audio) tr.el.playbackRate = scale;
  }

  /** 挂载场景音轨;每 tick 将音频驱动到规划器的目标状态(覆盖 play/pause/seek/loop) */
  setAudioTracks(tracks: PlayerAudioTrack[]): void {
    for (const tr of this.audio) tr.el.pause();
    this.audio = tracks;
  }

  private applyAudio(): void {
    if (this.audio.length === 0) return;
    const t = this.master.time();
    const playing = this.isPlaying();
    for (const tr of this.audio) {
      const dur = tr.el.duration;
      if (!isFinite(dur)) continue; // 元数据未就绪,就绪后下一 tick 自然对齐
      // 右缘裁剪:窗口截止 min(资产末尾, offset + 片段时长)
      const windowDur = tr.end !== undefined ? Math.min(dur, tr.offset + tr.end) : dur;
      const st = audioTrackState(t, playing, { start: tr.start, offset: tr.offset, duration: windowDur });
      if (!st.on) {
        if (!tr.el.paused) tr.el.pause();
        if (st.reset && tr.el.currentTime !== 0) tr.el.currentTime = 0;
      } else {
        const drift = Math.abs(tr.el.currentTime - st.at);
        if (tr.el.paused || drift > AUDIO_DRIFT) {
          if (drift > 0.02) tr.el.currentTime = st.at;
          if (tr.el.paused) void tr.el.play().catch(() => {});
        }
      }
    }
  }

  setLoop(loop: boolean): void {
    this.master.repeat(loop ? -1 : 0);
  }

  /** 当前是否循环播放(供导出等流程快照/恢复播放状态) */
  loop(): boolean {
    return this.master.repeat() === -1;
  }

  subscribeTime(cb: TimeListener): () => void {
    this.subs.add(cb);
    cb(this.time(), this._total);
    return () => this.subs.delete(cb);
  }

  onEnd(cb: () => void): () => void {
    this.endCbs.add(cb);
    return () => this.endCbs.delete(cb);
  }

  /** 跳到第 i 个场景起点(label 由组装器打点) */
  seekScene(i: number): boolean {
    const label = `scene:${i}`;
    if (this.master.labels[label] === undefined) return false;
    this.master.seek(label, false);
    this.emit(true);
    return true;
  }

  sceneStarts(): number[] {
    const out: number[] = [];
    for (let i = 0; ; i++) {
      const t = this.master.labels[`scene:${i}`];
      if (t === undefined) break;
      out.push(t);
    }
    return out;
  }

  stepFrames(n: number): void {
    this.seek(this.time() + n / 60);
  }

  stepSeconds(n: number): void {
    this.seek(this.time() + n);
  }

  private emit(force = false): void {
    const t = this.master.time();
    if (!force && Math.abs(t - this.lastT) < 1e-4) return;
    this.lastT = t;
    for (const cb of this.subs) cb(t, this._total);
  }

  destroy(): void {
    gsap.ticker.remove(this.tickerFn);
    for (const tr of this.audio) tr.el.pause();
    this.audio = [];
    this.subs.clear();
    this.endCbs.clear();
    this.master.eventCallback('onComplete', null);
    this.master.kill();
  }
}
