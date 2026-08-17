import { memo } from 'react';
import type { SceneComponentProps } from '../../types';
import type { TerminalProps } from './schema';

function TerminalComponentInner({ props }: SceneComponentProps<TerminalProps>) {
  const cmd = `git clone https://github.com/${props.owner}/${props.repo}.git`;
  const cmdChars = Array.from(cmd);
  const border = props.borderColor || 'var(--vk-accent)';
  const lines = [
    { t: `Cloning into '${props.repo}'...`, c: 'dim' },
    { t: 'remote: Enumerating objects: 12,847, done.', c: 'dim' },
    { t: 'Receiving objects: 100% (12847/12847), 24.16 MiB | 18.2 MiB/s, done.', c: 'dim' },
    { t: `✓ 本期主角加载完成 —— ${props.owner}/${props.repo}`, c: 'ok' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div
        data-anim="term"
        style={{
          width: 'var(--layout-term-w)',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'rgba(13,17,23,.82)',
          backdropFilter: 'blur(10px)',
          border: `1px solid color-mix(in srgb, ${border} 35%, transparent)`,
          boxShadow: `0 30px 80px rgba(0,0,0,.6), 0 0 60px color-mix(in srgb, ${border} 16%, transparent)`,
        }}
      >
        {/* 终端是拟物深色窗口:背景/标题栏/窗内文字固定深色系,不随主题翻转(浅色主题下深字落深窗会看不清) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '15px 20px',
            background: 'rgba(255,255,255,.06)',
            borderBottom: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <i style={{ width: 14, height: 14, borderRadius: '50%', background: '#ff5f57' }} />
          <i style={{ width: 14, height: 14, borderRadius: '50%', background: '#febc2e' }} />
          <i style={{ width: 14, height: 14, borderRadius: '50%', background: '#28c840' }} />
          <span
            style={{
              margin: '0 auto',
              color: 'rgba(240, 246, 252, 0.6)',
              fontSize: 14,
              transform: 'translateX(-26px)',
              fontFamily: 'var(--vk-font-mono)',
            }}
          >
            zsh — 80×24
          </span>
        </div>
        <div
          style={{
            padding: '26px 32px 32px',
            fontSize: 'var(--layout-term-fs)',
            lineHeight: 1.8,
            color: '#c9d1d9',
            minHeight: 320,
            fontFamily: 'var(--vk-font-mono)',
          }}
        >
          <div>
            <span style={{ color: border, fontWeight: 700 }}>❯ ~</span>{' '}
            {cmdChars.map((c, i) => (
              <span key={i} data-anim="cmd-char" style={{ whiteSpace: 'pre', color: '#f2f4f8' }}>
                {c}
              </span>
            ))}
            <span data-anim="caret" style={{ display: 'inline-block', width: 13, height: 28, background: border, verticalAlign: -4, marginLeft: 4 }} />
          </div>
          <div>
            {lines.map((l, i) => (
              <div
                key={i}
                data-anim="tline"
                style={{
                  color: l.c === 'ok' ? border : 'rgba(240, 246, 252, 0.55)',
                  fontWeight: l.c === 'ok' ? 600 : 400,
                }}
              >
                {l.t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TerminalComponent = memo(TerminalComponentInner);
