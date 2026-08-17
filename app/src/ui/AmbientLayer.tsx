/**
 * 氛围层 React 宿主(DESIGN.md 4.7):canvas draw(t) + 扫描线/暗角静态覆盖层。
 * 播放中走主时间线 t(确定性);编辑器空闲时以「预览时钟」继续走动(仅观感)。
 * shot/冻结模式固定 t=0。画布尺寸跟随文档画幅(横 1920×1080 / 竖 1080×1920)。
 * 背景图经 io/assets 解码缓存后作为 drawAmbient 的运行时资源注入(与导出管线共用);
 * 场景级背景图按 sceneStarts 逐帧解析(resolveBgAt):场景覆盖 > 文档全局。
 */
import { useEffect, useRef, useState } from 'react';
import type { BrandKit } from '../types';
import type { AmbientBgImage, AmbientConfig } from '../types';
import { isLightPalette } from '../types';
import { drawAmbient, resolveBgAt, type AmbientBgDraw } from '../engine/ambient/draw';
import { loadImageAsset } from '../io/assets';
import type { Player } from '../engine/timeline/player';

interface AmbientLayerProps {
  config: AmbientConfig;
  /** 各场景的背景图覆盖(与 doc.scenes 下标对齐;undefined = 跟随全局) */
  sceneBgs: (AmbientBgImage | undefined)[];
  seed: number;
  brand: BrandKit;
  player: Player | null;
  frozen?: boolean;
  size: { w: number; h: number };
}

/** 无 player(shot 页冻结 t=0)时按场景 0 起点解析,场景级覆盖在截图路由同样生效 */
const FALLBACK_STARTS: number[] = [0];

export function AmbientLayer({ config, sceneBgs, seed, brand, player, frozen, size }: AmbientLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // assetId → 解码位图;全局与场景背景图共用一份缓存
  const [bgImgs, setBgImgs] = useState<Record<string, HTMLImageElement | undefined>>({});
  const light = isLightPalette(brand.palette);
  const stateRef = useRef({
    config,
    sceneBgs,
    seed,
    colors: { accent: brand.palette.accent, accent2: brand.palette.accent2, head: light ? '#1f2328' : '#ebf5ee', paper: brand.palette.bg },
    player,
    frozen,
    size,
    bgImgs,
  });
  stateRef.current = {
    config,
    sceneBgs,
    seed,
    colors: {
      accent: brand.palette.accent,
      accent2: brand.palette.accent2,
      // 浅底时特效高亮改深墨色(近白字头在浅底上不可见)
      head: light ? '#1f2328' : '#ebf5ee',
      paper: brand.palette.bg,
    },
    player,
    frozen,
    size,
    bgImgs,
  };

  // 涉及的 assetId 集合(稳定字符串做依赖,数组身份每次渲染都变)
  const bgKey = [config.bgImage?.asset.assetId ?? '-', ...sceneBgs.map((b) => b?.asset.assetId ?? '-')].join(',');
  useEffect(() => {
    let alive = true;
    const ids = new Set<string>();
    if (config.bgImage) ids.add(config.bgImage.asset.assetId);
    for (const b of sceneBgs) if (b) ids.add(b.asset.assetId);
    for (const id of ids) {
      void loadImageAsset({ assetId: id, mime: 'image/*' }).then((img) => {
        if (alive) setBgImgs((prev) => (prev[id] === img ? prev : { ...prev, [id]: img }));
      });
    }
    return () => {
      alive = false;
    };
    // 仅当资产集合变化时重新解析,参数调节不触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let preview = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      let t: number;
      if (s.frozen) {
        t = 0;
      } else if (s.player?.isPlaying()) {
        t = s.player.time();
        preview = t;
      } else {
        preview += dt;
        t = preview;
      }
      const cfg = resolveBgAt(t, s.config.bgImage, s.sceneBgs, s.player ? s.player.sceneStarts() : FALLBACK_STARTS);
      const img = cfg ? s.bgImgs[cfg.asset.assetId] : undefined;
      const bg: AmbientBgDraw | undefined = img && cfg ? { img, cfg } : undefined;
      drawAmbient(ctx, t, s.config, s.seed, s.colors, s.size, bg);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {config.scanlines && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            // 浅色底扫描线用暗线(白线在浅底上不可见)
            background: light
              ? 'repeating-linear-gradient(0deg, rgba(15, 23, 42, .05) 0 1px, transparent 1px 4px)'
              : 'repeating-linear-gradient(0deg, rgba(255,255,255,.028) 0 1px, transparent 1px 4px)',
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {config.vignette && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            // 浅色底用柔和深灰暗角,深色底保持原来的重暗角
            background: isLightPalette(brand.palette)
              ? 'radial-gradient(120% 92% at 50% 45%, transparent 58%, rgba(28, 34, 46, .26))'
              : 'radial-gradient(120% 92% at 50% 45%, transparent 55%, rgba(0,0,0,.52))',
          }}
        />
      )}
    </>
  );
}
