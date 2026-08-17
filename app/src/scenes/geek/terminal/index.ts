import type { SceneDefinition } from '../../types';
import { terminalSchema, terminalMeta, terminalDefaults, type TerminalProps } from './schema';
import { TerminalComponent } from './Component';
import { buildTerminalTimeline } from './timeline';

export const terminal: SceneDefinition<TerminalProps> = {
  type: 'geek.terminal',
  title: '终端',
  version: 1,
  kind: 'motion',
  aspects: ['16:9', '9:16', '4:3'],
  schema: terminalSchema,
  meta: terminalMeta,
  defaults: terminalDefaults,
  Component: TerminalComponent,
  buildTimeline: buildTerminalTimeline,
};
