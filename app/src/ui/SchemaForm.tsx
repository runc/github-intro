/**
 * schema+meta → 表单自动生成(DESIGN.md 3.5)。
 * live 字段实时生效;其余字段修改后播放/seek 时自动重建时间线(store 已标记)。
 * brandBind 字段默认绑定 Brand Kit,可断开/恢复。
 */
import { useEffect, useState } from 'react';
import type { AssetRef, BrandKit, SceneInstance } from '../types';
import type { FieldMeta } from '../scenes/types';
import { brandValue, effectiveProps, getSceneDef } from '../scenes/registry';
import { useStore } from '../store';
import { getAssetURL, saveAssetFile } from '../io/assets';
import { BUILTIN_FONTS } from '../io/fonts';

export function SchemaForm({ scene }: { scene: SceneInstance }) {
  const brand = useStore((s) => s.project?.brandKit);
  const updateSceneProps = useStore((s) => s.updateSceneProps);
  const setBrandBinding = useStore((s) => s.setBrandBinding);
  const [formError, setFormError] = useState<string | null>(null);

  const def = getSceneDef(scene.sceneType);
  if (!def || !brand) {
    return <div className="insp-hint">未知场景类型:{scene.sceneType}</div>;
  }

  const parsed = def.schema.safeParse(effectiveProps(def, scene, brand));
  const errors = new Map<string, string>();
  if (!parsed.success) {
    for (const iss of parsed.error.issues) {
      const key = String(iss.path[0] ?? '');
      if (key && !errors.has(key)) errors.set(key, iss.message);
    }
  }

  const isBound = (m: FieldMeta) => !!m.brandBind && scene.brandBindings[m.key] !== false;
  const valueOf = (m: FieldMeta): unknown => (isBound(m) ? brandValue(brand, m.brandBind!) : scene.props[m.key]);

  const setField = (m: FieldMeta, v: unknown) => {
    const r = updateSceneProps(scene.id, { [m.key]: v });
    setFormError(r.ok ? null : (r.error ?? '校验失败'));
  };

  const groups = new Map<string, FieldMeta[]>();
  for (const m of def.meta) {
    const g = m.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(m);
  }

  return (
    <div className="schema-form">
      <div className="insp-scene-title">
        <strong>{def.title}</strong>
        <span className="insp-scene-type">
          {def.type} · v{def.version}
        </span>
      </div>
      {[...groups.entries()].map(([group, fields]) => (
        <fieldset key={group} className="form-group">
          {group && <legend>{group}</legend>}
          {fields.map((m) => (
          <FieldRow
            key={m.key}
            meta={m}
            value={valueOf(m)}
            bound={isBound(m)}
            error={errors.get(m.key)}
            brand={brand}
            allProps={scene.props}
            onChange={(v) => setField(m, v)}
            onToggleBind={() => setBrandBinding(scene.id, m.key, !isBound(m))}
          />
          ))}
        </fieldset>
      ))}
      {formError && <div className="form-error-banner">{formError}</div>}
    </div>
  );
}

interface FieldRowProps {
  meta: FieldMeta;
  value: unknown;
  bound: boolean;
  error?: string;
  brand: BrandKit;
  /** optionsFn 等动态控件需要读取同级字段 */
  allProps: Record<string, unknown>;
  onChange: (v: unknown) => void;
  onToggleBind: () => void;
}

function FieldRow({ meta, value, bound, error, brand, allProps, onChange, onToggleBind }: FieldRowProps) {
  const label = (
    <label className={`field-label ${meta.live ? 'field-live' : ''}`}>
      {meta.label}
      {meta.live && <span className="live-badge" title="实时生效,无需重建时间线">live</span>}
      {meta.brandBind && (
        <button
          className={`bind-btn ${bound ? 'bound' : ''}`}
          title={bound ? `已绑定品牌(${meta.brandBind}),点击断开自定义` : '恢复绑定品牌'}
          onClick={onToggleBind}
        >
          {bound ? '🔗' : '⛓️‍💥'}
        </button>
      )}
    </label>
  );

  let control: React.ReactNode;
  switch (meta.control) {
    case 'text':
      control = (
        <input
          type="text"
          className={`field-input ${error ? 'field-invalid' : ''}`}
          value={String(value ?? '')}
          placeholder={meta.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'textarea':
      control = (
        <textarea
          className={`field-input ${error ? 'field-invalid' : ''}`}
          rows={3}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'color':
      control = (
        <div className="field-row-inline">
          <input
            type="color"
            value={normalizeHex(value, brand.palette.accent)}
            onChange={(e) => onChange(e.target.value)}
          />
          {meta.clearable && typeof value === 'string' && value !== '' && (
            <button className="mini-btn" onClick={() => onChange('')} title="恢复跟随品牌色">
              跟随品牌
            </button>
          )}
        </div>
      );
      break;
    case 'number':
      control = (
        <input
          type="number"
          className={`field-input ${error ? 'field-invalid' : ''}`}
          value={Number(value ?? 0)}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
      break;
    case 'slider':
      control = (
        <div className="field-row-inline">
          <input
            type="range"
            value={Number(value ?? 0)}
            min={meta.min ?? 0}
            max={meta.max ?? 100}
            step={meta.step ?? 1}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="slider-value">{String(value ?? '')}</span>
        </div>
      );
      break;
    case 'switch':
      control = (
        <button className={`switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={!!value}>
          <span className="switch-knob" />
        </button>
      );
      break;
    case 'select': {
      const options = meta.options ?? meta.optionsFn?.(allProps) ?? [];
      control = (
        <select
          className="field-input"
          value={String(value ?? '')}
          onChange={(e) => onChange(meta.coerce === 'number' ? Number(e.target.value) : e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case 'repeater':
      control = <RepeaterControl meta={meta} value={value} brand={brand} onChange={onChange} />;
      break;
    case 'image':
      control = <ImageControl meta={meta} value={value as AssetRef | undefined} onChange={onChange} />;
      break;
    case 'font':
      control = (
        <select className="field-input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {BUILTIN_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      );
      break;
  }

  return (
    <div className="field-row">
      {label}
      {control}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

function normalizeHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/** repeater 控件:对象数组的增删改;子字段复用 FieldRow 递归渲染 */
function RepeaterControl({
  meta,
  value,
  brand,
  onChange,
}: {
  meta: FieldMeta;
  value: unknown;
  brand: BrandKit;
  onChange: (v: unknown) => void;
}) {
  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  const fields = meta.itemFields ?? [];
  const min = meta.min ?? 0;
  const max = meta.max ?? Number.POSITIVE_INFINITY;

  const patchItem = (idx: number, key: string, v: unknown) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, [key]: v } : it)));
  };

  return (
    <div className="repeater">
      {items.map((item, idx) => (
        <div className="repeater-item" key={idx}>
          <div className="repeater-item-head">
            <span>
              #{idx + 1}
              {meta.itemTitleKey && item[meta.itemTitleKey] ? ` · ${String(item[meta.itemTitleKey])}` : ''}
            </span>
            <button className="mini-btn danger" onClick={() => onChange(items.filter((_, i) => i !== idx))} disabled={items.length <= min}>
              删除
            </button>
          </div>
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              meta={f}
              value={item[f.key]}
              bound={false}
              brand={brand}
              allProps={item}
              onChange={(v) => patchItem(idx, f.key, v)}
              onToggleBind={() => {}}
            />
          ))}
        </div>
      ))}
      <button className="mini-btn" onClick={() => onChange([...items, { ...(meta.itemDefaults ?? {}) }])} disabled={items.length >= max}>
        + 添加
      </button>
    </div>
  );
}

function ImageControl({
  meta,
  value,
  onChange,
}: {
  meta: FieldMeta;
  value: AssetRef | undefined;
  onChange: (v: unknown) => void;
}) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    getAssetURL(value).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div className="image-control">
      {url ? (
        <img src={url} alt={meta.label} className="image-preview" />
      ) : (
        <div className="image-empty">{value ? '资产缺失' : '未设置'}</div>
      )}
      <div className="field-row-inline">
        <label className="mini-btn file-btn">
          选择图片
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onChange(await saveAssetFile(f));
              e.target.value = '';
            }}
          />
        </label>
        {value && (
          <button className="mini-btn" onClick={() => onChange(undefined)}>
            移除
          </button>
        )}
      </div>
    </div>
  );
}
