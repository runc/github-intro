import { memo } from 'react';
import type { SceneComponentProps } from '../../types';
import type { StarOutroProps } from './schema';
import { fmtCount } from './schema';

const STAR_ICON = (
  <svg viewBox="0 0 16 16" width={42} height={42} style={{ fill: 'var(--vk-accent)', display: 'block' }}>
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
);

/** URL 中域名部分长度,之后的 owner/repo 段高亮 */
const URL_PREFIX = 'github.com/';

/**
 * 结构与内容归 React(渲染最终状态);初始隐藏与入场由 GSAP 经 data-anim 节点设置。
 * 居中纵列:kicker → 引导语 → Star 按钮 → 仓库链接 → handle/标语。
 */
function StarOutroComponentInner({ props }: SceneComponentProps<StarOutroProps>) {
  const titleChars = Array.from(props.title);
  const url = `${URL_PREFIX}${props.owner}/${props.repo}`;
  const urlChars = Array.from(url);
  const showFooter = props.handle.length > 0 || (props.showTagline && props.tagline.length > 0);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 var(--layout-pad-x)',
        fontFamily: 'var(--vk-font-heading)',
      }}
    >
      <p
        data-anim="kicker"
        style={{
          margin: 0,
          fontSize: 'var(--layout-kicker)',
          letterSpacing: '.45em',
          textTransform: 'uppercase',
          color: 'var(--vk-fg-dim)',
          fontFamily: 'var(--vk-font-mono)',
        }}
      >
        {props.kicker}
      </p>

      <h1
        style={{
          margin: '36px 0 0',
          fontSize: 'var(--layout-title)',
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: 'center',
          maxWidth: 'var(--layout-hero-max)',
          color: 'var(--vk-fg)',
          overflow: 'hidden',
        }}
      >
        {titleChars.map((c, i) => (
          <span key={i} data-anim="title-char" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {c}
          </span>
        ))}
      </h1>

      {/* GitHub 风格 Star 按钮:左段星标+文案,右段计数 */}
      <div
        data-anim="btn"
        style={{
          marginTop: 56,
          display: 'inline-flex',
          alignItems: 'stretch',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid var(--vk-line)',
          background: 'var(--vk-panel)',
          boxShadow: '0 24px 70px rgba(0,0,0,.5)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '22px 38px', fontSize: 36, fontWeight: 700, color: 'var(--vk-fg)' }}>
          <span data-anim="star-icon" style={{ display: 'inline-flex' }}>
            {STAR_ICON}
          </span>
          Star
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '22px 34px',
            fontSize: 34,
            fontWeight: 700,
            color: 'var(--vk-fg)',
            borderLeft: '1px solid var(--vk-line)',
            fontFamily: 'var(--vk-font-mono)',
          }}
        >
          <b data-anim="star-count">{fmtCount(props.stars)}</b>
        </span>
      </div>

      {/* 仓库链接:终端提示符 + 逐字打入 + 光标 */}
      <div
        data-anim="urlbar"
        style={{
          marginTop: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '16px 34px',
          borderRadius: 999,
          border: '1px solid color-mix(in srgb, var(--vk-accent) 35%, transparent)',
          background: 'var(--vk-panel)',
          fontSize: 'var(--layout-term-fs)',
          fontFamily: 'var(--vk-font-mono)',
          whiteSpace: 'pre',
        }}
      >
        <span style={{ color: 'var(--vk-accent)', fontWeight: 700, marginRight: 14 }}>❯</span>
        {urlChars.map((c, i) => (
          <span
            key={i}
            data-anim="url-char"
            style={{
              whiteSpace: 'pre',
              color: i < URL_PREFIX.length ? 'var(--vk-fg-dim)' : 'var(--vk-fg)',
              fontWeight: i < URL_PREFIX.length ? 400 : 700,
            }}
          >
            {c}
          </span>
        ))}
        <span
          data-anim="caret"
          style={{ display: 'inline-block', width: 13, height: '1.1em', background: 'var(--vk-accent)', verticalAlign: -4, marginLeft: 4 }}
        />
      </div>

      {showFooter && (
        <div data-anim="footer" style={{ marginTop: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {props.handle.length > 0 && (
            <span style={{ fontSize: 34, fontFamily: 'var(--vk-font-mono)', color: 'var(--vk-accent)' }}>{props.handle}</span>
          )}
          {props.showTagline && props.tagline.length > 0 && (
            <span style={{ fontSize: 26, color: 'var(--vk-fg-dim)', letterSpacing: '0.08em' }}>{props.tagline}</span>
          )}
        </div>
      )}
    </div>
  );
}

export const StarOutroComponent = memo(StarOutroComponentInner);
