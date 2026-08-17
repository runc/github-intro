import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { RepoCardProps } from './schema';
import { fmtCount } from './schema';

/**
 * 入场 rotateX 24° → 0(back.out);star 数字滚动经 proxy tween onUpdate 写文本,
 * 值是 t 的确定函数;出口放大 + blur。
 */
export function buildRepoCardTimeline(ctx: SceneBuildCtx<RepoCardProps>): SceneTimeline {
  const { props, el } = ctx;
  const tl = gsap.timeline();

  const card = el.querySelector<HTMLElement>('[data-anim="card"]');
  const starEl = el.querySelector<HTMLElement>('[data-anim="stars"]');

  const marksIn = 0.76;
  const holdEnd = 2.0;
  const marksOut = 0.38;

  if (card) {
    tl.fromTo(
      card,
      { rotationX: 24, scale: 0.7, autoAlpha: 0, transformPerspective: 900 },
      { rotationX: 0, scale: 1, autoAlpha: 1, duration: marksIn, ease: 'back.out(1.2)' },
      0,
    );
    tl.fromTo(
      card,
      { scale: 1, autoAlpha: 1, filter: 'blur(0px)' },
      { scale: 1.18, autoAlpha: 0, filter: 'blur(10px)', duration: marksOut, ease: 'power3.in' },
      holdEnd,
    );
  }

  if (starEl) {
    const proxy = { v: 0 };
    tl.to(
      proxy,
      {
        v: props.stars,
        duration: 1.3,
        ease: 'power3.out',
        onUpdate() {
          starEl.textContent = fmtCount(Math.round(proxy.v));
        },
      },
      0.3,
    );
  }

  return { tl, marks: { in: marksIn, hold: holdEnd - marksIn, out: marksOut } };
}
