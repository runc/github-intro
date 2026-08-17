import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { TerminalProps } from './schema';

/**
 * 纯函数时间线:打字逐字符 set 序列(逐字符延迟 = 1/cps + 种子化抖动,静态求和),
 * 时长在返回时即确定;出口带 blur。
 */
export function buildTerminalTimeline(ctx: SceneBuildCtx<TerminalProps>): SceneTimeline {
  const { props, el, rng } = ctx;
  const tl = gsap.timeline();

  const term = el.querySelector<HTMLElement>('[data-anim="term"]');
  const cmdChars = el.querySelectorAll<HTMLElement>('[data-anim="cmd-char"]');
  const caret = el.querySelector<HTMLElement>('[data-anim="caret"]');
  const lines = el.querySelectorAll<HTMLElement>('[data-anim="tline"]');

  const marksIn = 0.65;
  const marksOut = 0.42;

  tl.set(cmdChars, { autoAlpha: 0 }, 0);
  tl.set(lines, { autoAlpha: 0, y: 8 }, 0);

  if (term) {
    tl.fromTo(
      term,
      { y: 70, scale: 0.95, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: marksIn, ease: 'power3.out' },
      0,
    );
  }

  // 命令打字:0.5s 后开始,逐字符延迟含种子化抖动(确定性)
  const typeRng = rng('typing');
  let cursor = 0.5;
  const times: number[] = [];
  for (let i = 0; i < cmdChars.length; i++) {
    times.push(cursor);
    cursor += 1 / Math.max(1, props.cps) + typeRng.range(0, 0.045);
  }
  cmdChars.forEach((c, i) => tl.set(c, { autoAlpha: 1 }, times[i]));

  if (caret) {
    const blinkDur = cursor - 0.4;
    if (cmdChars.length > 0 && blinkDur > 0.5) {
      // 闪烁周期数截断在可用窗口内,保证 tween 不越过场景总时长
      const cycles = Math.floor(blinkDur / 0.5) - 1;
      if (cycles >= 1) {
        tl.fromTo(caret, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, repeat: cycles - 1, yoyo: true, ease: 'none' }, 0);
      }
    }
    tl.set(caret, { autoAlpha: 0 }, cursor + 0.1);
  }

  // 输出行:逐行浮现
  let lt = cursor + 0.28;
  lines.forEach((l) => {
    tl.to(l, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, lt);
    lt += 0.21;
  });
  const holdEnd = lt + 0.65;

  if (term) {
    tl.fromTo(
      term,
      { y: 0, scale: 1, autoAlpha: 1, filter: 'blur(0px)' },
      { y: -50, scale: 0.9, autoAlpha: 0, filter: 'blur(8px)', duration: marksOut, ease: 'power3.in' },
      holdEnd,
    );
  }

  return { tl, marks: { in: marksIn, hold: holdEnd - marksIn, out: marksOut } };
}
