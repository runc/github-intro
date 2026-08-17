/**
 * 时间线组装器(DESIGN.md 4.5)
 * 输入各场景 SceneTimeline + TransitionInstance,输出一条 paused 主时间线。
 * 场景自身只声明 in/hold/out,不感知相邻场景;转场由组装器加在主时间线上。
 */
import gsap from 'gsap';
import type { TransitionInstance } from '../../types';
import type { SceneMarks } from '../../scenes/types';

export interface AssembledScene {
  tl: gsap.core.Timeline;
  marks: SceneMarks;
  el: HTMLElement;
}

export interface AssembleResult {
  master: gsap.core.Timeline;
  /** 每个场景在主时间线上的起点(秒),与 label `scene:i` 对应 */
  sceneStarts: number[];
  total: number;
}

export function marksDuration(marks: SceneMarks): number {
  return marks.in + marks.hold + marks.out;
}

export function assemble(scenes: AssembledScene[], transitions: TransitionInstance[]): AssembleResult {
  const master = gsap.timeline({ paused: true });
  const sceneStarts: number[] = [];

  if (scenes.length === 0) {
    return { master, sceneStarts, total: 0 };
  }

  // 全部场景根节点先隐藏,可见性完全由主时间线控制(硬规则 1:单一时钟)
  gsap.set(
    scenes.map((s) => s.el),
    { autoAlpha: 0 },
  );

  scenes.forEach((scene, i) => {
    const marks = scene.marks;
    const prev = i > 0 ? scenes[i - 1] : null;
    let start: number;

    if (!prev) {
      start = 0;
      master.set(scene.el, { autoAlpha: 1 }, 0);
    } else {
      const tr: TransitionInstance = transitions[i - 1] ?? { type: 'cut', overlap: 0 };
      const overlap =
        tr.type === 'cut'
          ? 0
          : Math.max(0, Math.min(tr.overlap, prev.marks.out, marks.in));
      start = sceneStarts[i - 1] + marksDuration(prev.marks) - overlap;

      if (tr.type === 'dissolve' && overlap > 0) {
        master.fromTo(scene.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: overlap, ease: 'none' }, start);
        master.to(prev.el, { autoAlpha: 0, duration: overlap, ease: 'none' }, start);
      } else {
        master.set(scene.el, { autoAlpha: 1 }, start);
        master.set(prev.el, { autoAlpha: 0 }, sceneStarts[i - 1] + marksDuration(prev.marks));
      }
    }

    master.add(scene.tl, start);
    master.addLabel(`scene:${i}`, start);
    sceneStarts.push(start);
  });

  // 总时长按契约从 marks 静态计算(硬规则 4:时长可静态计算,不依赖 GSAP 惰性初始化)
  const total = scenes.reduce(
    (max, scene, i) => Math.max(max, sceneStarts[i] + marksDuration(scene.marks)),
    0,
  );
  // 末尾 padding:hold 段可能没有 tween,补一个占位确保主时间线真实时长 = total,
  // 否则 onComplete 会早于 total 触发
  if (total > 0) {
    master.to({}, { duration: 0.001 }, Math.max(0, total - 0.001));
  }
  return { master, sceneStarts, total };
}
