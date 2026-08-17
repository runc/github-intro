import type { SceneDefinition } from '../../types';
import { glitchTitleSchema, glitchTitleMeta, glitchTitleDefaults, type GlitchTitleProps } from './schema';
import { GlitchTitleComponent } from './Component';
import { buildGlitchTitleTimeline } from './timeline';

export const glitchTitle: SceneDefinition<GlitchTitleProps> = {
  type: 'geek.glitchTitle',
  title: 'Glitch 标题',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: glitchTitleSchema,
  meta: glitchTitleMeta,
  defaults: glitchTitleDefaults,
  Component: GlitchTitleComponent,
  buildTimeline: buildGlitchTitleTimeline,
};
