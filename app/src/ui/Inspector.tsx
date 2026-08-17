import type { VDocument } from '../types';
import { useStore } from '../store';
import { SchemaForm } from './SchemaForm';
import { SfxPanel } from './SfxPanel';
import { SceneBgPanel } from './SceneBgPanel';
import { BrandPanel } from './BrandPanel';
import { GlobalPanel } from './GlobalPanel';

export function Inspector({ doc }: { doc: VDocument }) {
  const tab = useStore((s) => s.inspectorTab);
  const setTab = useStore((s) => s.setInspectorTab);
  const brand = useStore((s) => s.project?.brandKit);
  const selectedSceneId = useStore((s) => s.selectedSceneId);
  const selectedScene = doc.scenes.find((s) => s.id === selectedSceneId) ?? null;

  return (
    <aside className="inspector">
      <div className="insp-tabs">
        {(
          [
            ['scene', '场景'],
            ['brand', '品牌'],
            ['global', '全局'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`insp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="insp-body">
        {tab === 'scene' &&
          (selectedScene ? (
            <>
              <SchemaForm scene={selectedScene} />
              <SceneBgPanel scene={selectedScene} />
              <SfxPanel scene={selectedScene} />
            </>
          ) : (
            <div className="insp-hint">在左侧选中一个场景查看配置</div>
          ))}
        {tab === 'brand' && brand && <BrandPanel brand={brand} />}
        {tab === 'global' && <GlobalPanel doc={doc} />}
      </div>
    </aside>
  );
}
