/**
 * 音轨面板(播放条上方,可收缩):剪映式时间轴交互。
 * 标尺 + 播放头(可点按 scrub)+ 只读画面轨(场景段,点击跳转)+ 多音轨泳道:
 * 音轨块可拖动移动、拖左缘修偏移(入点)、拖右缘修时长(出点),支持吸附播放头/场景边界,
 * 缩放按钮 −/＋/Fit,播放中播放头出界自动跟随滚动。
 * 编辑为播放层配置(StageHost 按签名 effect 重挂音轨),不触发时间线重建。
 */
import { useEffect, useRef, useState } from 'react';
import type { AssetRef, AudioTrack, VDocument } from '../types';
import { makeAudioTrack } from '../types';
import { useStore } from '../store';
import { saveAssetFile, getAssetURL } from '../io/assets';
import { AssetPicker } from './AssetPicker';
import { getSceneDef } from '../scenes/registry';
import type { Player } from '../engine/timeline/player';

const LANE_COLORS = ['#3fb950', '#58a6ff', '#f0883e', '#a371f7', '#d4b06a', '#56d4dd'];
const MIN_CLIP = 0.1;
const SNAP_S = 0.12;
const RULER_H = 26;
const LANE_H = 36;
const V_LANE_H = 32;
/** 时长未知(元数据未就绪)时的视觉兜底块长 */
const UNKNOWN_DUR = 10;

/** 资产时长缓存:元数据探针一次,面板常驻 */
const durCache = new Map<string, number>();

function probeDuration(asset: AssetRef): Promise<number> {
  const hit = durCache.get(asset.assetId);
  if (hit !== undefined) return Promise.resolve(hit);
  return getAssetURL(asset).then(
    (url) =>
      new Promise<number>((resolve) => {
        if (!url) return resolve(NaN);
        const el = new Audio(url);
        const fail = () => resolve(NaN);
        const timer = window.setTimeout(fail, 4000);
        el.onloadedmetadata = () => {
          window.clearTimeout(timer);
          resolve(isFinite(el.duration) ? el.duration : NaN);
        };
        el.onerror = fail;
      }),
  );
}

function fmtT(t: number): string {
  if (t >= 60) return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  return t < 1 ? `${t}s` : Number.isInteger(t) ? `${t}s` : `${t.toFixed(1)}s`;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** 片段可视/有效时长(含右缘裁剪) */
function clipDur(t: AudioTrack, assetDur: number | undefined): number {
  const avail = assetDur !== undefined ? Math.max(MIN_CLIP, assetDur - t.offset) : UNKNOWN_DUR;
  return t.duration !== undefined ? Math.max(MIN_CLIP, Math.min(t.duration, avail)) : avail;
}

interface DragState {
  id: string;
  mode: 'move' | 'trimL' | 'trimR';
  x0: number;
  start0: number;
  offset0: number;
  dur0: number;
  /** 拖动中实时预览值 */
  start: number;
  offset: number;
  duration?: number;
}

export function AudioTracksPanel({ doc, player }: { doc: VDocument; player: Player | null }) {
  const addAudioTrack = useStore((s) => s.addAudioTrack);
  const updateAudioTrack = useStore((s) => s.updateAudioTrack);
  const removeAudioTrack = useStore((s) => s.removeAudioTrack);

  const [picking, setPicking] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [availW, setAvailW] = useState(0);
  const [durs, setDurs] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<DragState | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const ppsRef = useRef(0);
  const availWRef = useRef(0);

  const tracks = doc.audioTracks ?? [];
  const total = player?.total() ?? 0;

  // 容器宽度测量:Fit 缩放基数
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      availWRef.current = w;
      setAvailW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 资产时长探针:缺失即补,全部就绪后重渲染
  useEffect(() => {
    const ids = new Set(tracks.map((t) => t.asset.assetId).filter((id) => !(id in durs) && !durCache.has(id)));
    if (ids.size === 0) return;
    let alive = true;
    for (const t of tracks) {
      if (!ids.has(t.asset.assetId)) continue;
      void probeDuration(t.asset).then((d) => {
        if (!alive) return;
        if (isFinite(d)) durCache.set(t.asset.assetId, d);
        setDurs((prev) => ({ ...prev, [t.asset.assetId]: d }));
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => t.asset.assetId).join(',')]);

  const pps = total > 0 && availW > 0 ? (availW / total) * zoom : 0;
  ppsRef.current = pps;
  const contentW = Math.max(availW, total * pps);

  // 播放头:订阅主时间线直写 DOM;播放中出界自动跟随
  useEffect(() => {
    if (!player) return;
    const unsub = player.subscribeTime((t) => {
      const x = t * ppsRef.current;
      if (playheadRef.current) playheadRef.current.style.left = `${x}px`;
      const sc = scrollRef.current;
      if (sc && player.isPlaying()) {
        const right = sc.scrollLeft + availWRef.current * 0.88;
        if (x > right) sc.scrollLeft = x - availWRef.current * 0.4;
        if (x < sc.scrollLeft) sc.scrollLeft = Math.max(0, x - 8);
      }
    });
    return unsub;
  }, [player]);

  const starts = player?.sceneStarts() ?? [];

  // ---- 吸附 ----
  const snapTo = (v: number): number => {
    if (!snap || !player) return v;
    const cands = [0, total, player.time(), ...starts];
    let best = v;
    let bestD = SNAP_S;
    for (const c of cands) {
      const d = Math.abs(c - v);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  // ---- 块拖拽 ----
  const beginDrag = (t: AudioTrack, mode: DragState['mode']) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const dur = clipDur(t, durCache.get(t.asset.assetId));
    setSelectedId(t.id);
    setDrag({ id: t.id, mode, x0: e.clientX, start0: t.start, offset0: t.offset, dur0: dur, start: t.start, offset: t.offset, duration: t.duration });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag || pps <= 0) return;
    const dt = (e.clientX - drag.x0) / pps;
    const assetDur = durCache.get(tracks.find((t) => t.id === drag.id)?.asset.assetId ?? '');
    if (drag.mode === 'move') {
      const start = Math.max(0, Math.min(drag.start0 + dt, total - drag.dur0));
      setDrag({ ...drag, start: round1(snapTo(start)) });
    } else if (drag.mode === 'trimL') {
      const maxOff = assetDur !== undefined ? assetDur - MIN_CLIP : drag.offset0 + drag.dur0 - MIN_CLIP;
      const offset = Math.max(0, Math.min(drag.offset0 + dt, maxOff));
      const start = Math.max(0, drag.start0 + (offset - drag.offset0));
      setDrag({ ...drag, offset: round1(offset), start: round1(snapTo(start)) });
    } else {
      const maxDur = assetDur !== undefined ? assetDur - drag.offset0 : drag.dur0 + 30;
      const duration = Math.max(MIN_CLIP, Math.min(drag.dur0 + dt, maxDur));
      setDrag({ ...drag, duration: round1(duration) });
    }
  };

  const endDrag = () => {
    if (!drag) return;
    const patch: Partial<Omit<AudioTrack, 'id'>> = {};
    if (drag.mode === 'move' || drag.mode === 'trimL') {
      patch.start = drag.start;
      patch.offset = drag.offset;
    } else {
      patch.duration = drag.duration;
    }
    setDrag(null);
    updateAudioTrack(drag.id, patch);
  };

  // ---- 标尺 scrub ----
  const scrub = (e: React.PointerEvent) => {
    if (!player || pps <= 0 || drag) return; // 块拖拽期间不抢 scrub
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = Math.max(0, Math.min(total, (e.clientX - rect.left) / pps));
    player.seek(t);
  };

  // ---- 添加 ----
  const addAsset = (asset: AssetRef) => {
    const t = player?.time() ?? 0;
    addAudioTrack(
      makeAudioTrack(asset, { start: round1(Math.max(0, t)), name: asset.name ?? `音轨 ${tracks.length + 1}` }),
    );
  };

  const selected = tracks.find((t) => t.id === selectedId) ?? null;

  const blockFor = (t: AudioTrack) => {
    // 拖拽中的块用预览值
    if (drag && drag.id === t.id) return { start: drag.start, dur: drag.mode === 'trimR' ? drag.duration ?? drag.dur0 : drag.dur0 };
    return { start: t.start, dur: clipDur(t, durCache.get(t.asset.assetId)) };
  };

  return (
    <div className="pb-tracks">
      <div className="pb-tracks-head">
        <span className="pb-tracks-title">音轨{tracks.length > 0 ? ` (${tracks.length})` : ''}</span>
        <label className="mini-btn file-btn">
          ＋ 上传音频
          <input
            type="file"
            accept="audio/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) addAsset(await saveAssetFile(f));
              e.target.value = '';
            }}
          />
        </label>
        <button className="mini-btn" title="从素材库选择已有音频" onClick={() => setPicking(true)}>
          从素材库选
        </button>
        <span className="pb-tl-flex" />
        <button className={`mini-btn toggle ${snap ? 'on' : ''}`} title="吸附播放头与场景边界 (剪映式对齐)" onClick={() => setSnap(!snap)}>
          吸附
        </button>
        <span className="pb-tl-zoom">
          <button className="mini-btn" title="缩小时间轴" onClick={() => setZoom((z) => Math.max(0.25, z / 1.5))}>
            −
          </button>
          <span className="pb-tl-zoom-label" title="当前缩放">
            {Math.round(zoom * 100)}%
          </span>
          <button className="mini-btn" title="放大时间轴" onClick={() => setZoom((z) => Math.min(8, z * 1.5))}>
            ＋
          </button>
          <button
            className={`mini-btn ${zoom === 1 ? 'on' : ''}`}
            title="缩放至适配整条时间轴"
            onClick={() => {
              setZoom(1);
              if (scrollRef.current) scrollRef.current.scrollLeft = 0;
            }}
          >
            Fit
          </button>
        </span>
      </div>

      <div className="pb-tl">
        <div className="pb-tl-gutter">
          <div className="pb-tl-gutter-top" />
          <div className="pb-tl-lane-label pb-tl-lane-v">画面</div>
          {tracks.map((t, i) => (
            <div key={t.id} className="pb-tl-lane-label" title={t.name}>
              <span className="pb-tl-lane-idx">{i === 0 ? 'BGM' : i + 1}</span>
              <button
                className={`pb-tl-lane-btn ${t.muted ? 'danger' : ''}`}
                title={t.muted ? '取消静音' : '静音'}
                onClick={() => updateAudioTrack(t.id, { muted: !t.muted })}
              >
                {t.muted ? '🔇' : '🔊'}
              </button>
              <button className="pb-tl-lane-btn danger" title="移除音轨" onClick={() => removeAudioTrack(t.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="pb-tl-scroll" ref={scrollRef}>
          <div className="pb-tl-content" style={{ width: contentW }} onPointerDown={scrub} onPointerMove={(e) => e.buttons === 1 && scrub(e)}>
            {/* 标尺 */}
            <div className="pb-tl-ruler" style={{ height: RULER_H }}>
              {total > 0 &&
                (() => {
                  const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
                  const step = STEPS.find((s) => s * pps >= 72) ?? 300;
                  const ticks: number[] = [];
                  for (let t = 0; t <= total + 1e-9; t += step) ticks.push(t);
                  const minor = step / 4;
                  const minorTicks: number[] = [];
                  if (minor * pps >= 12) for (let t = minor; t <= total + 1e-9; t += minor) if (Math.abs(t / step - Math.round(t / step)) > 1e-6) minorTicks.push(t);
                  return (
                    <>
                      {minorTicks.map((t) => (
                        <i key={`m${t}`} className="pb-tl-tick minor" style={{ left: t * pps }} />
                      ))}
                      {ticks.map((t) => (
                        <span key={t} className="pb-tl-tick" style={{ left: t * pps }}>
                          <i />
                          {fmtT(round1(t))}
                        </span>
                      ))}
                    </>
                  );
                })()}
            </div>

            {/* 画面轨(只读,点击跳转场景) */}
            <div className="pb-tl-vlane" style={{ height: V_LANE_H }}>
              {starts.map((s, i) => {
                const end = starts[i + 1] ?? total;
                const label = getSceneDef(doc.scenes[i]?.sceneType)?.title ?? doc.scenes[i]?.sceneType ?? '';
                return (
                  <div
                    key={i}
                    className="pb-tl-vblock"
                    style={{ left: s * pps, width: Math.max(2, (end - s) * pps) }}
                    title={`${label} · 点击跳转`}
                    onClick={(e) => {
                      e.stopPropagation();
                      player?.seekScene(i);
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* 音轨泳道 */}
            {tracks.map((t, i) => {
              const b = blockFor(t);
              const dur = durCache.get(t.asset.assetId);
              const shownDur = drag?.id === t.id && drag.mode === 'trimR' ? drag.duration ?? b.dur : t.duration;
              const color = LANE_COLORS[i % LANE_COLORS.length];
              const sel = selectedId === t.id;
              return (
                <div key={t.id} className="pb-tl-lane" style={{ height: LANE_H }}>
                  <div
                    className={`pb-tl-block ${sel ? 'sel' : ''} ${t.muted ? 'muted' : ''}`}
                    style={{
                      left: b.start * pps,
                      width: Math.max(8, b.dur * pps),
                      background: `linear-gradient(180deg, color-mix(in srgb, ${color} 78%, #fff) 0%, ${color} 100%)`,
                    }}
                    title={`${t.name}\n触发 ${round1(t.start)}s · 偏移 ${round1(t.offset)}s · 时长 ${dur !== undefined && t.duration === undefined ? `${round1(dur - t.offset)}s` : `${round1(shownDur ?? b.dur)}s`}`}
                    onPointerDown={beginDrag(t, 'move')}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <i className="pb-tl-edge l" onPointerDown={beginDrag(t, 'trimL')} onPointerMove={moveDrag} onPointerUp={endDrag} />
                    <i className="pb-tl-edge r" onPointerDown={beginDrag(t, 'trimR')} onPointerMove={moveDrag} onPointerUp={endDrag} />
                    <span className="pb-tl-block-name">{t.name}</span>
                    {b.dur * pps > 140 && (
                      <span className="pb-tl-block-dur">
                        {dur !== undefined && t.duration === undefined
                          ? `${round1(dur - t.offset)}s`
                          : `${round1(shownDur ?? b.dur)}s`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 播放头(覆盖全部泳道) */}
            <div className="pb-tl-playhead" ref={playheadRef} style={{ height: RULER_H + V_LANE_H + tracks.length * LANE_H }}>
              <i />
            </div>
          </div>
        </div>
      </div>

      {/* 选中片段检查器 */}
      {selected && (
        <div className="pb-tl-inspector">
          <input
            className="field-input pb-tl-name"
            value={selected.name}
            title="轨道名"
            onChange={(e) => updateAudioTrack(selected.id, { name: e.target.value })}
          />
          <label className="pb-track-field">
            触发
            <input
              type="number"
              className="field-input pb-track-num"
              min={0}
              step={0.1}
              value={round1(selected.start)}
              onChange={(e) => updateAudioTrack(selected.id, { start: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label className="pb-track-field">
            偏移
            <input
              type="number"
              className="field-input pb-track-num"
              min={0}
              step={0.1}
              value={round1(selected.offset)}
              onChange={(e) => updateAudioTrack(selected.id, { offset: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label className="pb-track-field" title="片段时长(留空播到资产末尾)">
            时长
            <input
              type="number"
              className="field-input pb-track-num"
              min={0.1}
              step={0.1}
              placeholder="末尾"
              value={selected.duration ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                updateAudioTrack(selected.id, { duration: v === '' ? undefined : Math.max(MIN_CLIP, Number(v) || MIN_CLIP) });
              }}
            />
          </label>
          <div className="pb-track-vol">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selected.volume}
              title={`音量 ${Math.round(selected.volume * 100)}%`}
              onChange={(e) => updateAudioTrack(selected.id, { volume: Number(e.target.value) })}
            />
            <span className="pb-track-vol-label">{Math.round(selected.volume * 100)}%</span>
          </div>
          <button
            className={`mini-btn ${selected.muted ? 'danger' : ''}`}
            title={selected.muted ? '取消静音' : '静音'}
            onClick={() => updateAudioTrack(selected.id, { muted: !selected.muted })}
          >
            {selected.muted ? '🔇' : '🔊'}
          </button>
          <button className="mini-btn danger" title="移除音轨" onClick={() => removeAudioTrack(selected.id)}>
            删除
          </button>
          <span className="insp-hint">拖动块移动 · 拖左右边缘修剪 · 点标尺定位 · 吸附可切换</span>
        </div>
      )}

      {picking && <AssetPicker kind="audio" title="选择音频加入音轨" onClose={() => setPicking(false)} onPick={addAsset} />}
    </div>
  );
}
