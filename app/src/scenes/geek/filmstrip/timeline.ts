import gsap from 'gsap';
import type { SceneBuildCtx, SceneTimeline } from '../../types';
import type { FilmstripProps } from './schema';

/**
 * 四相位一镜到底(DESIGN 硬规则:全部时间点静态求出,值是 t 的确定函数):
 *   P1 快进  strip 从首帧冲到末帧(power2.in,越滚越快)
 *   P2 过冲+回退  冲过半帧,再 power4.inOut 拉回今日帧
 *   P3 选中定格  今日帧放大提亮,其余帧压暗,TODAY'S PICK 标语滑入
 *   P4 出口  整体放大 + blur(与 repoCard 等场景出口语言一致)
 */
export function buildFilmstripTimeline(ctx: SceneBuildCtx<FilmstripProps>): SceneTimeline {
  const { props, el, brand } = ctx;
  const tl = gsap.timeline();

  const viewport = el.querySelector<HTMLElement>('[data-anim="viewport"]');
  const strip = el.querySelector<HTMLElement>('[data-anim="strip"]');
  const winFrame = el.querySelector<HTMLElement>('[data-anim="windowFrame"]');
  const pickLabel = el.querySelector<HTMLElement>('[data-anim="pickLabel"]');
  const frames = [...el.querySelectorAll<HTMLElement>('[data-anim="frame"]')];

  if (!viewport || !strip || frames.length === 0) {
    return { tl, marks: { in: 0.1, hold: 0.1, out: 0.1 } };
  }

  // 纵向滚动仅 9:16;scene-root 铺满舞台,宽高即舞台像素
  const vertical = el.clientHeight > el.clientWidth;
  const stageCenter = (vertical ? el.clientHeight : el.clientWidth) / 2;
  const centerOf = (f: HTMLElement) =>
    vertical ? f.offsetTop + f.offsetHeight / 2 : f.offsetLeft + f.offsetWidth / 2;
  // pos[i]:strip 平移多少可将第 i 帧居中(负向递减)
  const pos = frames.map((f) => stageCenter - centerOf(f));
  const N = frames.length;
  const today = Math.max(0, Math.min(props.today, N - 1));
  const todayFrame = frames[today];

  const at = (v: number) => (vertical ? { y: v } : { x: v });

  // ---- 相位时长(静态) ----
  const speedK = props.speed === 'fast' ? 0.72 : 1;
  const tRoll = 0.28;
  const dur1 = Math.max(1.0, Math.min(0.3 * N, 2.1)) * speedK;
  const durOver = 0.16 * speedK;
  const durRewind = Math.max(0.6, Math.min(0.35 + 0.12 * Math.abs(today - (N - 1)), 1.15)) * speedK;
  const tOver = tRoll + dur1;
  const tRewind = tOver + durOver;
  const tSel = tRewind + durRewind;
  const hold = 1.55;
  const marksOut = 0.42;

  const overDist = N > 1 ? Math.abs(pos[1] - pos[0]) * 0.55 : 80;

  // ---- 入场:视窗浮现,同时胶片已经在滚 ----
  tl.fromTo(viewport, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'none' }, 0);
  tl.set(pickLabel, { autoAlpha: 0 }, 0);

  // ---- P1 快进 ----
  tl.fromTo(strip, at(pos[0]), { ...at(pos[N - 1]), duration: dur1, ease: 'power2.in' }, tRoll);

  // 路过中心的帧放大:power2.in 的逆运算是开方,过中心时刻精确可算
  const travel = pos[0] - pos[N - 1];
  frames.forEach((f, i) => {
    if (travel <= 0) return;
    const tPass = tRoll + dur1 * Math.sqrt((pos[0] - pos[i]) / travel);
    const half = Math.min(0.11, dur1 / 2);
    const start = Math.max(tRoll, Math.min(tPass - half, tOver - 2 * half));
    if (start > tRoll) {
      tl.fromTo(f, { scale: 1 }, { scale: 1.12, duration: half, yoyo: true, repeat: 1, ease: 'sine.inOut' }, start);
    }
  });

  // 运动模糊随速度:与滚动同 ease,速度是 t 的确定函数
  const blurProxy = { v: 0 };
  tl.set(strip, { filter: 'none' }, 0);
  tl.to(
    blurProxy,
    {
      v: 6,
      duration: dur1,
      ease: 'power2.in',
      onUpdate: () => {
        strip.style.filter = blurProxy.v > 0.1 ? `blur(${blurProxy.v.toFixed(2)}px)` : 'none';
      },
    },
    tRoll,
  );

  // ---- P2 过冲 + 回退 ----
  tl.to(strip, { ...at(pos[N - 1] - overDist), duration: durOver, ease: 'power1.out' }, tOver);
  tl.to(strip, { ...at(pos[today]), duration: durRewind, ease: 'power4.inOut' }, tRewind);
  tl.to(
    blurProxy,
    {
      v: 0,
      duration: Math.min(0.45, durRewind),
      ease: 'power2.out',
      onUpdate: () => {
        strip.style.filter = blurProxy.v > 0.1 ? `blur(${blurProxy.v.toFixed(2)}px)` : 'none';
      },
    },
    Math.max(tRoll, tSel - Math.min(0.45, durRewind)),
  );

  // ---- P3 选中定格 ----
  const accent = brand.palette.accent;
  if (todayFrame) {
    tl.fromTo(
      todayFrame,
      { scale: 1, boxShadow: '0 24px 60px rgba(0,0,0,.55)' },
      { scale: 1.32, boxShadow: `0 30px 90px rgba(0,0,0,.6), 0 0 0 3px ${accent}, 0 0 80px ${accent}44`, duration: 0.5, ease: 'back.out(1.5)' },
      tSel,
    );
  }
  frames.forEach((f, i) => {
    if (i !== today) {
      tl.to(f, { autoAlpha: 0.14, duration: 0.45, ease: 'power2.out' }, tSel);
    }
  });
  if (winFrame) {
    tl.fromTo(
      winFrame,
      { boxShadow: 'inset 0 0 60px rgba(0,0,0,.5)' },
      { boxShadow: `inset 0 0 60px rgba(0,0,0,.5), 0 0 70px ${accent}33`, duration: 0.55, ease: 'power2.out' },
      tSel,
    );
  }
  if (pickLabel) {
    tl.fromTo(pickLabel, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, tSel + 0.12);
  }

  // ---- P4 出口 ----
  tl.fromTo(
    viewport,
    { scale: 1, autoAlpha: 1, filter: 'blur(0px)' },
    { scale: 1.08, autoAlpha: 0, filter: 'blur(10px)', duration: marksOut, ease: 'power3.in' },
    tSel + hold,
  );

  return { tl, marks: { in: tSel, hold, out: marksOut } };
}
