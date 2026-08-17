/**
 * 全局 tab:氛围层(背景图 / 背景特效 / 元素开关)、背景音乐、文档画幅(横屏/竖屏)、seed、播放与导出入口。
 */
import { useState } from 'react';
import type { AmbientFxType, VDocument } from '../types';
import { AMBIENT_FX_LABELS, ASPECTS, ASPECT_LABELS, ASPECT_PIXELS } from '../types';
import { useStore } from '../store';
import { getSceneDef } from '../scenes/registry';
import { saveAssetFile } from '../io/assets';
import { BALL_GLYPHS } from '../engine/ambient/draw';
import { BgImageField } from './BgImageField';
import { AssetPicker } from './AssetPicker';

const FX_OPTIONS: AmbientFxType[] = ['none', 'matrix', 'balls', 'pile', 'waves', 'orbs', 'ink'];

export function GlobalPanel({ doc }: { doc: VDocument }) {
  const updateAmbient = useStore((s) => s.updateAmbient);
  const setAspect = useStore((s) => s.setAspect);
  const reseed = useStore((s) => s.reseed);
  const setDocAudio = useStore((s) => s.setDocAudio);
  const [pickingBgm, setPickingBgm] = useState(false);

  const bg = doc.ambient.bgImage;
  // BGM = 音轨列表第 1 条(多轨管理在底部播放条的「音轨」面板)
  const bgm = doc.audioTracks?.[0];
  const intensity = doc.ambient.fxIntensity ?? 0.7;

  const ambientFields = [
    { key: 'particles', label: '粒子星空' },
    { key: 'grid', label: '透视网格' },
    { key: 'scanlines', label: '扫描线' },
    { key: 'vignette', label: '暗角' },
  ] as const;

  const sceneAspects = doc.scenes.map((s) => getSceneDef(s.sceneType)?.aspects);
  const allowed = ASPECTS.filter((a) => sceneAspects.every((list) => !list || list.includes(a)));
  const px = ASPECT_PIXELS[doc.aspect];

  return (
    <div className="schema-form">
      <fieldset className="form-group">
        <legend>文档</legend>
        <div className="field-row">
          <label className="field-label">类型</label>
          <span className="hex-label">{doc.kind}</span>
        </div>
        <div className="field-row">
          <label className="field-label">画幅</label>
          <select
            className="field-input"
            value={doc.aspect}
            onChange={(e) => setAspect(e.target.value as (typeof ASPECTS)[number])}
            title="横屏 16:9 / 竖屏 9:16;舞台按目标像素等比缩放"
          >
            {ASPECTS.map((a) => (
              <option key={a} value={a} disabled={allowed.length > 0 && !allowed.includes(a)}>
                {ASPECT_LABELS[a]}
                {px && a === doc.aspect ? ` · ${px.w}×${px.h}` : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="insp-hint">
          当前舞台 {px.w}×{px.h}。横屏适合 YouTube / B 站;竖屏适合 Shorts / Reels。GitHub 模板会同时生成两份文档。
        </p>
        <div className="field-row">
          <label className="field-label">随机 seed</label>
          <div className="field-row-inline">
            <span className="hex-label">{doc.seed}</span>
            <button className="mini-btn" onClick={reseed} title="重新随机(影响粒子/Glitch 等随机动效)">
              重掷
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>背景图(全文档)</legend>
        <BgImageField value={bg} onChange={(next) => updateAmbient({ bgImage: next })} />
        <p className="insp-hint">背景图画在氛围层最底,浓度调低可作底纹;与背景特效可叠加。单个场景可在「场景」页单独覆盖。</p>
      </fieldset>

      <fieldset className="form-group">
        <legend>背景音乐(BGM)</legend>
        <div className="field-row">
          <label className="field-label">音频文件</label>
          <div className="field-row-inline">
            {bgm ? (
              <span className="sfx-name" title={bgm.asset.name ?? bgm.asset.assetId}>
                {bgm.name}
              </span>
            ) : (
              <span className="sfx-empty">未设置</span>
            )}
            <label className="mini-btn file-btn">
              选择音频
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const asset = await saveAssetFile(f);
                    setDocAudio({ asset, offset: bgm?.offset ?? 0, volume: bgm?.volume ?? 0.6 });
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <button className="mini-btn" title="从素材库选择已有音频" onClick={() => setPickingBgm(true)}>
              从素材库选
            </button>
            {bgm && (
              <button className="mini-btn danger" onClick={() => setDocAudio(undefined)}>
                移除
              </button>
            )}
          </div>
        </div>
        {bgm && (
          <>
            <div className="field-row">
              <label className="field-label">音量</label>
              <div className="field-row-inline">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgm.volume}
                  onChange={(e) => setDocAudio({ ...bgm, volume: Number(e.target.value) })}
                />
                <span className="slider-value">{Math.round(bgm.volume * 100)}%</span>
              </div>
            </div>
            <div className="field-row">
              <label className="field-label">起始偏移(秒)</label>
              <input
                type="number"
                className="field-input"
                min={0}
                step={0.1}
                value={bgm.offset}
                onChange={(e) => setDocAudio({ ...bgm, offset: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          </>
        )}
        {pickingBgm && (
          <AssetPicker
            kind="audio"
            title="选择背景音乐"
            onClose={() => setPickingBgm(false)}
            onPick={(asset) => setDocAudio({ asset, offset: bgm?.offset ?? 0, volume: bgm?.volume ?? 0.6 })}
          />
        )}
        <p className="insp-hint">BGM = 音轨列表第 1 条(从 0 秒铺底),与场景音效叠加混音;多条音轨在底部播放条的「音轨」面板添加与微调。</p>
      </fieldset>

      <fieldset className="form-group">
        <legend>背景特效</legend>
        <div className="field-row">
          <label className="field-label">
            类型
            <span className="live-badge">live</span>
          </label>
          <select
            className="field-input"
            value={doc.ambient.fx ?? 'none'}
            onChange={(e) => updateAmbient({ fx: e.target.value as AmbientFxType })}
          >
            {FX_OPTIONS.map((fx) => (
              <option key={fx} value={fx}>
                {AMBIENT_FX_LABELS[fx]}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <label className="field-label">
            强度
            <span className="live-badge">live</span>
          </label>
          <div className="field-row-inline">
            <input
              type="range"
              className="field-input"
              min={0.2}
              max={1}
              step={0.05}
              value={intensity}
              onChange={(e) => updateAmbient({ fxIntensity: Number(e.target.value) })}
            />
            <span className="slider-value">{Math.round(intensity * 100)}%</span>
          </div>
        </div>
        {((doc.ambient.fx ?? 'none') === 'balls' || (doc.ambient.fx ?? 'none') === 'pile') && (
          <div className="field-row">
            <label className="field-label">
              {(doc.ambient.fx ?? 'none') === 'balls' ? '球面字符' : '堆积文字'}
              <span className="live-badge">live</span>
            </label>
            <input
              className="field-input"
              value={doc.ambient.fxChars ?? ''}
              placeholder={BALL_GLYPHS.slice(0, 12) + '…'}
              onChange={(e) => updateAmbient({ fxChars: e.target.value })}
            />
            <p className="insp-hint">逐字取用;留空用内置汉字集(代码开源…),输入如「你好世界」即替换。</p>
          </div>
        )}
        <p className="insp-hint">强度同时影响特效与极光的亮度。重掷 seed 可换一套随机排布。</p>
      </fieldset>

      <fieldset className="form-group">
        <legend>氛围元素</legend>
        {ambientFields.map((f) => (
          <div key={f.key} className="field-row">
            <label className="field-label">{f.label}</label>
            <button
              className={`switch ${doc.ambient[f.key] ? 'on' : ''}`}
              role="switch"
              aria-checked={doc.ambient[f.key]}
              onClick={() => updateAmbient({ [f.key]: !doc.ambient[f.key] })}
            >
              <span className="switch-knob" />
            </button>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
