import type { SceneDefinition } from '../../types';
import { filmstripSchema, filmstripMeta, filmstripDefaults, type FilmstripProps } from './schema';
import { FilmstripComponent } from './Component';
import { buildFilmstripTimeline } from './timeline';

export const filmstrip: SceneDefinition<FilmstripProps> = {
  type: 'geek.filmstrip',
  title: '胶片快讲',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: filmstripSchema,
  meta: filmstripMeta,
  defaults: filmstripDefaults,
  Component: FilmstripComponent,
  buildTimeline: buildFilmstripTimeline,
};
