/**
 * 素材选择器:从素材库按类型(图片/音频)挑选资产,点选即回调 AssetRef。
 * 内置上传入口:上传成功后直接选中,省去二次点击。
 */
import { useCallback, useEffect, useState } from 'react';
import type { AssetRef } from '../types';
import { listAssetEntries } from '../io/db';
import { entryToRef, getAssetURL, saveAssetFile } from '../io/assets';

interface PickItem {
  ref: AssetRef;
  url?: string;
}

export function AssetPicker({
  kind,
  title,
  onPick,
  onClose,
}: {
  kind: 'image' | 'audio';
  title: string;
  onPick: (ref: AssetRef) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PickItem[] | null>(null);

  const reload = useCallback(async () => {
    const entries = await listAssetEntries();
    const matched = entries.filter((e) => e.blob.type.startsWith(`${kind}/`));
    matched.sort((a, b) => (a.id < b.id ? 1 : -1));
    const loaded: PickItem[] = [];
    for (const e of matched) loaded.push({ ref: entryToRef(e), url: await getAssetURL({ assetId: e.id, mime: e.blob.type }) });
    setItems(loaded);
  }, [kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pick = (item: PickItem) => {
    onPick(item.ref);
    onClose();
  };

  const upload = async (f: File) => {
    const ref = await saveAssetFile(f);
    onPick(ref);
    onClose();
  };

  return (
    <div
      className="picker-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="picker-panel">
        <div className="picker-head">
          <span>{title}</span>
          <button className="mini-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="picker-list">
          {items === null && <p className="assets-empty">加载中…</p>}
          {items !== null && items.length === 0 && <p className="assets-empty">素材库还没有{kind === 'image' ? '图片' : '音频'},可直接上传。</p>}
          {items?.map((item) => (
            <button key={item.ref.assetId} className="picker-item" onClick={() => pick(item)} title={item.ref.name ?? item.ref.assetId}>
              <span className="asset-thumb">
                {kind === 'image' && item.url ? <img src={item.url} alt="" loading="lazy" /> : <span className="asset-thumb-icon">♪</span>}
              </span>
              <span className="picker-item-info">
                <span className="asset-name">{item.ref.name ?? item.ref.assetId}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="picker-actions">
          <label className="mini-btn file-btn">
            上传新{kind === 'image' ? '图片' : '音频'}
            <input
              type="file"
              accept={kind === 'image' ? 'image/*' : 'audio/*'}
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await upload(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
