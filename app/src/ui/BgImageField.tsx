/**
 * 背景图控件:预览/上传/素材库选 + 浓度/填充/模糊/漂移参数。
 * 全局(文档 ambient)与场景级覆盖共用;换图保留既有参数,移除文案由调用方定。
 */
import { useEffect, useState } from 'react';
import type { AmbientBgImage } from '../types';
import { getAssetURL, saveAssetFile } from '../io/assets';
import { AssetPicker } from './AssetPicker';

export function BgImageField({
  value,
  onChange,
  removeLabel = '移除',
}: {
  value?: AmbientBgImage;
  onChange: (next: AmbientBgImage | undefined) => void;
  /** 移除按钮文案:全局「移除」,场景「清除(跟随全局)」 */
  removeLabel?: string;
}) {
  const [bgUrl, setBgUrl] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let alive = true;
    getAssetURL(value?.asset).then((u) => alive && setBgUrl(u));
    return () => {
      alive = false;
    };
    // 仅当资产更换时重新解析 URL,参数调节不触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.asset.assetId]);

  const apply = (asset: AmbientBgImage['asset']) => {
    // 换图保留浓度/填充/模糊等既有设置
    onChange(value ? { ...value, asset } : { asset, opacity: 0.5, fit: 'cover', blur: 0, motion: true });
  };

  const patch = (p: Partial<AmbientBgImage>) => {
    if (value) onChange({ ...value, ...p });
  };

  return (
    <div className="image-control">
      {bgUrl ? <img src={bgUrl} alt="背景图" className="image-preview" /> : <div className="image-empty">未设置</div>}
      <div className="field-row-inline">
        <label className="mini-btn file-btn">
          上传背景图
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) apply(await saveAssetFile(f));
              e.target.value = '';
            }}
          />
        </label>
        <button className="mini-btn" title="从素材库选择已有图片" onClick={() => setPicking(true)}>
          从素材库选
        </button>
        {value && (
          <button className="mini-btn danger" onClick={() => onChange(undefined)}>
            {removeLabel}
          </button>
        )}
      </div>
      {value && (
        <>
          <div className="field-row">
            <label className="field-label">
              浓度
              <span className="live-badge">live</span>
            </label>
            <div className="field-row-inline">
              <input
                type="range"
                className="field-input"
                min={0.05}
                max={1}
                step={0.05}
                value={value.opacity}
                onChange={(e) => patch({ opacity: Number(e.target.value) })}
              />
              <span className="slider-value">{Math.round(value.opacity * 100)}%</span>
            </div>
          </div>
          <div className="field-row">
            <label className="field-label">填充方式</label>
            <select className="field-input" value={value.fit} onChange={(e) => patch({ fit: e.target.value as AmbientBgImage['fit'] })}>
              <option value="cover">裁切铺满(cover)</option>
              <option value="contain">完整可见(contain)</option>
            </select>
          </div>
          <div className="field-row">
            <label className="field-label">模糊</label>
            <div className="field-row-inline">
              <input
                type="range"
                className="field-input"
                min={0}
                max={24}
                step={1}
                value={value.blur}
                onChange={(e) => patch({ blur: Number(e.target.value) })}
              />
              <span className="slider-value">{value.blur}px</span>
            </div>
          </div>
          <div className="field-row">
            <label className="field-label">缓慢漂移(Ken Burns)</label>
            <button
              className={`switch ${value.motion ? 'on' : ''}`}
              role="switch"
              aria-checked={value.motion}
              onClick={() => patch({ motion: !value.motion })}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </>
      )}
      {picking && (
        <AssetPicker
          kind="image"
          title="选择背景图"
          onClose={() => setPicking(false)}
          onPick={(asset) => apply(asset)}
        />
      )}
    </div>
  );
}
