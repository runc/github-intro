/**
 * 素材库对话框:统一管理 IndexedDB 里的图片/音频资产。
 * 资产是浏览器级共享(跨项目),占用判断扫描全部项目;被引用的资产禁删。
 * 删除为两步确认(按钮文字变化),避免误触;支持批量清理未使用。
 */
import { useCallback, useEffect, useState } from 'react';
import type { AssetRef } from '../types';
import { listAssetEntries, listProjects } from '../io/db';
import { getAssetURL, removeAsset, saveAssetFile } from '../io/assets';
import { scanAssetUsage } from '../io/assetUsage';

type Filter = 'all' | 'image' | 'audio';

interface LibraryItem {
  id: string;
  ref: AssetRef;
  blob: Blob;
  url?: string;
  usage: string[];
}

function assetKind(mime: string): 'image' | 'audio' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'other';
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AssetsDialog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cleanArmed, setCleanArmed] = useState(false);

  const reload = useCallback(async () => {
    const [entries, projects] = await Promise.all([listAssetEntries(), listProjects()]);
    const usage = scanAssetUsage(projects);
    const loaded: LibraryItem[] = [];
    for (const e of entries) {
      loaded.push({ id: e.id, ref: { assetId: e.id, mime: e.blob.type, name: e.blob instanceof File ? e.blob.name : undefined }, blob: e.blob, usage: usage.get(e.id) ?? [] });
    }
    // asset_ 前缀含 Date.now().toString(36),字典序倒排 ≈ 新上传在前
    loaded.sort((a, b) => (a.id < b.id ? 1 : -1));
    for (const item of loaded) {
      item.url = await getAssetURL({ assetId: item.id, mime: item.ref.mime });
    }
    setItems(loaded);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upload = async (files: FileList) => {
    for (const f of files) await saveAssetFile(f);
    await reload();
  };

  const del = async (item: LibraryItem) => {
    if (confirmId !== item.id) {
      setConfirmId(item.id);
      return;
    }
    setConfirmId(null);
    await removeAsset(item.id);
    await reload();
  };

  const unused = items?.filter((i) => i.usage.length === 0) ?? [];
  const cleanUnused = async () => {
    if (!cleanArmed) {
      setCleanArmed(true);
      return;
    }
    setCleanArmed(false);
    for (const item of unused) await removeAsset(item.id);
    await reload();
  };

  const visible = (items ?? []).filter((i) => filter === 'all' || assetKind(i.ref.mime) === filter);
  const counts = {
    image: items?.filter((i) => assetKind(i.ref.mime) === 'image').length ?? 0,
    audio: items?.filter((i) => assetKind(i.ref.mime) === 'audio').length ?? 0,
    bytes: items?.reduce((sum, i) => sum + i.blob.size, 0) ?? 0,
  };

  const filterTabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `全部 ${items?.length ?? 0}` },
    { key: 'image', label: `图片 ${counts.image}` },
    { key: 'audio', label: `音频 ${counts.audio}` },
  ];

  return (
    <div
      className="assets-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        // 阻断编辑器快捷键(useHotkeys 挂 window,冒泡到此拦截);Esc 关闭
        e.stopPropagation();
        if (e.key === 'Escape') {
          setConfirmId(null);
          setCleanArmed(false);
          onClose();
        }
      }}
    >
      <div className="assets-panel">
        <div className="assets-head">
          <span>素材库</span>
          <span className="assets-stats">
            {counts.bytes > 0 ? `${items?.length ?? 0} 项 · ${formatSize(counts.bytes)}` : ''}
          </span>
          <button className="mini-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="assets-toolbar">
          <div className="assets-filters">
            {filterTabs.map((f) => (
              <button key={f.key} className={`assets-filter ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="mini-btn file-btn">
            上传素材
            <input
              type="file"
              accept="image/*,audio/*"
              multiple
              hidden
              onChange={async (e) => {
                if (e.target.files?.length) await upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          {unused.length > 0 && (
            <button className={`mini-btn ${cleanArmed ? 'danger' : ''}`} onClick={() => void cleanUnused()}>
              {cleanArmed ? `确认清理 ${unused.length} 项` : `清理未使用 (${unused.length})`}
            </button>
          )}
        </div>

        <div className="assets-list">
          {items === null && <p className="assets-empty">加载中…</p>}
          {items !== null && visible.length === 0 && (
            <p className="assets-empty">
              {items.length === 0
                ? '还没有素材。上传图片或音频,即可在「背景图 / 音效」处从素材库选用。'
                : '此筛选下没有素材。'}
            </p>
          )}
          {visible.map((item) => {
            const kind = assetKind(item.ref.mime);
            const used = item.usage.length > 0;
            const confirming = confirmId === item.id;
            return (
              <div key={item.id} className="asset-row">
                <div className="asset-thumb">
                  {kind === 'image' && item.url ? (
                    <img src={item.url} alt={item.ref.name ?? item.id} loading="lazy" />
                  ) : (
                    <span className="asset-thumb-icon">{kind === 'audio' ? '♪' : '·'}</span>
                  )}
                </div>
                <div className="asset-info">
                  <span className="asset-name" title={item.ref.name ?? item.id}>
                    {item.ref.name ?? item.id}
                  </span>
                  <span className="asset-meta">
                    {item.ref.mime || '未知类型'} · {formatSize(item.blob.size)}
                  </span>
                  {kind === 'audio' && item.url && <audio className="asset-audio" src={item.url} controls preload="none" />}
                </div>
                <div className="asset-side">
                  {used ? (
                    <span className="asset-usage" title={item.usage.join('\n')}>
                      使用中 ×{item.usage.length}
                    </span>
                  ) : (
                    <span className="asset-unused">未使用</span>
                  )}
                  <button
                    className={`mini-btn ${confirming ? 'danger' : ''}`}
                    disabled={used}
                    title={used ? `被引用,不可删除:\n${item.usage.join('\n')}` : undefined}
                    onClick={() => void del(item)}
                  >
                    {confirming ? '确认删除' : '删除'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="assets-note">素材为本浏览器内全部项目共享;被引用的资产需先在对应位置移除后才能删除。</p>
      </div>
    </div>
  );
}
