import type { SceneDefinition } from '../../types';
import { starOutroSchema, starOutroMeta, starOutroDefaults, type StarOutroProps } from './schema';
import { StarOutroComponent } from './Component';
import { buildStarOutroTimeline } from './timeline';

export const starOutro: SceneDefinition<StarOutroProps> = {
  type: 'geek.starOutro',
  title: '求 Star 片尾',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: starOutroSchema,
  meta: starOutroMeta,
  defaults: starOutroDefaults,
  Component: StarOutroComponent,
  buildTimeline: buildStarOutroTimeline,
};
