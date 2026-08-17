/**
 * shot 路由(DESIGN.md 3.7):'#/shot/:docId?aspect=16:9' 整页 1:1 展开为目标像素、无任何 UI。
 * 不构建时间线:场景组件按「最终状态」自然渲染,供 DevTools Capture node screenshot / 系统截图。
 * ?aspect= 可覆盖文档画幅,用于同一文档出横/竖截图。
 */
import { useEffect, useState } from 'react';
import type { Aspect, BrandKit, VDocument } from '../types';
import { ASPECT_PIXELS, isAspect } from '../types';
import { listProjects } from '../io/db';
import { effectiveProps, getSceneDef } from '../scenes/registry';
import { AmbientLayer } from './AmbientLayer';
import { STAGE_BACKGROUND, stageCssVars } from './stageVars';

interface Found {
  doc: VDocument;
  brand: BrandKit;
}

export function ShotPage({ docId, aspect: aspectParam }: { docId: string; aspect?: string }) {
  const [found, setFound] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      const projects = await listProjects();
      for (const p of projects) {
        for (const ep of p.episodes) {
          const doc = ep.documents.find((d) => d.id === docId);
          if (doc) {
            setFound({ doc, brand: p.brandKit });
            return;
          }
        }
      }
      setNotFound(true);
    })();
  }, [docId]);

  if (notFound) return <div className="shot-hint">找不到文档:{docId}</div>;
  if (!found) return null;

  const { doc, brand } = found;
  const aspect: Aspect = isAspect(aspectParam) ? aspectParam : doc.aspect;
  const px = ASPECT_PIXELS[aspect];

  return (
    <>
      <div
        id="stage"
        className="stage shot-stage"
        data-aspect={aspect}
        style={{
          ...stageCssVars(brand),
          background: STAGE_BACKGROUND,
          width: px.w,
          height: px.h,
        }}
      >
        <AmbientLayer
          config={doc.ambient}
          sceneBgs={doc.scenes.map((s) => s.bgImage)}
          seed={doc.seed}
          brand={brand}
          player={null}
          frozen
          size={px}
        />
        {doc.scenes.map((scene) => {
          const def = getSceneDef(scene.sceneType);
          if (!def) return null;
          const props = effectiveProps(def, scene, brand);
          return (
            <div key={scene.id} className="scene-root">
              <def.Component props={props} brand={brand} aspect={aspect} />
            </div>
          );
        })}
      </div>
      <div className="shot-hint">
        {aspect} · {px.w}×{px.h} · DevTools → 检查 #stage → Capture node screenshot
      </div>
    </>
  );
}
