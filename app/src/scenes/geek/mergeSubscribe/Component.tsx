import { memo } from 'react';
import type { SceneComponentProps } from '../../types';
import type { MergeSubscribeProps } from './schema';
import { CARD_MERGED_SHADOW, MERGED_PURPLE, MERGED_PURPLE_FG, MERGE_GREEN_FG } from './schema';

/**
 * React 渲染「已合并」最终帧;绿态、彩带、指针均由 GSAP 在 buildTimeline 中设置。
 */

const PR_ICON = (
  <svg viewBox="0 0 16 16" width={26} height={26} style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, display: 'block' }}>
    <circle cx="4.2" cy="3.4" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="12.6" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="3.4" r="1.9" fill="currentColor" stroke="none" />
    <path d="M4.2 5.3v5.4M12 5.3v3.1c0 1.7-2.6 1.9-4.4 2" strokeLinecap="round" />
  </svg>
);

const CHECK_ICON = (
  <svg
    viewBox="0 0 16 16"
    width={22}
    height={22}
    style={{ fill: 'none', stroke: MERGE_GREEN_FG, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}
  >
    <path d="M2.5 8.5 6 12 13.5 4" />
  </svg>
);

const MERGE_ICON = (
  <svg viewBox="0 0 16 16" width={22} height={22} style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, display: 'block' }}>
    <circle cx="4" cy="4" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8" r="1.9" fill="currentColor" stroke="none" />
    <path d="M4 5.9v4.2M12 9.9c0 1.9-3.2 2.1-6 2.1" strokeLinecap="round" />
  </svg>
);

const CURSOR_ICON = (
  <svg viewBox="0 0 24 24" width={46} height={46} style={{ display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.5))' }}>
    <path d="M6 3 L6 20.5 L10.5 16.4 L13.2 22.5 L15.8 21.4 L13.1 15.4 L18.5 15 Z" fill="#fff" stroke="#111" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

const CONFETTI_COLORS = ['var(--vk-accent)', 'var(--vk-accent2)', '#ffd866', '#ffffff'];

function MergeSubscribeComponentInner({ props }: SceneComponentProps<MergeSubscribeProps>) {
  const titleChars = Array.from(props.title);
  const showFooter = props.cta.length > 0 || props.handle.length > 0;

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
      <div
        data-anim="card"
        style={{
          width: 'var(--layout-card-w)',
          padding: '40px 44px 44px',
          borderRadius: 20,
          background: 'linear-gradient(160deg, color-mix(in srgb, var(--vk-bg) 90%, #fff) 0%, var(--vk-bg) 100%)',
          border: `1px solid color-mix(in srgb, ${MERGED_PURPLE} 45%, transparent)`,
          boxShadow: CARD_MERGED_SHADOW,
        }}
      >
        {/* PR 头部:图标(open 绿 → merged 紫)+ 编号 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 24 }}>
          <span data-anim="pr-icon" style={{ display: 'inline-flex', color: MERGED_PURPLE_FG }}>
            {PR_ICON}
          </span>
          <span style={{ color: 'var(--vk-fg-dim)' }}>Pull request</span>
          <span style={{ marginLeft: 'auto', color: 'var(--vk-fg-dim)', fontFamily: 'var(--vk-font-mono)', fontSize: 22 }}>
            #{props.number}
          </span>
        </div>

        <h2 style={{ margin: '18px 0 10px', fontSize: 42, fontWeight: 800, lineHeight: 1.25, color: 'var(--vk-fg)', overflow: 'hidden' }}>
          {titleChars.map((c, i) => (
            <span key={i} data-anim="title-char" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
              {c}
            </span>
          ))}
        </h2>
        <div style={{ fontSize: 22, color: 'var(--vk-fg-dim)' }}>
          opened by <b style={{ color: 'var(--vk-accent2)', fontWeight: 700 }}>{props.author}</b> · ready to merge
        </div>

        {/* CI 检查逐条打勾 */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--vk-line)' }}>
          {props.checks.map((c, i) => (
            <div key={i} data-anim="check-row" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0', fontSize: 24, color: 'var(--vk-fg)' }}>
              <span data-anim="check-mark" style={{ display: 'inline-flex', flex: 'none' }}>
                {CHECK_ICON}
              </span>
              {c.label}
            </div>
          ))}
          <div data-anim="passed" style={{ marginTop: 14, fontSize: 20, fontFamily: 'var(--vk-font-mono)', color: MERGE_GREEN_FG }}>
            ✓ All checks have passed
          </div>
        </div>

        {/* 观众批准:橡皮章 */}
        <div
          data-anim="stamp"
          style={{
            display: 'inline-block',
            marginTop: 22,
            padding: '10px 22px',
            borderRadius: 10,
            border: '2px solid var(--vk-accent2)',
            color: 'var(--vk-accent2)',
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'var(--vk-font-mono)',
            transformOrigin: 'center',
          }}
        >
          ✓ {props.reviewer} approved these changes
        </div>

        {/* Merge 按钮 + 鼠标指针 + 彩带 */}
        <div style={{ position: 'relative', display: 'inline-flex', marginTop: 30 }}>
          <button
            data-anim="merge-btn"
            style={{
              position: 'relative',
              border: 'none',
              borderRadius: 12,
              padding: '18px 36px',
              fontSize: 30,
              fontWeight: 700,
              fontFamily: 'inherit',
              color: '#fff',
              background: MERGED_PURPLE,
            }}
          >
            <span data-anim="label-merge">{props.mergeLabel}</span>
            <span data-anim="label-merged" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {MERGE_ICON}
                {props.mergedLabel}
              </span>
            </span>
          </button>
          <span
            data-anim="ripple"
            style={{
              position: 'absolute',
              left: '85%',
              top: '75%',
              width: 60,
              height: 60,
              margin: '-30px 0 0 -30px',
              borderRadius: '50%',
              border: '3px solid #fff',
              pointerEvents: 'none',
            }}
          />
          {CONFETTI_COLORS.flatMap((color, ci) =>
            [0, 1, 2].map((k) => (
              <i
                key={`${ci}-${k}`}
                data-anim="confetti"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 10,
                  height: 10,
                  margin: '-5px 0 0 -5px',
                  borderRadius: '50%',
                  background: color,
                  pointerEvents: 'none',
                }}
              />
            )),
          )}
          <span data-anim="cursor" style={{ position: 'absolute', left: '85%', top: '75%', pointerEvents: 'none' }}>
            {CURSOR_ICON}
          </span>
        </div>
      </div>

      {showFooter && (
        <p data-anim="footer" style={{ margin: '42px 0 0', fontSize: 26, color: 'var(--vk-fg-dim)', textAlign: 'center', letterSpacing: '0.04em' }}>
          {props.cta}
          {props.cta.length > 0 && props.handle.length > 0 ? ' · ' : ''}
          {props.handle.length > 0 && <b style={{ color: 'var(--vk-accent)', fontFamily: 'var(--vk-font-mono)', fontWeight: 700 }}>{props.handle}</b>}
        </p>
      )}
    </div>
  );
}

export const MergeSubscribeComponent = memo(MergeSubscribeComponentInner);
