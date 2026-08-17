/**
 * 编辑器页(DESIGN.md 3.1):顶栏 / 场景列表 / 舞台 / 检查器 / 播放控制条。
 * Player 由 StageHost 构建后经 onPlayerReady 上交,供播放条与快捷键使用。
 * F 进入纯净全屏播放;ESC 退出浏览器全屏时同步关掉纯净模式。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player } from '../engine/timeline/player';
import { useStore, useCurrentDoc } from '../store';
import { ASPECT_PIXELS } from '../types';
import { TopBar } from './TopBar';
import { SceneList } from './SceneList';
import { StageHost } from './StageHost';
import { StageViewport } from './StageViewport';
import { Inspector } from './Inspector';
import { PlaybackBar } from './PlaybackBar';
import { ExportDialog } from './ExportDialog';
import { AssetsDialog } from './AssetsDialog';
import { useHotkeys } from './useHotkeys';
import { exitPresent } from './present';

export function Editor() {
  const project = useStore((s) => s.project);
  const timelineRev = useStore((s) => s.timelineRev);
  const showInspector = useStore((s) => s.showInspector);
  const pureMode = useStore((s) => s.pureMode);
  const speed = useStore((s) => s.speed);
  const loop = useStore((s) => s.loop);
  const doc = useCurrentDoc();

  const [player, setPlayer] = useState<Player | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const lastTimeRef = useRef(0);
  const onPlayerReady = useCallback((p: Player | null) => setPlayer(p), []);

  useHotkeys(player);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && useStore.getState().pureMode) {
        exitPresent();
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  if (!project) return null;
  if (!doc) {
    return (
      <div className="editor">
        <TopBar project={project} onOpenAssets={() => setAssetsOpen(true)} />
        <div className="editor-empty">本期没有文档</div>
        {assetsOpen && <AssetsDialog onClose={() => setAssetsOpen(false)} />}
      </div>
    );
  }

  const px = ASPECT_PIXELS[doc.aspect];

  return (
    <div className={`editor ${pureMode ? 'pure' : ''}`} data-vk-editor data-aspect={doc.aspect}>
      {!pureMode && <TopBar project={project} onExportVideo={() => setExportOpen(true)} onOpenAssets={() => setAssetsOpen(true)} />}
      <div className="editor-main">
        {!pureMode && <SceneList doc={doc} player={player} />}
        <div className="editor-center">
          <StageViewport w={px.w} h={px.h} fill={pureMode}>
            <StageHost
              doc={doc}
              brand={project.brandKit}
              timelineRev={timelineRev}
              speed={speed}
              loop={loop}
              lastTimeRef={lastTimeRef}
              onPlayerReady={onPlayerReady}
            />
          </StageViewport>
        </div>
        {!pureMode && showInspector && <Inspector doc={doc} />}
      </div>
      <PlaybackBar player={player} doc={doc} overlay={pureMode} />
      {pureMode && <div className="pure-exit-hint hud">F 退出全屏 · X 显示界面 · Space 播放</div>}
      {exportOpen && player && doc && (
        <ExportDialog
          player={player}
          doc={doc}
          brand={project.brandKit}
          projectName={project.name}
          onClose={() => setExportOpen(false)}
        />
      )}
      {assetsOpen && <AssetsDialog onClose={() => setAssetsOpen(false)} />}
    </div>
  );
}
