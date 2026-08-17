/**
 * 播放控制条(DESIGN.md 3.6):分段进度条、scrub、速度、循环。
 * 播放头经 subscribeTime 用 ref 直接写 DOM,不进 React state。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VDocument } from '../types';
import { useStore } from '../store';
import { getSceneDef } from '../scenes/registry';
import type { Player } from '../engine/timeline/player';
import { togglePresent } from './present';
import { AudioTracksPanel } from './AudioTracksPanel';

function fmt(t: number): string {
  const s = Math.floor(t);
  const cs = Math.floor((t - s) * 100);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function PlaybackBar({
  player,
  doc,
  overlay = false,
}: {
  player: Player | null;
  doc: VDocument;
  overlay?: boolean;
}) {
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const loop = useStore((s) => s.loop);
  const setPlaying = useStore((s) => s.setPlaying);
  const setSpeed = useStore((s) => s.setSpeed);
  const setLoop = useStore((s) => s.setLoop);

  const playheadRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [tracksOpen, setTracksOpen] = useState(false);
  const trackCount = doc.audioTracks?.length ?? 0;

  useEffect(() => {
    if (!player) return;
    const unsub = player.subscribeTime((t, total) => {
      if (playheadRef.current) playheadRef.current.style.width = total > 0 ? `${(t / total) * 100}%` : '0%';
      if (timeLabelRef.current) timeLabelRef.current.textContent = `${fmt(t)} / ${fmt(total)}`;
    });
    const unsubEnd = player.onEnd(() => setPlaying(false));
    return () => {
      unsub();
      unsubEnd();
    };
  }, [player, setPlaying]);

  useEffect(() => {
    player?.setSpeed(speed);
  }, [player, speed]);

  useEffect(() => {
    player?.setLoop(loop);
  }, [player, loop]);

  const segments = useMemo(() => {
    if (!player) return [];
    const starts = player.sceneStarts();
    const total = player.total();
    if (total <= 0 || starts.length === 0) return [];
    return doc.scenes.map((scene, i) => {
      const from = starts[i] ?? 0;
      const to = i + 1 < starts.length ? starts[i + 1] : total;
      return {
        label: getSceneDef(scene.sceneType)?.title ?? scene.sceneType,
        left: (from / total) * 100,
        width: Math.max(0, ((to - from) / total) * 100),
      };
    });
  }, [player, doc]);

  const scrubTo = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !player || player.total() <= 0) return;
    const rect = bar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    player.seek(frac * player.total());
  };

  const toggle = () => {
    if (!player) return;
    if (useStore.getState().isPlaying) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  return (
    <div className="pb-shell">
      {tracksOpen && !overlay && <AudioTracksPanel doc={doc} player={player} />}
      <div className={`playback-bar${overlay ? ' overlay' : ''}`}>
      <button className="pb-btn" onClick={toggle} title="播放/暂停 (Space)">
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <button
        className="pb-btn"
        title="重播 (R)"
        onClick={() => {
          player?.seek(0);
          player?.play();
          setPlaying(true);
        }}
      >
        ↺
      </button>
      <button
        className={`pb-btn ${tracksOpen ? 'pb-btn-active' : ''}`}
        title={tracksOpen ? '收起音轨面板' : '展开音轨面板(多音轨)'}
        onClick={() => setTracksOpen(!tracksOpen)}
      >
        ♪{trackCount > 0 ? trackCount : ''}
      </button>

      <div
        ref={barRef}
        className="pb-progress"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) scrubTo(e.clientX);
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`pb-seg ${i % 2 === 0 ? 'pb-seg-a' : 'pb-seg-b'}`}
            style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            title={seg.label}
          />
        ))}
        <div ref={playheadRef} className="pb-playhead" />
      </div>

      <span ref={timeLabelRef} className="pb-time">
        00:00.00 / 00:00.00
      </span>

      <select
        className="pb-speed"
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        title="播放速度"
      >
        {[0.5, 0.75, 1, 1.5, 2].map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>

      <button
        className={`pb-btn ${loop ? 'pb-btn-active' : ''}`}
        title="循环"
        onClick={() => setLoop(!loop)}
      >
        ⟳
      </button>
      <button className="pb-btn" title="全屏播放 (F)" onClick={() => togglePresent()}>
        ⛶
      </button>
      </div>
    </div>
  );
}
