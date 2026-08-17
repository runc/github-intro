import { memo, type ReactNode } from 'react';
import type { SceneComponentProps } from '../../types';
import type { GlitchTitleProps } from './schema';

/** 【】→ accent 高亮,| → 换行 */
function renderMarks(s: string): ReactNode[] {
  const parts = String(s).split('|');
  return parts.map((part, li) => (
    <span key={li} style={{ display: li > 0 ? 'block' : undefined }}>
      {splitHighlight(part)}
    </span>
  ));
}

function splitHighlight(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /【(.+?)】/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(
      <em key={i++} style={{ fontStyle: 'normal', color: 'var(--vk-accent)' }}>
        {m[1]}
      </em>,
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function GlitchTitleComponentInner({ props }: SceneComponentProps<GlitchTitleProps>) {
  const titleChars = Array.from(props.title);
  const tagChars = Array.from(props.tagline);
  const kicker = `${props.kickerPrefix} · ${props.ep}`.toUpperCase();

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div data-anim="content" style={{ textAlign: 'center', maxWidth: 'var(--layout-hero-max)', padding: '0 var(--layout-pad-x)' }}>
        <div
          data-anim="kicker"
          style={{
            fontSize: 'var(--layout-kicker)',
            fontWeight: 600,
            letterSpacing: '.45em',
            color: 'var(--vk-accent)',
            textTransform: 'uppercase',
            marginBottom: 38,
            fontFamily: 'var(--vk-font-mono)',
          }}
        >
          {kicker}
        </div>
        <h1
          style={{
            position: 'relative',
            margin: 0,
            fontSize: 'var(--layout-hero)',
            fontWeight: 900,
            letterSpacing: '.02em',
            color: 'var(--vk-fg)',
            lineHeight: 1.1,
          }}
        >
          <span
            data-anim="gl1"
            aria-hidden
            className="glitch-layer"
            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', fontWeight: 900, zIndex: 2, color: 'var(--vk-accent2)' }}
          >
            {props.title}
          </span>
          <span
            data-anim="gl2"
            aria-hidden
            className="glitch-layer"
            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', fontWeight: 900, zIndex: 2, color: 'var(--vk-accent)' }}
          >
            {props.title}
          </span>
          <span data-anim="title-chars" style={{ position: 'relative', zIndex: 1 }}>
            {titleChars.map((c, i) => (
              <span key={i} data-anim="title-char" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
                {c}
              </span>
            ))}
          </span>
        </h1>
        <div
          data-anim="underline"
          style={{
            height: 6,
            width: 460,
            margin: '44px auto 40px',
            borderRadius: 3,
            background: 'linear-gradient(90deg, var(--vk-accent), var(--vk-accent2))',
            transformOrigin: 'left center',
            boxShadow: '0 0 26px color-mix(in srgb, var(--vk-accent) 55%, transparent)',
          }}
        />
        <p style={{ margin: 0, fontSize: 'var(--layout-tag)', color: 'var(--vk-fg-dim)', minHeight: 58, fontFamily: 'var(--vk-font-mono)' }}>
          {tagChars.map((c, i) => (
            <span key={i} data-anim="tag-char" style={{ whiteSpace: 'pre' }}>
              {c}
            </span>
          ))}
          <span data-anim="caret" style={{ display: 'inline-block', width: 10, height: 32, background: 'var(--vk-accent)', verticalAlign: -4, marginLeft: 2 }} />
        </p>
        <div
          data-anim="epbar"
          style={{
            marginTop: 54,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 20,
            padding: '16px 30px',
            borderRadius: 14,
            background: 'var(--vk-panel)',
            border: '1px solid var(--vk-line)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              background: 'var(--vk-accent)',
              color: '#05130a',
              fontWeight: 800,
              fontSize: 20,
              padding: '6px 16px',
              borderRadius: 9,
              letterSpacing: '.05em',
              fontFamily: 'var(--vk-font-mono)',
            }}
          >
            {props.ep}
          </span>
          <span style={{ fontSize: 26, color: 'var(--vk-fg)' }}>{renderMarks(props.epTitle)}</span>
        </div>
      </div>
    </div>
  );
}

export const GlitchTitleComponent = memo(GlitchTitleComponentInner);
