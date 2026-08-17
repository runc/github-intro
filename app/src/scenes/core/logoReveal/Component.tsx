import { memo, useEffect, useState } from 'react';
import type { SceneComponentProps } from '../../types';
import type { LogoRevealProps } from './schema';
import { getAssetURL } from '../../../io/assets';

function LogoRevealComponentInner({ props, brand }: SceneComponentProps<LogoRevealProps>) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getAssetURL(props.logo).then((url) => {
      if (alive) setLogoUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [props.logo]);

  const ringColor = props.ringColor || 'var(--vk-accent2)';
  const monogram = Array.from(brand.channel)[0] ?? '·';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 44,
        fontFamily: 'var(--vk-font-heading)',
      }}
    >
      <div style={{ position: 'relative', width: 'var(--layout-logo)', height: 'var(--layout-logo)' }}>
        {props.showRing && (
          <div
            data-anim="ring"
            style={{
              position: 'absolute',
              inset: -26,
              borderRadius: '50%',
              border: `2px solid ${ringColor}`,
              opacity: 0.55,
            }}
          />
        )}
        <div
          data-anim="logo"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 56,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--vk-panel)',
            fontSize: 'var(--layout-logo-glyph)',
            fontWeight: 800,
            color: 'var(--vk-accent)',
            fontFamily: 'var(--vk-font-heading)',
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="logo" style={{ width: '78%', height: '78%', objectFit: 'contain' }} draggable={false} />
          ) : (
            monogram
          )}
        </div>
      </div>

      <h1 style={{ margin: 0, fontSize: 'var(--layout-channel)', fontWeight: 800, color: 'var(--vk-fg)', overflow: 'hidden' }}>
        {Array.from(props.channel).map((c, i) => (
          <span key={i} data-anim="channel-char" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {c}
          </span>
        ))}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {props.handle.length > 0 && (
          <p data-anim="handle" style={{ margin: 0, fontSize: 38, fontFamily: 'var(--vk-font-mono)', color: 'var(--vk-accent)' }}>
            {props.handle}
          </p>
        )}
        {props.showTagline && brand.tagline.length > 0 && (
          <p data-anim="tagline" style={{ margin: 0, fontSize: 30, color: 'var(--vk-fg-dim)', letterSpacing: '0.08em' }}>
            {brand.tagline}
          </p>
        )}
      </div>
    </div>
  );
}

export const LogoRevealComponent = memo(LogoRevealComponentInner);
