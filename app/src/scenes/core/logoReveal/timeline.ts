import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { LogoRevealProps } from './schema';

export function buildLogoRevealTimeline(ctx: SceneBuildCtx<LogoRevealProps>): SceneTimeline {
  const { el } = ctx;
  // 不设 paused:子时间线立即被组装进 paused 主时间线,由主时间线(唯一时钟)驱动
  const tl = gsap.timeline();

  const logo = el.querySelector<HTMLElement>('[data-anim="logo"]');
  const ring = el.querySelector<HTMLElement>('[data-anim="ring"]');
  const channelChars = el.querySelectorAll<HTMLElement>('[data-anim="channel-char"]');
  const handle = el.querySelector<HTMLElement>('[data-anim="handle"]');
  const tagline = el.querySelector<HTMLElement>('[data-anim="tagline"]');

  const marksIn = 1.5;
  const marksHold = 1.9;
  const marksOut = 0.5;

  if (logo) {
    tl.fromTo(logo, { scale: 0.45, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: 'back.out(1.5)' }, 0.15);
  }
  if (ring) {
    tl.fromTo(ring, { scale: 1.45, autoAlpha: 0 }, { scale: 1, autoAlpha: 0.55, duration: 0.9, ease: 'power2.out' }, 0.35);
  }
  const n = channelChars.length;
  const stagger = n > 1 ? Math.min(0.045, 0.35 / (n - 1)) : 0;
  tl.fromTo(
    channelChars,
    { yPercent: 120, autoAlpha: 0 },
    { yPercent: 0, autoAlpha: 1, duration: 0.5, stagger, ease: 'power3.out' },
    0.75,
  );
  if (handle) {
    tl.fromTo(handle, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 1.0);
  }
  if (tagline) {
    tl.fromTo(tagline, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'none' }, 1.15);
  }

  const outStart = marksIn + marksHold;
  const outTargets = [logo, ring, handle, tagline].filter(Boolean) as HTMLElement[];
  if (outTargets.length > 0) {
    tl.to(outTargets, { scale: 0.96, autoAlpha: 0, duration: marksOut, ease: 'power2.in' }, outStart);
  }
  tl.to(channelChars, { yPercent: -60, autoAlpha: 0, duration: marksOut, stagger: 0.012, ease: 'power2.in' }, outStart);

  return { tl, marks: { in: marksIn, hold: marksHold, out: marksOut } };
}
