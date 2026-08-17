import type { SceneDefinition } from '../../types';
import { bigTitleSchema, bigTitleMeta, bigTitleDefaults, type BigTitleProps } from './schema';
import { BigTitleComponent } from './Component';
import { buildBigTitleTimeline } from './timeline';

export const bigTitle: SceneDefinition<BigTitleProps> = {
  type: 'core.bigTitle',
  title: '大字标题揭示',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: bigTitleSchema,
  meta: bigTitleMeta,
  defaults: bigTitleDefaults,
  Component: BigTitleComponent,
  buildTimeline: buildBigTitleTimeline,
};
