/**
 * Zustand 单 store,三个 slice(DESIGN.md 4.8):
 * project(持久化)/ editor(不持久化)/ playback(低频控制态)。
 * 播放头时刻、每帧数据一律不进 store。
 */
import { create } from 'zustand';
import type { AmbientConfig, Aspect, AudioTrack, BrandKit, Episode, Palette, Project, SceneInstance, TransitionInstance, VDocument } from '../types';
import { defaultBrandKit, defaultTransitions, makeAudioTrack, uid } from '../types';
import { getSceneDef, instantiateScene } from '../scenes/registry';
import { putProject } from '../io/db';

export type SavingState = 'saved' | 'saving' | 'dirty';
export type InspectorTab = 'scene' | 'brand' | 'global';

interface AppState {
  // ---- project slice ----
  project: Project | null;
  currentEpisodeId: string | null;
  currentDocId: string | null;
  saving: SavingState;

  // ---- editor slice ----
  selectedSceneId: string | null;
  inspectorTab: InspectorTab;
  showInspector: boolean;
  pureMode: boolean;
  /** 高清导出会话:屏蔽快捷键,避免打断采集 */
  exportLock: boolean;
  /** 时间线需重建(非 live 字段变更);StageHost 监听此值重建 */
  timelineRev: number;

  // ---- playback slice ----
  isPlaying: boolean;
  speed: number;
  loop: boolean;
}

interface AppActions {
  loadProject(p: Project): void;
  closeProject(): void;
  renameProject(name: string): void;
  setEpisode(id: string): void;
  setDoc(id: string): void;
  updateBrand(patch: Partial<BrandKit>): void;
  applyPalette(preset: Palette): void;
  addScene(sceneType: string): void;
  removeScene(sceneId: string): void;
  moveScene(sceneId: string, toIndex: number): void;
  selectScene(sceneId: string | null): void;
  updateSceneProps(sceneId: string, patch: Record<string, unknown>): { ok: boolean; error?: string };
  setSceneSfx(sceneId: string, sfx: import('../types').SceneSfx | undefined): void;
  /** 场景背景图覆盖(氛围层 live 生效,无需重建时间线) */
  setSceneBg(sceneId: string, bg: import('../types').AmbientBgImage | undefined): void;
  /** 文档 BGM = 音轨列表第 1 条(创建/覆盖/移除);播放层挂载,不重建时间线 */
  setDocAudio(audio: import('../types').DocAudio | undefined): void;
  addAudioTrack(track: AudioTrack): void;
  updateAudioTrack(id: string, patch: Partial<Omit<AudioTrack, 'id'>>): void;
  removeAudioTrack(id: string): void;
  setBrandBinding(sceneId: string, key: string, bound: boolean): void;
  updateTransition(index: number, patch: Partial<TransitionInstance>): void;
  updateAmbient(patch: Partial<AmbientConfig>): void;
  setAspect(aspect: Aspect): void;
  reseed(): void;
  duplicateEpisode(): void;
  setInspectorTab(tab: InspectorTab): void;
  toggleInspector(): void;
  setPureMode(v: boolean): void;
  setExportLock(v: boolean): void;
  setPlaying(v: boolean): void;
  setSpeed(v: number): void;
  setLoop(v: boolean): void;
  flushSave(): Promise<void>;
}

export type Store = AppState & AppActions;

function sceneFieldLive(sceneType: string, key: string): boolean {
  return getSceneDef(sceneType)?.meta.find((m) => m.key === key)?.live === true;
}

export function currentDocOf(state: AppState): VDocument | null {
  const project = state.project;
  if (!project) return null;
  const ep = project.episodes.find((e) => e.id === state.currentEpisodeId) ?? project.episodes[0];
  if (!ep) return null;
  return ep.documents.find((d) => d.id === state.currentDocId) ?? ep.documents[0] ?? null;
}

export const useStore = create<Store>((set, get) => {
  /** 更新当前文档的不可变变换;touch = 同时更新 updatedAt */
  function mutateDoc(fn: (doc: VDocument) => VDocument, opts: { timeline?: boolean } = {}): boolean {
    const state = get();
    const project = state.project;
    const doc = currentDocOf(state);
    if (!project || !doc) return false;
    const nextProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      episodes: project.episodes.map((ep) =>
        ep.id === (project.episodes.find((e) => e.id === state.currentEpisodeId) ?? project.episodes[0])?.id
          ? { ...ep, documents: ep.documents.map((d) => (d.id === doc.id ? fn(d) : d)) }
          : ep,
      ),
    };
    set({ project: nextProject, ...(opts.timeline ? { timelineRev: state.timelineRev + 1 } : {}) });
    return true;
  }

  return {
    project: null,
    currentEpisodeId: null,
    currentDocId: null,
    saving: 'saved',

    selectedSceneId: null,
    inspectorTab: 'scene',
    showInspector: true,
    pureMode: false,
    exportLock: false,
    timelineRev: 0,

    isPlaying: false,
    speed: 1,
    loop: false,

    loadProject(p) {
      const ep = p.episodes[0];
      set({
        project: p,
        currentEpisodeId: ep?.id ?? null,
        currentDocId: ep?.documents[0]?.id ?? null,
        selectedSceneId: null,
        timelineRev: get().timelineRev + 1,
        saving: 'dirty',
      });
    },

    closeProject() {
      set({ project: null, currentEpisodeId: null, currentDocId: null, selectedSceneId: null });
    },

    renameProject(name) {
      const project = get().project;
      if (!project) return;
      const next = name.trim();
      if (!next || next === project.name) return;
      set({
        project: { ...project, name: next, updatedAt: new Date().toISOString() },
        saving: 'dirty',
      });
    },

    setEpisode(id) {
      const project = get().project;
      const ep = project?.episodes.find((e) => e.id === id);
      if (!ep) return;
      set({ currentEpisodeId: id, currentDocId: ep.documents[0]?.id ?? null, selectedSceneId: null, timelineRev: get().timelineRev + 1 });
    },

    setDoc(id) {
      set({ currentDocId: id, selectedSceneId: null, timelineRev: get().timelineRev + 1 });
    },

    updateBrand(patch) {
      const state = get();
      const project = state.project;
      if (!project) return;
      const keys = Object.keys(patch) as (keyof BrandKit)[];
      // 文本字段会经 brandBindings 改变场景内容(时长可能变化)→ 需重建;palette 走 CSS 变量实时通道
      const affectsTimeline = keys.some((k) => k !== 'palette');
      set({
        project: {
          ...project,
          updatedAt: new Date().toISOString(),
          brandKit: { ...project.brandKit, ...patch },
        },
        timelineRev: affectsTimeline ? state.timelineRev + 1 : state.timelineRev,
        saving: 'dirty',
      });
    },

    applyPalette(preset) {
      get().updateBrand({ palette: { ...preset } });
    },

    addScene(sceneType) {
      const scene = instantiateScene(sceneType, get().project?.brandKit ?? defaultBrandKit());
      mutateDoc(
        (doc) => ({
          ...doc,
          scenes: [...doc.scenes, scene],
          transitions: defaultTransitions(doc.scenes.length + 1),
        }),
        { timeline: true },
      );
      set({ selectedSceneId: scene.id, inspectorTab: 'scene' });
    },

    removeScene(sceneId) {
      mutateDoc(
        (doc) => {
          const scenes = doc.scenes.filter((s) => s.id !== sceneId);
          return { ...doc, scenes, transitions: defaultTransitions(scenes.length) };
        },
        { timeline: true },
      );
      if (get().selectedSceneId === sceneId) set({ selectedSceneId: null });
    },

    moveScene(sceneId, toIndex) {
      mutateDoc(
        (doc) => {
          const from = doc.scenes.findIndex((s) => s.id === sceneId);
          if (from < 0) return doc;
          const scenes = [...doc.scenes];
          const [item] = scenes.splice(from, 1);
          scenes.splice(Math.max(0, Math.min(toIndex, scenes.length)), 0, item);
          return { ...doc, scenes, transitions: defaultTransitions(scenes.length) };
        },
        { timeline: true },
      );
    },

    selectScene(sceneId) {
      set({ selectedSceneId: sceneId, inspectorTab: sceneId ? 'scene' : get().inspectorTab });
    },

    updateSceneProps(sceneId, patch) {
      const state = get();
      const doc = currentDocOf(state);
      const scene = doc?.scenes.find((s) => s.id === sceneId);
      if (!doc || !scene) return { ok: false, error: '场景不存在' };
      const def = getSceneDef(scene.sceneType);
      if (!def) return { ok: false, error: `未注册的场景类型: ${scene.sceneType}` };

      const nextScene: SceneInstance = { ...scene, props: { ...scene.props, ...patch } };
      const bound: Record<string, boolean> = { ...nextScene.brandBindings };
      for (const key of Object.keys(patch)) {
        // 用户显式改了绑定字段 → 视为断开绑定
        if (def.meta.find((m) => m.key === key)?.brandBind) bound[key] = false;
      }
      nextScene.brandBindings = bound;

      // 校验生效后的完整 props
      const effective = { ...nextScene.props };
      for (const m of def.meta) {
        if (m.brandBind && bound[m.key] !== false) {
          const brand = state.project?.brandKit;
          if (brand) effective[m.key] = brandValueOf(brand, m.brandBind);
        }
      }
      const parsed = def.schema.safeParse(effective);
      if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? '校验失败' };
      }

      const needTimeline = Object.keys(patch).some((k) => !sceneFieldLive(scene.sceneType, k));
      mutateDoc(
        (d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === sceneId ? nextScene : s)) }),
        { timeline: needTimeline },
      );
      return { ok: true };
    },

    setSceneSfx(sceneId, sfx) {
      // 音效属播放层配置:StageHost 按签名 effect 重挂音轨,无需重建时间线
      mutateDoc((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === sceneId ? { ...s, sfx } : s)) }));
    },

    setSceneBg(sceneId, bg) {
      // 背景图由氛围层逐帧解析,纯 live 生效,不重建时间线
      mutateDoc((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === sceneId ? { ...s, bgImage: bg } : s)) }));
    },

    setDocAudio(audio) {
      // BGM 即音轨列表第 1 条:有则覆盖,无则创建,传 undefined 移除
      mutateDoc((d) => {
        const tracks = d.audioTracks ? [...d.audioTracks] : [];
        if (audio) {
          const t0 = tracks[0];
          if (t0) {
            // 未改名(名字仍是旧资产名/缺省名)时,换文件同步更新轨道名
            const wasDefault = t0.name === 'BGM' || t0.name === t0.asset.name;
            tracks[0] = {
              ...t0,
              asset: audio.asset,
              offset: audio.offset,
              volume: audio.volume ?? t0.volume,
              muted: false,
              name: wasDefault ? audio.asset.name ?? t0.name : t0.name,
            };
          } else {
            tracks.unshift(makeAudioTrack(audio.asset, { offset: audio.offset, volume: audio.volume ?? 0.6 }));
          }
        } else if (tracks.length > 0) {
          tracks.shift();
        }
        return { ...d, audioTracks: tracks };
      });
    },

    addAudioTrack(track) {
      mutateDoc((d) => ({ ...d, audioTracks: [...(d.audioTracks ?? []), track] }));
    },

    updateAudioTrack(id, patch) {
      mutateDoc((d) => ({
        ...d,
        audioTracks: (d.audioTracks ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },

    removeAudioTrack(id) {
      mutateDoc((d) => ({ ...d, audioTracks: (d.audioTracks ?? []).filter((t) => t.id !== id) }));
    },

    setBrandBinding(sceneId, key, bound) {
      const state = get();
      const doc = currentDocOf(state);
      const scene = doc?.scenes.find((s) => s.id === sceneId);
      const brand = state.project?.brandKit;
      if (!scene || !brand) return;
      const def = getSceneDef(scene.sceneType);
      const meta = def?.meta.find((m) => m.key === key);
      if (!meta?.brandBind) return;
      const props = { ...scene.props };
      const bindings = { ...scene.brandBindings, [key]: bound };
      if (bound) {
        props[key] = brandValueOf(brand, meta.brandBind);
      }
      mutateDoc(
        (d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === sceneId ? { ...s, props, brandBindings: bindings } : s)) }),
        { timeline: true },
      );
    },

    updateTransition(index, patch) {
      mutateDoc((doc) => ({
        ...doc,
        transitions: doc.transitions.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      }));
    },

    updateAmbient(patch) {
      mutateDoc((doc) => ({ ...doc, ambient: { ...doc.ambient, ...patch } }));
    },

    setAspect(aspect) {
      mutateDoc((doc) => ({ ...doc, aspect }));
    },

    reseed() {
      mutateDoc((doc) => ({ ...doc, seed: (Math.random() * 0xffffffff) >>> 0 }), { timeline: true });
    },

    duplicateEpisode() {
      const state = get();
      const project = state.project;
      if (!project) return;
      const ep = project.episodes.find((e) => e.id === state.currentEpisodeId) ?? project.episodes[project.episodes.length - 1];
      if (!ep) return;
      const num = (parseInt(ep.ep.replace(/\D/g, ''), 10) || project.episodes.length) + 1;
      const clone: Episode = {
        ...ep,
        id: uid('ep_'),
        ep: `EP.${String(num).padStart(2, '0')}`,
        documents: ep.documents.map((d) => ({
          ...d,
          id: uid('doc_'),
          scenes: d.scenes.map((s) => ({ ...s, id: uid('scene_') })),
        })),
      };
      set({
        project: { ...project, updatedAt: new Date().toISOString(), episodes: [...project.episodes, clone] },
        currentEpisodeId: clone.id,
        currentDocId: clone.documents[0]?.id ?? null,
        saving: 'dirty',
      });
    },

    setInspectorTab(tab) {
      set({ inspectorTab: tab });
    },
    toggleInspector() {
      set({ showInspector: !get().showInspector });
    },
    setPureMode(v) {
      set({ pureMode: v });
    },
    setExportLock(v) {
      set({ exportLock: v });
    },
    setPlaying(v) {
      set({ isPlaying: v });
    },
    setSpeed(v) {
      set({ speed: v });
    },
    setLoop(v) {
      set({ loop: v });
    },

    async flushSave() {
      const p = get().project;
      if (!p) return;
      const stamped = { ...p, updatedAt: new Date().toISOString() };
      set({ project: stamped, saving: 'saving' });
      await putProject(stamped);
      set({ saving: 'saved' });
    },
  };
});

function brandValueOf(brand: BrandKit, bind: 'channel' | 'tagline' | 'handle' | 'logo'): unknown {
  switch (bind) {
    case 'channel':
      return brand.channel;
    case 'tagline':
      return brand.tagline;
    case 'handle':
      return brand.handle;
    case 'logo':
      return brand.logo;
  }
}

// ---- 防抖 1s 自动保存(DESIGN.md 3.2) ----
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((state, prev) => {
  if (state.project && state.project !== prev.project) {
    if (state.saving !== 'dirty') useStore.setState({ saving: 'dirty' });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void useStore.getState().flushSave();
    }, 1000);
  }
});

// ---- 便捷 selector hooks ----
export function useCurrentDoc(): VDocument | null {
  return useStore((s) => currentDocOf(s));
}
