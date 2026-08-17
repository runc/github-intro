/**
 * 导出对话框:MP4(H.264 + AAC)全浏览器内导出。
 * 逐帧确定性编码无需保持实时,进度条期间可离开标签页;取消经 ExportHandle 协作中断。
 */
import { useEffect, useRef, useState } from 'react';
import type { Player } from '../engine/timeline/player';
import type { BrandKit, VDocument } from '../types';
import { ASPECT_PIXELS } from '../types';
import { exportMp4, ExportCancelled, collectTrackSpecs, type ExportHandle, type ExportProgress } from '../export/pipeline';
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
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: ExportProgress }
  | { kind: 'done'; url: string; bytes: number }
  | { kind: 'error'; message: string };

export function ExportDialog({ player, doc, brand, projectName, onClose }: ExportDialogProps) {
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

  const start = async () => {
    const stage = document.getElementById('stage');
    if (!stage) {
      setRun({ kind: 'error', message: '找不到舞台元素' });
      return;
    }
    const handle: ExportHandle = { cancelled: false };
    handleRef.current = handle;
    setRun({ kind: 'running', progress: { phase: 'prepare', percent: 0 } });
    try {
      const blob = await exportMp4({
        player,
        stage,
        doc,
        brand,
        fps,
        scale,
        includeAudio,
        handle,
        onProgress: (p) => setRun({ kind: 'running', progress: p }),
      });
      if (doneUrlRef.current) URL.revokeObjectURL(doneUrlRef.current);
      const url = URL.createObjectURL(blob);
      doneUrlRef.current = url;
      setRun({ kind: 'done', url, bytes: blob.size });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}-${doc.name}.mp4`.replace(/[/\\:*?"<>|]/g, '_');
      a.click();
    } catch (e) {
      if (e instanceof ExportCancelled) setRun({ kind: 'idle' });
      else setRun({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      handleRef.current = null;
    }
  };

  const cancel = () => {
    if (handleRef.current) handleRef.current.cancelled = true;
  };

  const progress = run.kind === 'running' ? run.progress : null;
  const percentText = progress ? `${Math.round(progress.percent * 100)}%` : '';

  return (
    <div
      className="export-overlay"
      onClick={(e) => e.target === e.currentTarget && !running && onClose()}
      onKeyDown={(e) => {
        // 阻断编辑器快捷键(useHotkeys 挂在 window,此处冒泡拦截);Esc 关闭
        e.stopPropagation();
        if (e.key === 'Escape' && !running) onClose();
      }}
    >
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
            <p className="export-note">
              时长 {total.toFixed(1)}s · {frames} 帧 · {px.w}×{px.h} 输出。画面 2× 超采样后再编码,文字更锐利。期间可切换标签页。
            </p>
          </div>
        )}

        {progress && (
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
                a.download = `${projectName}-${doc.name}.mp4`.replace(/[/\\:*?"<>|]/g, '_');
                a.click();
              }}
            >
              再次下载
            </button>
          </p>
        )}
        {run.kind === 'error' && <p className="export-warn">导出失败:{run.message}</p>}

        <div className="export-actions">
          {running ? (
            <button className="mini-btn" onClick={cancel}>
              取消导出
            </button>
          ) : (
            <button className="mini-btn export-primary" onClick={() => void start()} disabled={!support?.codecs || total <= 0}>
              {run.kind === 'done' ? '再次导出' : '开始导出'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
