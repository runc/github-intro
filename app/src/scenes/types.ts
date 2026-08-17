/**
 * 场景契约(DESIGN.md 4.3)
 * React 负责结构与内容;GSAP 经 data-anim 标记节点命令式操作动效属性。两者不得交叉。
 */
import type React from 'react';
import type { z } from 'zod';
import type { Aspect, BrandKit } from '../types';
import type { Rng } from '../engine/random';

export type ControlKind =
  | 'text'
  | 'textarea'
  | 'color'
  | 'number'
  | 'slider'
  | 'switch'
  | 'image'
  | 'select'
  | 'font'
  | 'repeater';

export interface FieldMeta {
  key: string;
  label: string;
  group?: string;
  control: ControlKind;
  min?: number;
  max?: number;
  step?: number;
  /** 纯视觉字段:修改实时生效,不触发时间线重建 */
  live?: boolean;
  /** 默认绑定 Brand Kit 的哪个字段 */
  brandBind?: 'channel' | 'tagline' | 'handle' | 'logo';
  /** 声明数据源插件(如 'github-repo'),检查器显示「从 GitHub 填充」 */
  dataSource?: 'github-repo';
  options?: { value: string; label: string }[];
  /** select:选项由当前 props 动态计算(如按列表长度生成索引) */
  optionsFn?: (props: Record<string, unknown>) => { value: string; label: string }[];
  /** select:控件值为 string,提交前转换为 number */
  coerce?: 'number';
  /** repeater:子字段定义(值类型为 itemFields 组成的对象数组);min/max 复用为项数上下限 */
  itemFields?: FieldMeta[];
  /** repeater:新增项的默认值 */
  itemDefaults?: Record<string, unknown>;
  /** repeater:项标题取值字段(如 'repo') */
  itemTitleKey?: string;
  placeholder?: string;
  /** color 控件:允许清空回退到跟随品牌色(空串语义) */
  clearable?: boolean;
}

export interface SceneBuildCtx<P> {
  props: P;
  brand: BrandKit;
  /** 场景根节点(组件已挂载) */
  el: HTMLElement;
  /** seed 派生的子流 */
  rng: (stream: string) => Rng;
}

export interface SceneMarks {
  in: number;
  hold: number;
  out: number;
}

export interface SceneTimeline {
  /** 不自行 paused:创建后立即被组装进 paused 主时间线,由主时间线(唯一时钟)驱动;返回时总时长即确定 */
  tl: gsap.core.Timeline;
  marks: SceneMarks;
}

export interface SceneComponentProps<P> {
  props: P;
  brand: BrandKit;
  /** 当前文档画幅;场景可用 CSS 变量或此值做横/竖构图 */
  aspect: Aspect;
}

export interface SceneDefinition<P> {
  /** 注册表 key,如 'core.bigTitle' */
  type: string;
  /** 场景 UI 名 */
  title: string;
  version: number;
  kind: 'motion' | 'cover';
  aspects: Aspect[];
  schema: z.ZodType<P>;
  meta: FieldMeta[];
  defaults: (brand: BrandKit) => P;
  Component: React.FC<SceneComponentProps<P>>;
  buildTimeline: (ctx: SceneBuildCtx<P>) => SceneTimeline;
  /** v → v+1 逐版本升级 props */
  migrations?: Record<number, (old: unknown) => unknown>;
}

/** 擦除泛型以便注册表统一存放 */
export type AnySceneDefinition = SceneDefinition<Record<string, unknown>>;
