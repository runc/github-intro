/**
 * 资产引用扫描:遍历项目数据模型收集 assetId 的使用位置。
 * 素材库(删除保护 / 清理未使用)与 .vkit.json 导出(资产内联范围)共用,勿在单侧另写遍历。
 * 纯函数,不触 DB;assets 表是浏览器级共享的,判断占用必须扫描全部项目。
 */
import type { Project } from '../types';
import { getSceneDef } from '../scenes/registry';

/** 项目引用的全部 assetId(去重) */
export function referencedAssetIds(project: Project): Set<string> {
  const ids = new Set<string>();
  if (project.brandKit.logo) ids.add(project.brandKit.logo.assetId);
  for (const ep of project.episodes) {
    for (const doc of ep.documents) {
      if (doc.ambient.bgImage) ids.add(doc.ambient.bgImage.asset.assetId);
      for (const t of doc.audioTracks ?? []) ids.add(t.asset.assetId);
      for (const scene of doc.scenes) {
        if (scene.sfx) ids.add(scene.sfx.asset.assetId);
        if (scene.bgImage) ids.add(scene.bgImage.asset.assetId);
      }
    }
  }
  return ids;
}

/**
 * 全部项目的使用位置标签:assetId → 「项目名 · 文档名 · 用途」列表。
 */
export function scanAssetUsage(projects: Project[]): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  const add = (id: string, label: string) => {
    const list = usage.get(id);
    if (list) {
      if (!list.includes(label)) list.push(label);
    } else {
      usage.set(id, [label]);
    }
  };
  for (const project of projects) {
    if (project.brandKit.logo) add(project.brandKit.logo.assetId, `${project.name} · 品牌 Logo`);
    for (const ep of project.episodes) {
      for (const doc of ep.documents) {
        if (doc.ambient.bgImage) add(doc.ambient.bgImage.asset.assetId, `${project.name} · ${doc.name} · 背景图`);
        for (const t of doc.audioTracks ?? []) {
          add(t.asset.assetId, `${project.name} · ${doc.name} · 音轨「${t.name}」`);
        }
        for (const scene of doc.scenes) {
          if (scene.sfx) {
            const title = getSceneDef(scene.sceneType)?.title ?? scene.sceneType;
            add(scene.sfx.asset.assetId, `${project.name} · ${doc.name} · ${title} 音效`);
          }
          if (scene.bgImage) {
            const title = getSceneDef(scene.sceneType)?.title ?? scene.sceneType;
            add(scene.bgImage.asset.assetId, `${project.name} · ${doc.name} · ${title} 背景图`);
          }
        }
      }
    }
  }
  return usage;
}
