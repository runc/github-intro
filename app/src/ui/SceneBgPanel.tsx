/**
 * 场景背景图面板:挂在检查器场景页,只对该场景时间段生效(覆盖全局背景图)。
 * 与场景音效同为播放层/氛围层能力,不进场景 schema。
 */
import type { SceneInstance } from '../types';
import { useStore } from '../store';
import { BgImageField } from './BgImageField';

export function SceneBgPanel({ scene }: { scene: SceneInstance }) {
  const setSceneBg = useStore((s) => s.setSceneBg);

  return (
    <fieldset className="form-group sfx-panel">
      <legend>背景图(本场景)</legend>
      <BgImageField
        value={scene.bgImage}
        onChange={(next) => setSceneBg(scene.id, next)}
        removeLabel="清除(跟随全局)"
      />
      {!scene.bgImage && <p className="insp-hint">未设置时该场景使用全局背景图;设置后仅在本场景时间段内覆盖。</p>}
    </fieldset>
  );
}
