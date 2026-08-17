/**
 * 品牌 tab(DESIGN.md 3.2):Brand Kit 表单。四色经 CSS 变量实时生效。
 */
import { useEffect, useState } from 'react';
import { THEME_PRESETS } from '../types';
import type { BrandKit, Palette } from '../types';
import { useStore } from '../store';
import { getAssetURL, saveAssetFile } from '../io/assets';
import { BUILTIN_FONTS } from '../io/fonts';

export function BrandPanel({ brand }: { brand: BrandKit }) {
  const updateBrand = useStore((s) => s.updateBrand);
  const updateAmbient = useStore((s) => s.updateAmbient);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    getAssetURL(brand.logo).then((u) => alive && setLogoUrl(u));
    return () => {
      alive = false;
    };
  }, [brand.logo]);

  const colorFields: { key: keyof Palette; label: string }[] = [
    { key: 'bg', label: '背景' },
    { key: 'bgDeep', label: '深背景' },
    { key: 'accent', label: '强调色' },
    { key: 'accent2', label: '强调色 2' },
  ];

  return (
    <div className="schema-form">
      <fieldset className="form-group">
        <legend>主题预设</legend>
        <div className="preset-row">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset-btn"
              title={p.fonts || p.ambient ? `${p.label}(含字体/氛围搭配)` : p.label}
              onClick={() => {
                updateBrand({ palette: { ...p.palette }, ...(p.fonts ? { fonts: { ...p.fonts } } : {}) });
                // 预设联动氛围:水墨预设把文档切到水墨特效并关掉科幻向元素
                if (p.ambient) updateAmbient(p.ambient);
              }}
            >
              <span className="preset-dot" style={{ background: p.palette.accent }} />
              <span className="preset-dot" style={{ background: p.palette.accent2 }} />
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>色板(实时生效)</legend>
        {colorFields.map((f) => (
          <div key={f.key} className="field-row">
            <label className="field-label field-live">
              {f.label}
              <span className="live-badge">live</span>
            </label>
            <div className="field-row-inline">
              <input
                type="color"
                value={brand.palette[f.key]}
                onChange={(e) => updateBrand({ palette: { ...brand.palette, [f.key]: e.target.value } })}
              />
              <span className="hex-label">{brand.palette[f.key]}</span>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="form-group">
        <legend>频道信息</legend>
        <div className="field-row">
          <label className="field-label">频道名</label>
          <input className="field-input" value={brand.channel} onChange={(e) => updateBrand({ channel: e.target.value })} />
        </div>
        <div className="field-row">
          <label className="field-label">标语</label>
          <input className="field-input" value={brand.tagline} onChange={(e) => updateBrand({ tagline: e.target.value })} />
        </div>
        <div className="field-row">
          <label className="field-label">Handle</label>
          <input className="field-input" value={brand.handle} onChange={(e) => updateBrand({ handle: e.target.value })} />
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>Logo</legend>
        <div className="image-control">
          {logoUrl ? <img src={logoUrl} alt="logo" className="image-preview" /> : <div className="image-empty">未设置</div>}
          <div className="field-row-inline">
            <label className="mini-btn file-btn">
              上传 Logo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) updateBrand({ logo: await saveAssetFile(f) });
                  e.target.value = '';
                }}
              />
            </label>
            {brand.logo && (
              <button className="mini-btn" onClick={() => updateBrand({ logo: undefined })}>
                移除
              </button>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>字体</legend>
        {(
          [
            { key: 'heading', label: '标题字体' },
            { key: 'body', label: '正文字体' },
            { key: 'mono', label: '等宽字体' },
          ] as const
        ).map((f) => (
          <div key={f.key} className="field-row">
            <label className="field-label">{f.label}</label>
            <select
              className="field-input"
              value={brand.fonts[f.key]}
              onChange={(e) => updateBrand({ fonts: { ...brand.fonts, [f.key]: e.target.value } })}
            >
              {BUILTIN_FONTS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
