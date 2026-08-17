import { describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { assemble, marksDuration, type AssembledScene } from '../src/engine/timeline/assemble';
import type { SceneMarks } from '../src/scenes/types';

function fakeScene(inDur: number, holdDur: number, outDur: number): AssembledScene {
  const marks: SceneMarks = { in: inDur, hold: holdDur, out: outDur };
  const tl = gsap.timeline();
  const target = { v: 0 };
  tl.to(target, { v: 1, duration: marksDuration(marks) }, 0);
  return { tl, marks, el: { autoAlpha: 1 } as unknown as HTMLElement };
}

function marksOf(inDur: number, holdDur: number, outDur: number): SceneMarks {
  return { in: inDur, hold: holdDur, out: outDur };
}

describe('assemble 组装器', () => {
  it('单场景:起点 0,总时长 = in+hold+out', () => {
    const r = assemble([fakeScene(1, 2, 0.5)], []);
    expect(r.sceneStarts).toEqual([0]);
    expect(r.total).toBeCloseTo(3.5, 5);
  });

  it('切转场:第二场景紧接第一场景结束', () => {
    const r = assemble([fakeScene(1, 2, 0.5), fakeScene(1, 1, 0.5)], [{ type: 'cut', overlap: 0 }]);
    expect(r.sceneStarts[1]).toBeCloseTo(3.5, 5);
    expect(r.total).toBeCloseTo(3.5 + 2.5, 5);
  });

  it('叠化转场:第二场景以 overlap 负偏移接入', () => {
    const r = assemble(
      [fakeScene(1, 2, 0.5), fakeScene(1, 1, 0.5)],
      [{ type: 'dissolve', overlap: 0.4 }],
    );
    expect(r.sceneStarts[1]).toBeCloseTo(3.5 - 0.4, 5);
    expect(r.total).toBeCloseTo(3.1 + 2.5, 5);
  });

  it('overlap 钳制到上一场景 out', () => {
    const r = assemble(
      [fakeScene(1, 2, 0.3), fakeScene(1, 1, 0.5)],
      [{ type: 'dissolve', overlap: 5 }],
    );
    expect(r.sceneStarts[1]).toBeCloseTo(3.3 - 0.3, 5);
  });

  it('overlap 钳制到下一场景 in', () => {
    const r = assemble(
      [fakeScene(1, 2, 2), fakeScene(0.2, 1, 0.5)],
      [{ type: 'dissolve', overlap: 1 }],
    );
    expect(r.sceneStarts[1]).toBeCloseTo(5 - 0.2, 5);
  });

  it('三场景链式负偏移累积正确', () => {
    const r = assemble(
      [fakeScene(1, 1, 1), fakeScene(1, 1, 1), fakeScene(1, 1, 1)],
      [
        { type: 'dissolve', overlap: 0.5 },
        { type: 'cut', overlap: 0 },
      ],
    );
    expect(r.sceneStarts).toEqual([0, 2.5, 5.5]);
    expect(r.total).toBeCloseTo(8.5, 5);
  });

  it('空文档:总时长 0', () => {
    const r = assemble([], []);
    expect(r.total).toBe(0);
    expect(r.sceneStarts).toEqual([]);
  });

  it('labels 与 sceneStarts 对应', () => {
    const r = assemble([fakeScene(1, 1, 1), fakeScene(1, 1, 1)], [{ type: 'dissolve', overlap: 0.5 }]);
    expect(r.master.labels['scene:0']).toBeCloseTo(0, 5);
    expect(r.master.labels['scene:1']).toBeCloseTo(2.5, 5);
  });
});

describe('marksDuration', () => {
  it('三段之和', () => {
    expect(marksDuration(marksOf(1.2, 3, 0.6))).toBeCloseTo(4.8, 5);
  });
});
