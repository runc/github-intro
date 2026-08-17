/**
 * 场景音效面板:挂在检查器场景页底部,对任意场景类型生效(播放层能力,不进场景 schema)。
 * 音频资产经 io/assets 入 IndexedDB;触发点固定为场景起点,offset 用于微调对齐。
 */
import type { SceneInstance, SceneSfx } from '../types';
import { useState } from 'react';
import { useStore } from '../store';
import { saveAssetFile } from '../io/assets';
import { AssetPicker } from './AssetPicker';

export function SfxPanel({ scene }: { scene: SceneInstance }) {
  const setSceneSfx = useStore((s) => s.setSceneSfx);
  const [picking, setPicking] = useState(false);
  const sfx = scene.sfx;

  const applyAsset = (asset: SceneSfx['asset']) => {
    setSceneSfx(scene.id, { asset, volume: sfx?.volume ?? 0.8, offset: sfx?.offset ?? 0 });
  };

  const pick = async (f: File) => {
    applyAsset(await saveAssetFile(f));
  };

  const patch = (p: Partial<SceneSfx>) => {
    if (!sfx) return;
    setSceneSfx(scene.id, { ...sfx, ...p });
  };

  return (
    <fieldset className="form-group sfx-panel">
      <legend>音效</legend>
      <div className="field-row">
        <label className="field-label">音频文件</label>
        <div className="field-row-inline">
          {sfx ? <span className="sfx-name" title={sfx.asset.name}>{sfx.asset.name ?? sfx.asset.assetId}</span> : <span className="sfx-empty">未设置</span>}
          <label className="mini-btn file-btn">
            选择音频
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await pick(f);
                e.target.value = '';
              }}
            />
          </label>
          {sfx && (
            <button className="mini-btn danger" onClick={() => setSceneSfx(scene.id, undefined)}>
              移除
            </button>
          )}
          <button className="mini-btn" title="从素材库选择已有音频" onClick={() => setPicking(true)}>
            从素材库选
          </button>
        </div>
      </div>
      {picking && (
        <AssetPicker
          kind="audio"
          title="选择音效音频"
          onClose={() => setPicking(false)}
          onPick={(asset) => applyAsset(asset)}
        />
      )}
      {sfx && (
        <>
          <div className="field-row">
            <label className="field-label">音量</label>
            <div className="field-row-inline">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sfx.volume}
                onChange={(e) => patch({ volume: Number(e.target.value) })}
              />
              <span className="slider-value">{Math.round(sfx.volume * 100)}%</span>
            </div>
          </div>
          <div className="field-row">
            <label className="field-label">起始偏移(秒)</label>
            <input
              type="number"
              className="field-input"
              min={0}
              step={0.1}
              value={sfx.offset}
              onChange={(e) => patch({ offset: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        </>
      )}
    </fieldset>
  );
}
