import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { SceneComponentProps } from '../../types';
import { filmLayout, type FilmstripProps, type RepoBrief } from './schema';
import { fmtCount } from '../repoCard/schema';

const STAR_ICON = (
  <svg viewBox="0 0 16 16" width={18} height={18} style={{ fill: 'var(--vk-fg-dim)', flex: 'none' }}>
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
);

function Frame({ repo, showStars, vertical }: { repo: RepoBrief; showStars: boolean; vertical: boolean }) {
  return (
    <div
      data-anim="frame"
      style={{
        width: 'var(--film-fw)',
        height: 'var(--film-fh)',
        flex: 'none',
        borderRadius: 14,
        padding: vertical ? '36px 44px' : '28px 32px',
        background: 'linear-gradient(160deg, color-mix(in srgb, var(--vk-bg) 90%, #fff) 0%, var(--vk-bg) 100%)',
        border: '1px solid color-mix(in srgb, var(--vk-accent) 22%, transparent)',
        boxShadow: '0 24px 60px rgba(0,0,0,.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        willChange: 'transform',
      }}
    >
      <div style={{ fontFamily: 'var(--vk-font-mono)', fontSize: vertical ? 34 : 26, lineHeight: 1.3 }}>
        <span style={{ color: 'var(--vk-fg-dim)' }}>{repo.owner}</span>
        <span style={{ color: 'var(--vk-fg-dim)' }}> / </span>
        <span style={{ color: 'var(--vk-accent2)', fontWeight: 800 }}>{repo.repo}</span>
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', fontSize: vertical ? 24 : 19, color: 'var(--vk-fg-dim)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--vk-accent)', display: 'inline-block' }} />
          {repo.lang}
        </span>
        {showStars && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--vk-fg)' }}>
            {STAR_ICON}
            {fmtCount(repo.stars)}
          </span>
        )}
      </div>
    </div>
  );
}

/** 视窗四角刻度(纯装饰,不参与动效) */
function CornerTicks({ size, color }: { size: number; color: string }) {
  const base: CSSProperties = { position: 'absolute', width: size, height: size, borderColor: color, borderStyle: 'solid' };
  return (
    <>
      <span style={{ ...base, top: -1, left: -1, borderWidth: '3px 0 0 3px', borderRadius: '4px 0 0 0' }} />
      <span style={{ ...base, top: -1, right: -1, borderWidth: '3px 3px 0 0', borderRadius: '0 4px 0 0' }} />
      <span style={{ ...base, bottom: -1, left: -1, borderWidth: '0 0 3px 3px', borderRadius: '0 0 0 4px' }} />
      <span style={{ ...base, bottom: -1, right: -1, borderWidth: '0 3px 3px 0', borderRadius: '0 0 4px 0' }} />
    </>
  );
}

function FilmstripComponentInner({ props, aspect }: SceneComponentProps<FilmstripProps>) {
  const { axis, frameW, frameH, gap } = filmLayout(aspect);
  const vertical = axis === 'y';
  const frameBorderColor = props.accentFrame
    ? 'color-mix(in srgb, var(--vk-accent) 55%, transparent)'
    : 'var(--vk-line)';

  // wrapper 只负责交叉轴居中(CSS transform);主轴位置由时间线驱动 strip 的 x/y
  const wrapperStyle: CSSProperties = vertical
    ? { position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }
    : { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' };

  return (
    <div data-anim="viewport" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* 两侧(竖屏为上下)渐隐,营造胶片在暗房中穿过的感觉 */}
      <div
        data-anim="fadeMask"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: vertical
            ? 'linear-gradient(180deg, var(--vk-bg) 0%, transparent 22%, transparent 78%, var(--vk-bg) 100%)'
            : 'linear-gradient(90deg, var(--vk-bg) 0%, transparent 20%, transparent 80%, var(--vk-bg) 100%)',
        }}
      />
      <div style={wrapperStyle}>
        <div
          data-anim="strip"
          style={{
            display: 'flex',
            flexDirection: vertical ? 'column' : 'row',
            gap,
            willChange: 'transform',
            // 布局常量经 CSS 变量下发,timeline 侧用测量的帧位置计算行程
            '--film-fw': `${frameW}px`,
            '--film-fh': `${frameH}px`,
          } as CSSProperties}
        >
          {props.candidates.map((c, i) => (
            <Frame key={i} repo={c} showStars={props.showStars} vertical={vertical} />
          ))}
        </div>
      </div>
      {/* 视窗:固定在舞台中心,胶片从其后穿过 */}
      <div
        data-anim="windowFrame"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: frameW + 36,
          height: frameH + 36,
          borderRadius: 20,
          border: `1px solid ${frameBorderColor}`,
          boxShadow: 'inset 0 0 60px rgba(0,0,0,.5)',
          pointerEvents: 'none',
        }}
      >
        <CornerTicks size={26} color={frameBorderColor} />
      </div>
      <div
        data-anim="pickLabel"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: vertical ? '16%' : '13%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: 'var(--vk-font-mono)',
          fontSize: vertical ? 30 : 24,
          letterSpacing: 4,
          color: 'var(--vk-accent)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: 'var(--vk-fg-dim)' }}>▍TODAY&apos;S PICK</span>
        <b style={{ color: 'var(--vk-fg)', fontWeight: 800 }}>{props.pickLabel}</b>
      </div>
    </div>
  );
}

export const FilmstripComponent = memo(FilmstripComponentInner);
