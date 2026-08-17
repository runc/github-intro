import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { BigTitleProps } from './schema';

/**
 * 纯函数时间线:同一 (props, brand, seed) 产出相同时间线;
 * 时长 = f(文本长度, cps),在返回时即确定(硬规则 4)。
 */
export function buildBigTitleTimeline(ctx: SceneBuildCtx<BigTitleProps>): SceneTimeline {
  const { props, el } = ctx;
  // 不设 paused:子时间线立即被组装进 paused 主时间线,由主时间线(唯一时钟)驱动
  const tl = gsap.timeline();

  const chars = el.querySelectorAll<HTMLElement>('[data-anim="title-char"]');
  const underline = el.querySelector<HTMLElement>('[data-anim="underline"]');
  const tagChars = el.querySelectorAll<HTMLElement>('[data-anim="tag-char"]');
  const cursor = el.querySelector<HTMLElement>('[data-anim="tag-cursor"]');
  const content = el.querySelector<HTMLElement>('[data-anim="content"]');

  const charDur = 0.5;
  const stagger = 0.055;
  const titleStart = 0.2;
  const underlineStart = titleStart + Math.max(0, chars.length - 1) * stagger + 0.2;
  const underlineDur = 0.45;
  const marksIn = underlineStart + underlineDur;

  // 初始隐藏:保证任意 seek(含打字开始前)画面唯一
  tl.set(tagChars, { autoAlpha: 0 }, 0);

  tl.fromTo(
    chars,
    { yPercent: 115, autoAlpha: 0 },
    { yPercent: 0, autoAlpha: 1, duration: charDur, stagger, ease: 'power3.out' },
    titleStart,
  );
  if (underline) {
    tl.fromTo(underline, { scaleX: 0 }, { scaleX: 1, duration: underlineDur, ease: 'power2.out' }, underlineStart);
  }

  // 标语打字:零时长 set 序列,seek 任意方向都正确
  const tagStart = marksIn - 0.1;
  const cps = Math.max(1, props.cps);
  const perChar = 1 / cps;
  tagChars.forEach((c, i) => {
    tl.set(c, { autoAlpha: 1 }, tagStart + i * perChar);
  });
  const typingDur = tagChars.length * perChar;

  if (cursor) {
    if (typingDur > 0) {
      // 闪烁周期数截断在打字窗口内,保证 tween 不越过场景总时长
      const windowDur = typingDur + 0.3;
      const cycles = Math.floor(windowDur / 0.4) - 1;
      if (cycles >= 1) {
        tl.fromTo(
          cursor,
          { autoAlpha: 1 },
          { autoAlpha: 0, duration: 0.4, repeat: cycles - 1, yoyo: true, ease: 'none' },
          tagStart,
        );
      }
      tl.set(cursor, { autoAlpha: 0 }, tagStart + typingDur + 0.3);
    } else {
      tl.set(cursor, { autoAlpha: 0 }, 0);
    }
  }

  const marksHold = Math.max(1.2, typingDur + 1.0);
  const marksOut = 0.55;
  if (content) {
    tl.to(content, { yPercent: -5, autoAlpha: 0, duration: marksOut, ease: 'power2.in' }, marksIn + marksHold);
  }

  return { tl, marks: { in: marksIn, hold: marksHold, out: marksOut } };
}
