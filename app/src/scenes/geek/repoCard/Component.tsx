import { memo } from 'react';
import type { SceneComponentProps } from '../../types';
import type { RepoCardProps } from './schema';
import { fmtCount } from './schema';

const BOOK_ICON = (
  <svg viewBox="0 0 16 16" width={34} height={34} style={{ fill: 'var(--vk-accent2)', flex: 'none' }}>
    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5v-9Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8V1.5Z" />
  </svg>
);
const STAR_ICON = (
  <svg viewBox="0 0 16 16" width={24} height={24} style={{ fill: 'var(--vk-fg-dim)', verticalAlign: -3, marginRight: 8 }}>
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
);
const FORK_ICON = (
  <svg viewBox="0 0 16 16" width={24} height={24} style={{ fill: 'var(--vk-fg-dim)', verticalAlign: -3, marginRight: 8 }}>
    <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5a2.25 2.25 0 0 1-2.25-2.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
  </svg>
);

function RepoCardComponentInner({ props }: SceneComponentProps<RepoCardProps>) {
  const metaStyle = { fontSize: 24, color: 'var(--vk-fg-dim)', display: 'flex', alignItems: 'center' };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div
        data-anim="card"
        style={{
          width: 'var(--layout-card-w)',
          padding: '44px 48px',
          borderRadius: 20,
          background: 'linear-gradient(160deg, color-mix(in srgb, var(--vk-bg) 90%, #fff) 0%, var(--vk-bg) 100%)',
          border: '1px solid color-mix(in srgb, var(--vk-accent) 40%, transparent)',
          boxShadow:
            '0 40px 100px rgba(0,0,0,.65), 0 0 90px color-mix(in srgb, var(--vk-accent) 20%, transparent), inset 0 1px 0 rgba(255,255,255,.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 34 }}>
          {BOOK_ICON}
          <span style={{ color: 'var(--vk-accent2)' }}>{props.owner}</span>
          <span style={{ color: 'var(--vk-fg-dim)' }}>/</span>
          <span style={{ color: 'var(--vk-accent2)', fontWeight: 800 }}>{props.repo}</span>
          {props.badge && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 16,
                color: 'var(--vk-fg-dim)',
                border: '1px solid var(--vk-line)',
                padding: '4px 14px',
                borderRadius: 999,
              }}
            >
              {props.badge}
            </span>
          )}
        </div>
        <p style={{ margin: '24px 0 32px', fontSize: 26, color: '#c9d1d9', lineHeight: 1.55 }}>{props.desc}</p>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <span style={metaStyle}>
            <i style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-block', background: props.langColor, marginRight: 12 }} />
            <b style={{ color: 'var(--vk-fg)', fontWeight: 700 }}>{props.lang}</b>
          </span>
          <span style={metaStyle}>
            {STAR_ICON}
            <b data-anim="stars" style={{ color: 'var(--vk-fg)', fontWeight: 700, marginLeft: 0 }}>
              {fmtCount(props.stars)}
            </b>
          </span>
          <span style={metaStyle}>
            {FORK_ICON}
            <b style={{ color: 'var(--vk-fg)', fontWeight: 700, marginLeft: 0 }}>{fmtCount(props.forks)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

export const RepoCardComponent = memo(RepoCardComponentInner);
