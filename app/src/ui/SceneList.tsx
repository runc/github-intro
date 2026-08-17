/**
 * 场景列表(DESIGN.md 3.1):选中(检查器跟随)、增删、排序;底部「添加场景」打开场景库。
 * M1 用上移/下移排序,拖拽排序在 M3 时间轴面板提供。
 */
import { useState } from 'react';
import type { VDocument } from '../types';
import { useStore } from '../store';
import { allSceneDefs, getSceneDef } from '../scenes/registry';

export function SceneList({ doc, player }: { doc: VDocument; player: import('../engine/timeline/player').Player | null }) {
  const selectedSceneId = useStore((s) => s.selectedSceneId);
  const selectScene = useStore((s) => s.selectScene);
  const addScene = useStore((s) => s.addScene);
  const removeScene = useStore((s) => s.removeScene);
  const moveScene = useStore((s) => s.moveScene);
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <aside className="scene-list">
      <div className="scene-list-body">
        {doc.scenes.map((scene, i) => {
          const def = getSceneDef(scene.sceneType);
          return (
            <div
              key={scene.id}
              className={`scene-item ${selectedSceneId === scene.id ? 'selected' : ''}`}
              onClick={() => selectScene(scene.id)}
            >
              <span className="scene-index">{i + 1}</span>
              <span className="scene-name">{def?.title ?? scene.sceneType}</span>
              <span className="scene-actions" onClick={(e) => e.stopPropagation()}>
                <button className="mini-btn" title="跳到该场景" onClick={() => player?.seekScene(i)}>
                  ▸
                </button>
                <button className="mini-btn" title="上移" disabled={i === 0} onClick={() => moveScene(scene.id, i - 1)}>
                  ↑
                </button>
                <button
                  className="mini-btn"
                  title="下移"
                  disabled={i === doc.scenes.length - 1}
                  onClick={() => moveScene(scene.id, i + 1)}
                >
                  ↓
                </button>
                <button className="mini-btn danger" title="删除" onClick={() => removeScene(scene.id)}>
                  ×
                </button>
              </span>
            </div>
          );
        })}
        {doc.scenes.length === 0 && <div className="insp-hint">暂无场景</div>}
      </div>
      <button className="add-scene-btn" onClick={() => setLibraryOpen(true)}>
        + 添加场景
      </button>

      {libraryOpen && (
        <div className="modal-mask" onClick={() => setLibraryOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>场景库</h3>
            {[
              { pkg: 'core', label: '通用包' },
              { pkg: 'geek', label: '开源极客包' },
            ].map(({ pkg, label }) => {
              const defs = allSceneDefs().filter(
                (d) => d.type.startsWith(`${pkg}.`) && d.aspects.includes(doc.aspect),
              );
              if (defs.length === 0) return null;              return (
                <div key={pkg} className="library-group">
                  <span className="library-group-label">{label}</span>
                  <div className="library-grid">
                    {defs.map((def) => (
                      <button
                        key={def.type}
                        className="library-card"
                        onClick={() => {
                          addScene(def.type);
                          setLibraryOpen(false);
                        }}
                      >
                        <span className="library-kind">
                          {def.kind === 'motion' ? '动画' : '封面'} · {def.aspects.join(' / ')}
                        </span>
                        <strong>{def.title}</strong>
                        <span className="library-type">{def.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
