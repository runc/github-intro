import type { SceneDefinition } from '../../types';
import { repoCardSchema, repoCardMeta, repoCardDefaults, type RepoCardProps } from './schema';
import { RepoCardComponent } from './Component';
import { buildRepoCardTimeline } from './timeline';

export const repoCard: SceneDefinition<RepoCardProps> = {
  type: 'geek.repoCard',
  title: '仓库卡片',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: repoCardSchema,
  meta: repoCardMeta,
  defaults: repoCardDefaults,
  Component: RepoCardComponent,
  buildTimeline: buildRepoCardTimeline,
};
