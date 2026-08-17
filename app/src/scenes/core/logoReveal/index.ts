import type { SceneDefinition } from '../../types';
import { logoRevealSchema, logoRevealMeta, logoRevealDefaults, type LogoRevealProps } from './schema';
import { LogoRevealComponent } from './Component';
import { buildLogoRevealTimeline } from './timeline';

export const logoReveal: SceneDefinition<LogoRevealProps> = {
  type: 'core.logoReveal',
  title: 'Logo 落版',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: logoRevealSchema,
  meta: logoRevealMeta,
  defaults: logoRevealDefaults,
  Component: LogoRevealComponent,
  buildTimeline: buildLogoRevealTimeline,
};
