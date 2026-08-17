import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { StarOutroProps } from './schema';
import { fmtCount } from './schema';
import { hexA } from '../../../engine/ambient/draw';

/**
 * kicker 字距收拢 → 引导语逐字 → Star 按钮弹入(星标旋转)→ 计数滚动 →
 * 仓库链接打字(种子化抖动)→ handle/标语收尾。
 * out = 0:末帧定格完整画面,便于录屏收尾(与 glitchTitle 同一收尾语言)。
 */
export function buildStarOutroTimeline(ctx: SceneBuildCtx<StarOutroProps>): SceneTimeline {
  const { props, el, rng, brand } = ctx;
  const tl = gsap.timeline();

  const kicker = el.querySelector<HTMLElement>('[data-anim="kicker"]');
  const chars = el.querySelectorAll<HTMLElement>('[data-anim="title-char"]');
  const btn = el.querySelector<HTMLElement>('[data-anim="btn"]');
  const icon = el.querySelector<HTMLElement>('[data-anim="star-icon"]');
  const count = el.querySelector<HTMLElement>('[data-anim="star-count"]');
  const urlbar = el.querySelector<HTMLElement>('[data-anim="urlbar"]');
  const urlChars = el.querySelectorAll<HTMLElement>('[data-anim="url-char"]');
  const caret = el.querySelector<HTMLElement>('[data-anim="caret"]');
  const footer = el.querySelector<HTMLElement>('[data-anim="footer"]');

  // 初始隐藏(React 渲染最终状态,GSAP 负责初始帧)
  tl.set(chars, { autoAlpha: 0, y: '0.55em' }, 0);
  tl.set(urlChars, { autoAlpha: 0 }, 0);
  if (kicker) tl.set(kicker, { autoAlpha: 0 }, 0);
  if (btn) tl.set(btn, { autoAlpha: 0, scale: 0.5 }, 0);
  if (icon) tl.set(icon, { rotation: -160, scale: 0 }, 0);
  if (urlbar) tl.set(urlbar, { autoAlpha: 0, y: 16 }, 0);
  if (caret) tl.set(caret, { autoAlpha: 0 }, 0);
  if (footer) tl.set(footer, { autoAlpha: 0, y: 18 }, 0);

  // kicker 字距收拢
  if (kicker) {
    tl.fromTo(kicker, { autoAlpha: 0, letterSpacing: '.9em' }, { autoAlpha: 1, letterSpacing: '.45em', duration: 0.7, ease: 'power2.out' }, 0);
  }

  // 引导语逐字
  const n = Math.max(1, chars.length);
  const charStart = 0.15;
  const stagger = 0.05;
  const charDur = 0.55;
  tl.to(chars, { autoAlpha: 1, y: 0, duration: charDur, stagger, ease: 'power3.out' }, charStart);
  const titleEnd = charStart + (n - 1) * stagger + charDur;

  // Star 按钮弹入 + 星标旋转归位
  const btnAt = Math.max(0.6, titleEnd - 0.12);
  const btnDur = 0.6;
  if (btn) {
    tl.to(btn, { autoAlpha: 1, scale: 1, duration: btnDur, ease: 'back.out(1.5)' }, btnAt);
  }
  if (icon) {
    tl.to(icon, { rotation: 0, scale: 1, duration: 0.7, ease: 'back.out(1.8)' }, btnAt + 0.1);
  }

  // 计数滚动:先归零再经 proxy tween 写文本,值是 t 的确定函数
  const countAt = btnAt + 0.35;
  const countDur = 1.1;
  const countEnd = countAt + countDur;
  if (count) {
    tl.set(count, { textContent: '0' }, countAt);
    const proxy = { v: 0 };
    tl.to(
      proxy,
      {
        v: props.stars,
        duration: countDur,
        ease: 'power3.out',
        onUpdate() {
          count.textContent = fmtCount(Math.round(proxy.v));
        },
      },
      countAt,
    );
  }
  // 星标在计数落定瞬间脉冲一下
  if (icon) {
    tl.to(icon, { scale: 1.35, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, countEnd);
  }

  // 仓库链接打字(种子化抖动,同 seed 同节奏)
  const urlStart = btnAt + 0.85;
  if (urlbar) {
    tl.to(urlbar, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, urlStart);
  }
  const typeRng = rng('url-typing');
  const typeStart = urlStart + 0.35;
  let cursor = typeStart;
  urlChars.forEach((c) => {
    tl.set(c, { autoAlpha: 1 }, cursor);
    cursor += 1 / Math.max(1, props.cps) + typeRng.range(0, 0.045);
  });
  const typeEnd = urlChars.length > 0 ? cursor : typeStart;

  // 光标:打字期间闪烁,落定后再闪一次收起(闪烁周期截断在窗口内)
  if (caret) {
    const blinkEnd = typeEnd + 0.6;
    const blinkDur = blinkEnd - typeStart;
    if (blinkDur > 0.5) {
      const cycles = Math.floor(blinkDur / 0.5) - 1;
      if (cycles >= 1) {
        tl.fromTo(caret, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, repeat: cycles - 1, yoyo: true, ease: 'none' }, typeStart);
      } else {
        tl.set(caret, { autoAlpha: 1 }, typeStart);
      }
    } else {
      tl.set(caret, { autoAlpha: 1 }, typeStart);
    }
    tl.set(caret, { autoAlpha: 0 }, blinkEnd);
  }

  // handle / 标语收尾
  const footerAt = typeEnd + 0.25;
  if (footer) {
    tl.to(footer, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out' }, footerAt);
  }
  const holdEnd = footerAt + 0.55 + 1.1;

  // 按钮辉光呼吸(确定性等价 CSS breathe,截断在总时长内)
  if (props.glow && btn) {
    const accent = brand.palette.accent;
    const cycles = Math.max(0, Math.floor(holdEnd / 3.4) - 1);
    tl.fromTo(
      btn,
      { filter: `drop-shadow(0 0 14px ${hexA(accent, 0.18)})` },
      { filter: `drop-shadow(0 0 42px ${hexA(accent, 0.42)})`, duration: 3.4, repeat: cycles, yoyo: true, ease: 'sine.inOut' },
      0,
    );
  }

  const marksIn = btnAt + btnDur;
  return { tl, marks: { in: marksIn, hold: holdEnd - marksIn, out: 0 } };
}
