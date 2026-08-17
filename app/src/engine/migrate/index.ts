/**
 * 项目级 migration 链(DESIGN.md 4.9)
 * Project.version 逐版本升级;zod 只校验升级后的数据。
 */
import type { AssetRef, DocAudio, Project } from '../../types';
import { CURRENT_PROJECT_VERSION, uid } from '../../types';

type Migration = (p: Project) => Project;

/** index = 源版本号 - 1,即 chain[v-1] 把 version v 升到 v+1 */
const CHAIN: Migration[] = [
  // version 1 → 2:doc.audio 从 { assetId, offset } 改为 { asset: AssetRef, offset }(补 volume 字段)
  (p) => ({
    ...p,
    version: 2,
    episodes: p.episodes.map((ep) => ({
      ...ep,
      documents: ep.documents.map((doc) => {
        // 输入是 v1 数据但类型标为新版,按遗留形状读取
        const legacy = (doc as typeof doc & { audio?: { assetId?: string; offset?: number; asset?: AssetRef } }).audio;
        if (!legacy || legacy.asset || legacy.assetId === undefined) return doc;
        return {
          ...doc,
          audio: { asset: { assetId: legacy.assetId, mime: 'audio/*' }, offset: legacy.offset ?? 0 },
        } as unknown as typeof doc;
      }),
    })),
  }),
  // version 2 → 3:doc.audio 单条 BGM 并入 audioTracks 多轨列表(首条 = 原铺底轨,t=0 触发)
  (p) => ({
    ...p,
    version: 3,
    episodes: p.episodes.map((ep) => ({
      ...ep,
      documents: ep.documents.map((doc) => {
        const { audio: legacy, ...rest } = doc as typeof doc & { audio?: DocAudio };
        const tracks = legacy
          ? [
              {
                id: uid('at_'),
                name: legacy.asset.name ?? 'BGM',
                asset: legacy.asset,
                start: 0,
                offset: legacy.offset,
                volume: legacy.volume ?? 0.6,
                muted: false,
              },
            ]
          : [];
        return { ...rest, audioTracks: tracks };
      }),
    })),
  }),
];

export function migrateProject(input: Project): Project {
  let p = input;
  if (!Number.isFinite(p.version) || p.version < 1) p = { ...p, version: 1 };
  while (p.version < CURRENT_PROJECT_VERSION) {
    const m = CHAIN[p.version - 1];
    if (!m) throw new Error(`没有从 version ${p.version} 升级的迁移路径`);
    p = m(p);
  }
  if (p.version > CURRENT_PROJECT_VERSION) {
    throw new Error(`项目版本 ${p.version} 高于应用支持的 ${CURRENT_PROJECT_VERSION},请升级应用`);
  }
  return p;
}
