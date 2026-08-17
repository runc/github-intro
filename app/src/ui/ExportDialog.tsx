/**
 * 导出对话框:默认高清(标签页合成器录制)+ 保留 FO 草稿逐帧编码。
 */
import { useEffect, useRef, useState } from 'react';
import type { Player } from '../engine/timeline/player';
import type { BrandKit, VDocument } from '../types';
import { ASPECT_PIXELS } from '../types';
import { exportMp4, ExportCancelled, collectTrackSpecs, type ExportHandle, type ExportProgress } from '../export/pipeline';
import { exportLiveMp4 } from '../export/live';
import { liveCaptureAvailable, requestTabCapture, stopStream, waitStageLaidOut } from '../export/capture';
import { exportSize, frameCount } from '../export/plan';
import { aacEncodeSupported, webCodecsAvailable } from '../export/support';

const PHASE_LABEL: Record<ExportProgress['phase'], string> = {
  prepare: '准备',
  audio: '处理音频',
  video: '编码视频',
  finalize: '封装输出',
};

interface ExportDialogProps {
  player: Player;
  doc: VDocument;
  brand: BrandKit;
  projectName: string;
  onClose: () => void;
  /** 同步:铺满舞台 + 申请全屏(须在用户点击的同一轮里启动) */
  onLivePrepare: () => Promise<void> | void;
  /** Element Capture 拿不到竖屏帧时,改回窗口 contain 再用 Region Capture */
  onLiveContainLayout: () => Promise<void> | void;
  onLiveRestore: () => Promise<void> | void;
}

type ExportMode = 'live' | 'fo';

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: ExportProgress; live: boolean }
  | { kind: 'done'; url: string; bytes: number }
  | { kind: 'error'; message: string };

function downloadName(projectName: string, docName: string): string {
  return `${projectName}-${docName}.mp4`.replace(/[/\\:*?"<>|]/g, '_');
}

export function ExportDialog({
  player,
  doc,
  brand,
  projectName,
  onClose,
  onLivePrepare,
  onLiveContainLayout,
  onLiveRestore,
}: ExportDialogProps) {
  const liveOk = liveCaptureAvailable();
  const [mode, setMode] = useState<ExportMode>(liveOk ? 'live' : 'fo');
  const [fps, setFps] = useState(30);
  const [scale, setScale] = useState(1);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [support, setSupport] = useState<{ codecs: boolean; aac: boolean } | null>(null);
  const handleRef = useRef<ExportHandle | null>(null);
  const doneUrlRef = useRef<string | null>(null);

  useEffect(() => {
    void aacEncodeSupported().then((aac) => setSupport({ codecs: webCodecsAvailable(), aac }));
    return () => {
      if (doneUrlRef.current) URL.revokeObjectURL(doneUrlRef.current);
    };
  }, []);

  const total = player.total();
  const px = exportSize(ASPECT_PIXELS[doc.aspect], scale);
  const frames = frameCount(total, fps);
  const hasAudio = collectTrackSpecs(player, doc).length > 0;
  const running = run.kind === 'running';
  const liveRunning = run.kind === 'running' && run.live;

  const finishBlob = (blob: Blob) => {
    if (doneUrlRef.current) URL.revokeObjectURL(doneUrlRef.current);
    const url = URL.createObjectURL(blob);
    doneUrlRef.current = url;
    setRun({ kind: 'done', url, bytes: blob.size });
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName(projectName, doc.name);
    a.click();
  };

  const startFo = async (stage: HTMLElement, handle: ExportHandle) => {
    const blob = await exportMp4({
      player,
      stage,
      doc,
      brand,
      fps,
      scale,
      includeAudio,
      handle,
      onProgress: (p) => setRun({ kind: 'running', progress: p, live: false }),
    });
    finishBlob(blob);
  };

  const startLive = async (stage: HTMLElement, handle: ExportHandle) => {
    const fsP = Promise.resolve(onLivePrepare());
    const streamP = requestTabCapture(fps);
    let stream: MediaStream | undefined;
    try {
      stream = await streamP;
    } catch (e) {
      await fsP;
      await onLiveRestore();
      if (e instanceof DOMException && e.name === 'NotAllowedError') throw new ExportCancelled();
      throw e;
    }
    try {
      await fsP;
      await waitStageLaidOut(stage, 1200, () => handle.cancelled);
      if (handle.cancelled) throw new ExportCancelled();
      const liveStage = document.getElementById('stage') ?? stage;
      const blob = await exportLiveMp4({
        stream,
        player,
        stage: liveStage,
        doc,
        brand,
        fps,
        scale,
        includeAudio,
        handle,
        onContainLayout: onLiveContainLayout,
        onProgress: (p) => setRun({ kind: 'running', progress: p, live: true }),
      });
      finishBlob(blob);
    } finally {
      stopStream(stream);
      await onLiveRestore();
    }
  };

  const start = async () => {
    const stage = document.getElementById('stage');
    if (!stage) {
      setRun({ kind: 'error', message: '找不到舞台元素' });
      return;
    }
    const handle: ExportHandle = { cancelled: false };
    handleRef.current = handle;
    const live = mode === 'live';
    setRun({ kind: 'running', progress: { phase: 'prepare', percent: 0 }, live });
    try {
      if (live) await startLive(stage, handle);
      else await startFo(stage, handle);
    } catch (e) {
      if (e instanceof ExportCancelled) setRun({ kind: 'idle' });
      else setRun({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      handleRef.current = null;
    }
  };

  const cancel = () => {
    if (handleRef.current) handleRef.current.cancelled = true;
    window.dispatchEvent(new Event('vk-export-cancel'));
  };

  const progress = run.kind === 'running' ? run.progress : null;
  const percentText = progress ? `${Math.round(progress.percent * 100)}%` : '';

  return (
    <div
      className={`export-overlay${liveRunning ? ' live-hidden' : ''}`}
      onClick={(e) => e.target === e.currentTarget && !running && onClose()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (running) cancel();
        else onClose();
      }}
    >
      {liveRunning && progress && (
        <div className="export-live-hud" role="status" tabIndex={-1}>
          录制中 {PHASE_LABEL[progress.phase]}
          {progress.detail ? ` · ${progress.detail}` : ''} {percentText}
          <span>勿切换标签页 · Esc 取消</span>
          <button type="button" className="mini-btn" onClick={cancel}>
            取消
          </button>
        </div>
      )}

      <div className="export-panel">
        <div className="export-head">
          <span>导出视频 · {doc.name}</span>
          <button className="mini-btn" onClick={onClose} disabled={running}>
            ✕
          </button>
        </div>

        {support && !support.codecs && (
          <p className="export-warn">当前浏览器不支持 WebCodecs,无法导出视频。请使用较新的 Chrome / Edge。</p>
        )}
        {support?.codecs && includeAudio && hasAudio && !support.aac && (
          <p className="export-warn">当前浏览器不支持 AAC 编码,导出结果将没有声音。</p>
        )}
        {support?.codecs && !hasAudio && (
          <p className="export-note">本文档没有配置音频(场景音效),导出为无声视频。</p>
        )}

        {!running && (
          <div className="export-form">
            <label className="export-field">
              方式
              <select
                className="field-input"
                value={mode}
                onChange={(e) => setMode(e.target.value as ExportMode)}
              >
                <option value="live" disabled={!liveOk}>
                  高清(合成器录制)
                </option>
                <option value="fo">草稿(逐帧栅格,可切后台)</option>
              </select>
            </label>
            {!liveOk && (
              <p className="export-warn">当前浏览器不支持标签页区域采集,仅能使用草稿导出。请改用较新的 Chrome / Edge。</p>
            )}
            <label className="export-field">
              帧率
              <select className="field-input" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </label>
            <label className="export-field">
              分辨率
              <select className="field-input" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                <option value={1}>
                  {exportSize(ASPECT_PIXELS[doc.aspect], 1).w}×{exportSize(ASPECT_PIXELS[doc.aspect], 1).h}（原生）
                </option>
                <option value={2}>
                  {exportSize(ASPECT_PIXELS[doc.aspect], 2).w}×{exportSize(ASPECT_PIXELS[doc.aspect], 2).h}（4K）
                </option>
                <option value={0.5}>
                  {exportSize(ASPECT_PIXELS[doc.aspect], 0.5).w}×{exportSize(ASPECT_PIXELS[doc.aspect], 0.5).h}（50%）
                </option>
              </select>
            </label>
            <label className="export-field">
              音频
              <select
                className="field-input"
                value={includeAudio ? 'on' : 'off'}
                onChange={(e) => setIncludeAudio(e.target.value === 'on')}
              >
                <option value="on">包含(场景音效{hasAudio ? '' : ' · 无'})</option>
                <option value="off">仅视频</option>
              </select>
            </label>
            {mode === 'live' ? (
              <p className="export-note">
                时长 {total.toFixed(1)}s · 将按设计稿像素采集舞台,请分享「当前标签页」。竖屏在横屏显示器上若只能录到窗口里的缩小画面,放大到 1080p 不会更清晰。期间勿切换,约实时 {total.toFixed(1)}s。
              </p>
            ) : (
              <p className="export-note">
                时长 {total.toFixed(1)}s · {frames} 帧 · {px.w}×{px.h}。逐帧栅格文字偏软,可切换标签页。
              </p>
            )}
          </div>
        )}

        {progress && !liveRunning && (
          <div className="export-progress-wrap">
            <div className="export-progress-label">
              {PHASE_LABEL[progress.phase]}
              {progress.detail ? ` · ${progress.detail}` : ''} {percentText}
            </div>
            <div className="export-progress">
              <i style={{ width: `${Math.round(progress.percent * 100)}%` }} />
            </div>
          </div>
        )}

        {run.kind === 'done' && (
          <p className="export-note">
            已完成({(run.bytes / 1024 / 1024).toFixed(1)} MB),文件已开始下载。
            <button
              className="mini-btn"
              onClick={() => {
                const a = document.createElement('a');
                a.href = run.url;
                a.download = downloadName(projectName, doc.name);
                a.click();
              }}
            >
              再次下载
            </button>
          </p>
        )}
        {run.kind === 'error' && <p className="export-warn">导出失败:{run.message}</p>}

        <div className="export-actions">
          {running && !liveRunning ? (
            <button className="mini-btn" onClick={cancel}>
              取消导出
            </button>
          ) : (
            !liveRunning && (
              <button className="mini-btn export-primary" onClick={() => void start()} disabled={!support?.codecs || total <= 0}>
                {run.kind === 'done' ? '再次导出' : mode === 'live' ? '开始高清导出' : '开始草稿导出'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}