/**
 * 启动页(DESIGN.md 3.2):项目列表 + 新建(引导填 Brand Kit 最小集 + 选模板)+ 导入 .vkit.json。
 */
import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { THEME_PRESETS, defaultBrandKit } from '../types';
import { getProject, listProjects, putProject } from '../io/db';
import { importProject, type VkitFile } from '../io/projectFile';
import { BUILTIN_TEMPLATES, createProjectFromTemplate } from '../io/templates';
import { useStore } from '../store';
import { navigate } from '../app/router';

export function Launcher() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const skipRenameCommit = useRef(false);
  const loadProject = useStore((s) => s.loadProject);
  const renameLoaded = useStore((s) => s.renameProject);

  useEffect(() => {
    void listProjects().then(setProjects);
  }, []);

  const open = async (id: string) => {
    const { migrateProject } = await import('../engine/migrate');
    const p = await getProject(id);
    if (p) {
      loadProject(migrateProject(p));
      navigate(`/editor/${p.id}`);
    }
  };

  const startRename = (p: Project) => {
    skipRenameCommit.current = false;
    setRenamingId(p.id);
    setRenameDraft(p.name);
  };

  const commitRename = async () => {
    if (skipRenameCommit.current) {
      skipRenameCommit.current = false;
      setRenamingId(null);
      return;
    }
    const id = renamingId;
    const next = renameDraft.trim();
    setRenamingId(null);
    if (!id || !next) return;
    const current = projects?.find((p) => p.id === id);
    if (!current || current.name === next) return;

    const loaded = useStore.getState().project;
    if (loaded?.id === id) {
      renameLoaded(next);
    } else {
      const p = await getProject(id);
      if (!p) return;
      await putProject({ ...p, name: next, updatedAt: new Date().toISOString() });
    }
    setProjects((list) => list?.map((p) => (p.id === id ? { ...p, name: next } : p)) ?? null);
  };

  const importFile = async (file: File) => {
    try {
      const p = await importProject(JSON.parse(await file.text()) as VkitFile);
      loadProject(p);
      navigate(`/editor/${p.id}`);
    } catch (err) {
      setError(`导入失败:${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="launcher">
      <header className="launcher-header">
        <h1>视频片头片尾工厂</h1>
        <p>配置化生产 · 确定性时间线 · 录屏导出</p>
      </header>

      {error && <div className="form-error-banner">{error}</div>}

      <section className="launcher-section">
        <div className="launcher-section-head">
          <h2>项目</h2>
          <div className="field-row-inline">
            <label className="mini-btn file-btn">
              导入 .vkit.json
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await importFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button className="primary-btn" onClick={() => setCreating(true)}>
              新建项目
            </button>
          </div>
        </div>
        {projects === null ? (
          <p className="insp-hint">加载中…</p>
        ) : projects.length === 0 ? (
          <p className="insp-hint">还没有项目,点「新建项目」开始。</p>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                {renamingId === p.id ? (
                  <div className="project-card">
                    <div className="project-card-head">
                      <input
                        className="field-input"
                        value={renameDraft}
                        maxLength={80}
                        autoFocus
                        aria-label="项目名"
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => void commitRename()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            skipRenameCommit.current = true;
                            setRenamingId(null);
                          }
                        }}
                      />
                    </div>
                    <span className="project-meta">
                      {p.brandKit.channel} · {p.episodes.length} 期 · {new Date(p.updatedAt).toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="project-card">
                    <div className="project-card-head">
                      <button className="project-card-open" onClick={() => void open(p.id)}>
                        <strong>{p.name}</strong>
                      </button>
                      <button className="mini-btn" title="修改项目名" onClick={() => startRename(p)}>
                        重命名
                      </button>
                    </div>
                    <button className="project-card-open" onClick={() => void open(p.id)}>
                      <span className="project-meta">
                        {p.brandKit.channel} · {p.episodes.length} 期 · {new Date(p.updatedAt).toLocaleString()}
                      </span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating && (
        <div className="modal-mask" onClick={() => setCreating(false)}>
          <NewProjectForm
            onCancel={() => setCreating(false)}
            onCreate={(p) => {
              loadProject(p);
              navigate(`/editor/${p.id}`);
            }}
          />
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onCreate, onCancel }: { onCreate: (p: Project) => void; onCancel: () => void }) {
  const [name, setName] = useState('我的频道');
  const [channel, setChannel] = useState('我的频道');
  const [tagline, setTagline] = useState('code · craft · share');
  const [handle, setHandle] = useState('@mychannel');
  const [presetId, setPresetId] = useState(THEME_PRESETS[0].id);
  const [templateId, setTemplateId] = useState(BUILTIN_TEMPLATES[0].id);

  const submit = async () => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];
    const brand = defaultBrandKit(channel, tagline, handle);
    brand.palette = { ...preset.palette };
    const { project } = createProjectFromTemplate({ name, brand, templateId });
    const { putProject } = await import('../io/db');
    await putProject(project);
    onCreate(project);
  };

  return (
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h3>新建项目</h3>
      <div className="field-row">
        <label className="field-label">项目名</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field-row">
        <label className="field-label">频道名</label>
        <input className="field-input" value={channel} onChange={(e) => setChannel(e.target.value)} />
      </div>
      <div className="field-row">
        <label className="field-label">标语</label>
        <input className="field-input" value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </div>
      <div className="field-row">
        <label className="field-label">Handle</label>
        <input className="field-input" value={handle} onChange={(e) => setHandle(e.target.value)} />
      </div>
      <div className="field-row">
        <label className="field-label">主题</label>
        <select className="field-input" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
          {THEME_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label className="field-label">模板</label>
        <select className="field-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {BUILTIN_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} — {t.description}
            </option>
          ))}
        </select>
      </div>
      <div className="modal-actions">
        <button className="mini-btn" onClick={onCancel}>
          取消
        </button>
        <button className="primary-btn" onClick={() => void submit()}>
          创建
        </button>
      </div>
    </div>
  );
}
