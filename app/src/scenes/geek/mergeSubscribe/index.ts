import type { SceneDefinition } from '../../types';
import { mergeSubscribeSchema, mergeSubscribeMeta, mergeSubscribeDefaults, type MergeSubscribeProps } from './schema';
import { MergeSubscribeComponent } from './Component';
import { buildMergeSubscribeTimeline } from './timeline';

export const mergeSubscribe: SceneDefinition<MergeSubscribeProps> = {
  type: 'geek.mergeSubscribe',
  title: '订阅 Merge 片尾',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: mergeSubscribeSchema,
  meta: mergeSubscribeMeta,
  defaults: mergeSubscribeDefaults,
  Component: MergeSubscribeComponent,
  buildTimeline: buildMergeSubscribeTimeline,
};
