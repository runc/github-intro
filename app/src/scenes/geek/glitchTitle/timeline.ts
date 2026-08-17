import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { GlitchTitleProps } from './schema';
import { hexA } from '../../../engine/ambient/draw';

/**
 * kicker 字距收拢 → 频道名逐字 → 下划线展开 → (种子化)Glitch 爆发 → 标语打字 → 期号条。
 * out = 0:末帧定格完整标题(便于录屏收尾)。
 */
export function buildGlitchTitleTimeline(ctx: SceneBuildCtx<GlitchTitleProps>): SceneTimeline {
  const { props, el, rng, brand } = ctx;
  const tl = gsap.timeline();

  const kicker = el.querySelector<HTMLElement>('[data-anim="kicker"]');
  const chars = el.querySelectorAll<HTMLElement>('[data-anim="title-char"]');
  const charsBox = el.querySelector<HTMLElement>('[data-anim="title-chars"]');
  const underline = el.querySelector<HTMLElement>('[data-anim="underline"]');
  const gl1 = el.querySelector<HTMLElement>('[data-anim="gl1"]');
  const gl2 = el.querySelector<HTMLElement>('[data-anim="gl2"]');
  const tagChars = el.querySelectorAll<HTMLElement>('[data-anim="tag-char"]');
  const caret = el.querySelector<HTMLElement>('[data-anim="caret"]');
  const epbar = el.querySelector<HTMLElement>('[data-anim="epbar"]');

  const n = Math.max(1, chars.length);
  const charStart = 0.12;
  const stagger = 0.055;
  const charDur = 0.62;
  const burstAt = charStart + n * stagger + 0.26;
  const marksIn = burstAt + 0.54; // 下划线展开结束

  // 初始隐藏(React 渲染最终状态,GSAP 负责初始帧)
  tl.set(chars, { autoAlpha: 0, y: '0.55em', rotation: 4 }, 0);
  tl.set(tagChars, { autoAlpha: 0 }, 0);
  tl.set(epbar, { autoAlpha: 0, y: 40 }, 0);
  if (underline) tl.set(underline, { scaleX: 0 }, 0);
  if (kicker) tl.set(kicker, { autoAlpha: 0 }, 0);
  if (caret) tl.set(caret, { autoAlpha: 0 }, 0);

  if (kicker) {
    tl.fromTo(
      kicker,
      { autoAlpha: 0, letterSpacing: '.9em' },
      { autoAlpha: 1, letterSpacing: '.45em', duration: 0.8, ease: 'power2.out' },
      0,
    );
  }

  tl.to(
    chars,
    { autoAlpha: 1, y: 0, rotation: 0, duration: charDur, stagger, ease: 'power3.out' },
    charStart,
  );

  if (underline) {
    tl.fromTo(
      underline,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.7, ease: 'power2.out' },
      burstAt - 0.16,
    );
  }

  // Glitch 爆发:7 帧,每帧 clip/位移由种子化随机决定(同 seed 同画面)
  if (props.glitch && gl1 && gl2) {
    const g = rng('glitch');
    for (let i = 0; i < 7; i++) {
      const at = burstAt + i * 0.07;
      const clip1 = `inset(${g.int(0, 75)}% 0 ${g.int(0, 75)}% 0)`;
      const clip2 = `inset(${g.int(0, 75)}% 0 ${g.int(0, 75)}% 0)`;
      tl.set(gl1, { autoAlpha: 0.85, clipPath: clip1, x: g.range(-16, 16), y: g.range(-8, 8) }, at);
      tl.set(gl2, { autoAlpha: 0.85, clipPath: clip2, x: g.range(-16, 16), y: g.range(-8, 8) }, at);
    }
    tl.set([gl1, gl2], { autoAlpha: 0 }, burstAt + 7 * 0.07);
  }

  // 标语打字
  const typeRng = rng('tag-typing');
  const tagStart = burstAt + 0.38;
  let cursor = tagStart;
  const times: number[] = [];
  for (let i = 0; i < tagChars.length; i++) {
    times.push(cursor);
    cursor += 1 / Math.max(1, props.cps) + typeRng.range(0, 0.045);
  }
  tagChars.forEach((c, i) => tl.set(c, { autoAlpha: 1 }, times[i]));
  const typeEnd = cursor;

  if (caret) {
    const blinkDur = typeEnd + 0.2 - tagStart;
    if (tagChars.length > 0 && blinkDur > 0.5) {
      // 闪烁周期数截断在可用窗口内,保证 tween 不越过场景总时长
      const cycles = Math.floor(blinkDur / 0.5) - 1;
      if (cycles >= 1) {
        tl.fromTo(caret, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, repeat: cycles - 1, yoyo: true, ease: 'none' }, tagStart);
      }
    }
    tl.set(caret, { autoAlpha: 0 }, typeEnd + 0.2);
  }

  if (epbar) {
    tl.to(epbar, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, typeEnd + 0.15);
  }

  const epbarEnd = typeEnd + 0.15 + 0.6;
  const holdEnd = epbarEnd + 0.9;
  const total = holdEnd;

  // 标题辉光呼吸(旧版 CSS breathe 的确定性等价,3.4s×(repeat+1) 截断在总时长内)
  if (props.glow && charsBox) {
    const accent = brand.palette.accent;
    const cycles = Math.max(0, Math.floor(total / 3.4) - 1);
    tl.fromTo(
      charsBox,
      { filter: `drop-shadow(0 0 16px ${hexA(accent, 0.22)})` },
      { filter: `drop-shadow(0 0 44px ${hexA(accent, 0.45)})`, duration: 3.4, repeat: cycles, yoyo: true, ease: 'sine.inOut' },
      0,
    );
  }

  return { tl, marks: { in: marksIn, hold: holdEnd - marksIn, out: 0 } };
}
