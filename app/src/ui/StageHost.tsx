/**
 * StageHost(DESIGN.md 4.6):渲染全部场景组件(常驻挂载),
 * 组件挂载完成且 document.fonts.ready 后才 buildTimeline,再组装、交给 Player。
 * 重建流程:timelineRev 变化 → 记住当前 t → 重建 → seek(min(t, total))。
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { MutableRefObject } from 'react';
import type { BrandKit, VDocument } from '../types';
import { ASPECT_PIXELS } from '../types';
import { effectiveProps, getSceneDef } from '../scenes/registry';
import { deriveRng } from '../engine/random';
import { assemble, type AssembledScene } from '../engine/timeline/assemble';
import { Player, type PlayerAudioTrack } from '../engine/timeline/player';
import { getAssetURL } from '../io/assets';
import { AmbientLayer } from './AmbientLayer';
import { STAGE_BACKGROUND, stageCssVars } from './stageVars';

interface StageHostProps {
  doc: VDocument;
  brand: BrandKit;
  timelineRev: number;
  speed: number;
  loop: boolean;
  lastTimeRef: MutableRefObject<number>;
  onPlayerReady: (player: Player | null) => void;
}

export function StageHost({ doc, brand, timelineRev, speed, loop, lastTimeRef, onPlayerReady }: StageHostProps) {
  const elRefs = useRef(new Map<string, HTMLDivElement>());
  const brandRef = useRef(brand);
  brandRef.current = brand;
  const [player, setPlayer] = useState<Player | null>(null);
  const playerReady = (p: Player | null) => {
    setPlayer(p);
    onPlayerReady(p);
  };

  useEffect(() => {
    const scenes = doc.scenes;
    if (scenes.length === 0) {
      playerReady(null);
      return;
    }

    let cancelled = false;
    let player: Player | null = null;
    const contexts: gsap.Context[] = [];

    void (async () => {
      // 字体未就绪会导致排版尺寸不同,破坏确定性 —— 硬性门控
      await document.fonts.ready;
      if (cancelled) return;

      const b = brandRef.current;
      const assembled: AssembledScene[] = [];
      for (const scene of scenes) {
        const def = getSceneDef(scene.sceneType);
        const el = elRefs.current.get(scene.id);
        if (!def || !el) continue;
        const props = effectiveProps(def, scene, b);
        let stl!: ReturnType<typeof def.buildTimeline>;
        const gctx = gsap.context(() => {
          stl = def.buildTimeline({
            props,
            brand: b,
            el,
            rng: (stream) => deriveRng(doc.seed, scene.id, stream),
          });
        }, el);
        contexts.push(gctx);
        assembled.push({ ...stl, el });
      }

      if (cancelled) return;
      const { master, total } = assemble(assembled, doc.transitions);
      player = new Player(master, total);
      player.setSpeed(speed);
      player.setLoop(loop);
      player.subscribeTime((t) => {
        lastTimeRef.current = t;
      });
      player.seek(Math.min(lastTimeRef.current, total));
      playerReady(player);
    })();

    return () => {
      cancelled = true;
      player?.destroy();
      for (const c of contexts) c.revert();
      playerReady(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineRev, doc.id]);

  // 音频挂载(播放层):场景音效 + 文档音轨;内容经签名驱动,音轨编辑不重建时间线。
  // 资产 URL 异步解析后挂到当前 player(Player 仅在播放态驱动音频,seek/loop 均由规划器对齐)。
  const sfxSig = doc.scenes
    .map((s) => [s.id, s.sfx?.asset.assetId ?? '', s.sfx?.volume ?? '', s.sfx?.offset ?? ''].join(':'))
    .join('|');
  const tracksSig = (doc.audioTracks ?? [])
    .map((t) => [t.id, t.asset.assetId, t.start, t.offset, t.muted ? 0 : t.volume].join(':'))
    .join('|');

  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    const starts = player.sceneStarts();
    type PendingTrack = { ref: { assetId: string; mime: string }; start: number; offset: number; volume: number; end?: number };
    const pending: PendingTrack[] = doc.scenes
      .map((scene, i) =>
        scene.sfx && starts[i] !== undefined
          ? { ref: scene.sfx.asset, start: starts[i], offset: scene.sfx.offset, volume: scene.sfx.volume }
          : null,
      )
      .filter((x): x is PendingTrack => !!x);
    for (const t of doc.audioTracks ?? []) {
      if (t.muted) continue;
      pending.push({
        ref: t.asset,
        start: Math.max(0, t.start),
        offset: Math.max(0, t.offset),
        volume: t.volume,
        end: t.duration,
      });
    }
    if (pending.length === 0) {
      player.setAudioTracks([]);
      return;
    }
    void (async () => {
      const tracks: PlayerAudioTrack[] = [];
      for (const p of pending) {
        const url = await getAssetURL(p.ref);
        if (!url) continue;
        const el = new Audio(url);
        el.preload = 'auto';
        el.volume = Math.max(0, Math.min(1, p.volume));
        tracks.push({ el, start: p.start, offset: Math.max(0, p.offset), end: p.end });
      }
      if (cancelled) {
        for (const tr of tracks) tr.el.pause();
        return;
      }
      player.setAudioTracks(tracks);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, sfxSig, tracksSig]);

  const px = ASPECT_PIXELS[doc.aspect];

  return (
    <div
      id="stage"
      className="stage"
      data-aspect={doc.aspect}
      style={{ ...stageCssVars(brand), background: STAGE_BACKGROUND }}
    >
      <AmbientLayer
        config={doc.ambient}
        sceneBgs={doc.scenes.map((s) => s.bgImage)}
        seed={doc.seed}
        brand={brand}
        player={player}
        size={px}
      />
      {doc.scenes.map((scene) => {
        const def = getSceneDef(scene.sceneType);
        const props = def ? effectiveProps(def, scene, brand) : {};
        return (
          <div
            key={scene.id}
            ref={(el) => {
              if (el) elRefs.current.set(scene.id, el);
              else elRefs.current.delete(scene.id);
            }}
            data-scene-id={scene.id}
            className="scene-root"
          >
            {def ? (
              <def.Component props={props as Record<string, unknown>} brand={brand} aspect={doc.aspect} />
            ) : (
              <div className="scene-unknown">未知场景:{scene.sceneType}</div>
            )}
          </div>
        );
      })}
      {doc.scenes.length === 0 && <div className="stage-empty">从左下角「添加场景」开始</div>}
    </div>
  );
}
