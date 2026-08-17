import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { MergeSubscribeProps } from './schema';
import { CARD_BASE_SHADOW, CARD_MERGED_SHADOW, MERGE_GREEN, MERGE_GREEN_FG, MERGED_PURPLE, MERGED_PURPLE_FG } from './schema';

/**
 * PR 式订阅转化(全部时间点静态求出):
 *   卡片升起 → 标题逐字 → CI 逐条打勾 → 「YOU approved」橡皮章敲下 →
 *   鼠标指针飞入 → 点击(波纹 + 按压)→ 绿变紫 Merged + 彩带 → 指针退场 → CTA 收尾。
 * out = 0:末帧定格「已合并」画面,便于录屏收尾。
 */
export function buildMergeSubscribeTimeline(ctx: SceneBuildCtx<MergeSubscribeProps>): SceneTimeline {
  const { props, el, rng } = ctx;
  const tl = gsap.timeline();

  const card = el.querySelector<HTMLElement>('[data-anim="card"]');
  const prIcon = el.querySelector<HTMLElement>('[data-anim="pr-icon"]');
  const chars = el.querySelectorAll<HTMLElement>('[data-anim="title-char"]');
  const rows = el.querySelectorAll<HTMLElement>('[data-anim="check-row"]');
  const marks = el.querySelectorAll<HTMLElement>('[data-anim="check-mark"]');
  const passed = el.querySelector<HTMLElement>('[data-anim="passed"]');
  const stamp = el.querySelector<HTMLElement>('[data-anim="stamp"]');
  const btn = el.querySelector<HTMLElement>('[data-anim="merge-btn"]');
  const labelMerge = el.querySelector<HTMLElement>('[data-anim="label-merge"]');
  const labelMerged = el.querySelector<HTMLElement>('[data-anim="label-merged"]');
  const ripple = el.querySelector<HTMLElement>('[data-anim="ripple"]');
  const cursor = el.querySelector<HTMLElement>('[data-anim="cursor"]');
  const dots = el.querySelectorAll<HTMLElement>('[data-anim="confetti"]');
  const footer = el.querySelector<HTMLElement>('[data-anim="footer"]');

  // ---- 初始帧(React 渲染 merged 终态,这里退回 open 绿态) ----
  tl.set(chars, { autoAlpha: 0, y: '0.5em' }, 0);
  tl.set(rows, { autoAlpha: 0, x: -14 }, 0);
  tl.set(marks, { scale: 0 }, 0);
  tl.set(dots, { autoAlpha: 0, scale: 0.4, x: 0, y: 0 }, 0);
  if (card) tl.set(card, { autoAlpha: 0, y: 44, boxShadow: CARD_BASE_SHADOW }, 0);
  if (prIcon) tl.set(prIcon, { color: MERGE_GREEN_FG }, 0);
  if (btn) tl.set(btn, { backgroundColor: MERGE_GREEN }, 0);
  if (labelMerged) tl.set(labelMerged, { autoAlpha: 0, y: 8 }, 0);
  if (passed) tl.set(passed, { autoAlpha: 0 }, 0);
  if (stamp) tl.set(stamp, { autoAlpha: 0, scale: 1.7, rotation: -14 }, 0);
  if (cursor) tl.set(cursor, { autoAlpha: 0, x: 380, y: 300 }, 0);
  if (ripple) tl.set(ripple, { autoAlpha: 0, scale: 0.3 }, 0);
  if (footer) tl.set(footer, { autoAlpha: 0, y: 18 }, 0);

  // ---- 卡片 + 标题 ----
  if (card) {
    tl.to(card, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 0);
  }
  tl.to(chars, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.028, ease: 'power3.out' }, 0.3);

  // ---- CI 逐条打勾 ----
  const checksStart = 0.95;
  rows.forEach((row, i) => {
    const at = checksStart + i * 0.42;
    tl.to(row, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'power2.out' }, at);
    const mark = marks[i];
    if (mark) tl.to(mark, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, at + 0.18);
  });
  const checksEnd = checksStart + Math.max(0, rows.length - 1) * 0.42 + 0.55;
  if (passed) {
    tl.to(passed, { autoAlpha: 1, duration: 0.35, ease: 'none' }, checksEnd - 0.1);
  }

  // ---- 橡皮章:观众批准 ----
  const stampAt = checksEnd + 0.25;
  if (stamp) {
    tl.to(stamp, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.45, ease: 'back.out(2)' }, stampAt);
  }

  // ---- 鼠标指针飞入 ----
  const cursorAt = stampAt + 0.6;
  const clickAt = cursorAt + 0.85;
  if (cursor) {
    tl.to(cursor, { autoAlpha: 1, duration: 0.12, ease: 'none' }, cursorAt);
    tl.to(
      cursor,
      {
        keyframes: [
          { x: 150, y: 110, duration: 0.42, ease: 'power2.out' },
          { x: 0, y: 0, duration: 0.3, ease: 'power2.inOut' },
        ],
      },
      cursorAt + 0.05,
    );
    // 到位后的按压小动作
    tl.to(cursor, { scale: 0.82, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.inOut' }, clickAt);
  }

  // ---- 点击:按钮按压 + 波纹 ----
  if (btn) {
    tl.to(btn, { scale: 0.9, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.inOut' }, clickAt);
  }
  if (ripple) {
    tl.fromTo(ripple, { autoAlpha: 0.7, scale: 0.3 }, { autoAlpha: 0, scale: 1.9, duration: 0.5, ease: 'power2.out' }, clickAt);
  }

  // ---- Merge:绿 → 紫,换标,彩带 ----
  const mergeAt = clickAt + 0.22;
  if (btn) {
    tl.to(btn, { backgroundColor: MERGED_PURPLE, duration: 0.3, ease: 'power2.out' }, mergeAt);
  }
  if (labelMerge) {
    tl.to(labelMerge, { autoAlpha: 0, y: -8, duration: 0.2, ease: 'power2.in' }, mergeAt);
  }
  if (labelMerged) {
    tl.to(labelMerged, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'back.out(1.8)' }, mergeAt + 0.1);
  }
  if (prIcon) {
    tl.to(prIcon, { color: MERGED_PURPLE_FG, duration: 0.3, ease: 'none' }, mergeAt);
  }
  if (card) {
    tl.to(card, { boxShadow: CARD_MERGED_SHADOW, duration: 0.45, ease: 'power2.out' }, mergeAt);
  }

  if (props.confetti && dots.length > 0) {
    const g = rng('confetti');
    dots.forEach((d, i) => {
      const a = (i / dots.length) * Math.PI * 2 + g.range(-0.25, 0.25);
      const dist = g.range(110, 240);
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist * 0.85;
      tl.set(d, { autoAlpha: 1 }, mergeAt + 0.05);
      tl.to(
        d,
        {
          keyframes: [
            { x: dx * 0.75, y: dy * 0.75 - 40, scale: 1, duration: 0.28, ease: 'power2.out' },
            { x: dx, y: dy + g.range(90, 170), autoAlpha: 0, duration: 0.5, ease: 'power1.in' },
          ],
        },
        mergeAt + 0.05,
      );
    });
  }

  // ---- 指针功成身退 ----
  if (cursor) {
    tl.to(cursor, { x: 120, y: 160, autoAlpha: 0, duration: 0.5, ease: 'power1.in' }, mergeAt + 0.8);
  }

  // ---- CTA 收尾 ----
  const footerAt = mergeAt + 0.5;
  if (footer) {
    tl.to(footer, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out' }, footerAt);
  }
  const holdEnd = footerAt + 0.55 + 1.2;

  return { tl, marks: { in: checksEnd, hold: holdEnd - checksEnd, out: 0 } };
}
