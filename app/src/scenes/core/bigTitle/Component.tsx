import { memo } from 'react';
import type { SceneComponentProps } from '../../types';
import type { BigTitleProps } from './schema';

/**
 * 结构与内容归 React:React 渲染「最终状态」,初始隐藏/入场状态由 GSAP 时间线
 * 在 buildTimeline 中经 data-anim 节点设置。data-anim 节点不接收 React 侧的
 * transform/opacity 内联样式,避免重渲染覆盖 GSAP 状态。
 */
function BigTitleComponentInner({ props }: SceneComponentProps<BigTitleProps>) {
  const titleChars = Array.from(props.title);
  const tagChars = Array.from(props.tagline);
  const accent = props.accentColor || 'var(--vk-accent)';
  const align = props.align === 'center' ? 'center' : 'flex-start';
  const textAlign = props.align === 'center' ? 'center' : 'left';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align,
        padding: '0 var(--layout-pad-x)',
        fontFamily: 'var(--vk-font-heading)',
      }}
    >
      <div data-anim="content" style={{ display: 'block', maxWidth: '100%' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--layout-title)',
            fontWeight: 800,
            letterSpacing: '0.02em',
            color: 'var(--vk-fg)',
            textAlign,
            lineHeight: 1.15,
            overflow: 'hidden',
          }}
        >
          {titleChars.map((c, i) => (
            <span key={i} data-anim="title-char" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
              {c}
            </span>
          ))}
        </h1>
        <div
          data-anim="underline"
          style={{
            height: 10,
            width: '62%',
            margin: props.align === 'center' ? '28px auto 0' : '28px 0 0',
            background: accent,
            transformOrigin: props.align === 'center' ? 'center' : 'left center',
            borderRadius: 2,
          }}
        />
        {props.tagline.length > 0 && (
          <p
            style={{
              margin: '36px 0 0',
              fontSize: 'var(--layout-tag)',
              fontFamily: 'var(--vk-font-mono)',
              color: 'var(--vk-fg-dim)',
              textAlign,
              minHeight: '1.4em',
              whiteSpace: 'pre',
            }}
          >
            {tagChars.map((c, i) => (
              <span key={i} data-anim="tag-char" style={{ whiteSpace: 'pre' }}>
                {c}
              </span>
            ))}
            {props.showCursor && (
              <span data-anim="tag-cursor" style={{ display: 'inline-block', width: '0.55em', textAlign: 'center', color: accent }}>
                ▍
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export const BigTitleComponent = memo(BigTitleComponentInner);
