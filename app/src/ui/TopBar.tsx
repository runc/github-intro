import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { ASPECT_LABELS } from '../types';
import { currentDocOf, useStore } from '../store';
import { exportProject } from '../io/projectFile';
import { getAsset } from '../io/db';
import { navigate } from '../app/router';
import { togglePresent } from './present';

const SAVING_LABEL = { saved: '已保存', saving: '保存中…', dirty: '未保存(自动保存中)' } as const;

export function TopBar({
  project,
  onExportVideo,
  onOpenAssets,
}: {
  project: Project;
  onExportVideo?: () => void;
  onOpenAssets?: () => void;
}) {
  const currentEpisodeId = useStore((s) => s.currentEpisodeId);
  const saving = useStore((s) => s.saving);
  const renameProject = useStore((s) => s.renameProject);
  const setEpisode = useStore((s) => s.setEpisode);
  const setDoc = useStore((s) => s.setDoc);
  const duplicateEpisode = useStore((s) => s.duplicateEpisode);
  const flushSave = useStore((s) => s.flushSave);

  const state = useStore.getState();
  const episode = project.episodes.find((e) => e.id === currentEpisodeId) ?? project.episodes[0];
  const doc = currentDocOf(state);

  const doExport = async () => {
    await flushSave();
    const file = await exportProject(project, getAsset);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name}.vkit.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <header className="topbar">
      <button className="mini-btn" onClick={() => navigate('/')}>
        ← 项目
      </button>
      <ProjectName name={project.name} onRename={renameProject} />

      <select className="field-input topbar-select" value={episode?.id ?? ''} onChange={(e) => setEpisode(e.target.value)}>
        {project.episodes.map((ep) => (
          <option key={ep.id} value={ep.id}>
            {ep.ep} · {ep.title}
          </option>
        ))}
      </select>
      <button className="mini-btn" title="复制本期为期号 +1" onClick={duplicateEpisode}>
        复制本期
      </button>

      <div className="topbar-docs">
        {episode?.documents.map((d) => (
          <button
            key={d.id}
            className={`doc-tab ${doc?.id === d.id ? 'active' : ''}`}
            onClick={() => setDoc(d.id)}
            title={d.id}
          >
            {d.name}
            <span className="doc-tab-aspect">{ASPECT_LABELS[d.aspect]}</span>
          </button>
        ))}
      </div>

      <span className={`saving-state ${saving}`}>{SAVING_LABEL[saving]}</span>
      <span className="topbar-spacer" />
      <button className="mini-btn" title="管理背景图 / 音频素材(浏览器内全项目共享)" onClick={onOpenAssets}>
        素材库
      </button>
      <button className="mini-btn" title="纯净全屏播放 (F)" onClick={() => togglePresent()}>
        全屏
      </button>
      <button className="mini-btn" title="导出 MP4:默认高清录制舞台,亦可草稿逐帧" onClick={onExportVideo}>
        导出视频
      </button>
      <button className="mini-btn" onClick={doExport}>
        导出 .vkit.json
      </button>
      {doc && (
        <button
          className="mini-btn"
          title="无 UI 精确截图路由"
          onClick={() => navigate(`/shot/${doc.id}?aspect=${encodeURIComponent(doc.aspect)}`)}
        >
          shot
        </button>
      )}
    </header>
  );
}

function ProjectName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const skipCommit = useRef(false);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  const commit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      setDraft(name);
      return;
    }
    const next = draft.trim();
    if (!next) {
      setDraft(name);
      return;
    }
    if (next !== name) onRename(next);
    else if (draft !== next) setDraft(next);
  };

  return (
    <input
      className="topbar-title"
      value={draft}
      title="修改项目名"
      aria-label="项目名"
      maxLength={80}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          skipCommit.current = true;
          setDraft(name);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
