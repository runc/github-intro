/**
 * .vkit.json 导入导出(DESIGN.md 4.9):资产 base64 内联,导入时还原为 blob 存 assets 表。
 */
import type { BrandKit, Project } from '../types';
import { CURRENT_PROJECT_VERSION } from '../types';
import { migrateProject } from '../engine/migrate';
import { putAsset, putProject } from './db';
import { referencedAssetIds } from './assetUsage';

interface SerializedAsset {
  mime: string;
  name?: string;
  /** base64,无 data: 前缀 */
  data: string;
}

export interface VkitFile {
  format: 'vkit-project';
  version: number;
  project: Project;
  /** 项目引用的全部资产(assetId → 内容) */
  assets: Record<string, SerializedAsset>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBlob(b64: string, mime: string, name?: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // File 而非 Blob:结构化克隆保留文件名,素材库列表依赖它
  return name ? new File([bytes], name, { type: mime }) : new Blob([bytes], { type: mime });
}

function collectAssetIds(project: Project): string[] {
  return [...referencedAssetIds(project)];
}

export async function exportProject(project: Project, getAsset: (id: string) => Promise<Blob | undefined>): Promise<VkitFile> {
  const assets: Record<string, SerializedAsset> = {};
  for (const id of collectAssetIds(project)) {
    const blob = await getAsset(id);
    if (!blob) continue;
    const name = blob instanceof File ? blob.name : undefined;
    assets[id] = { mime: blob.type, ...(name ? { name } : {}), data: await blobToBase64(blob) };
  }
  return { format: 'vkit-project', version: CURRENT_PROJECT_VERSION, project, assets };
}

/** 导入:还原资产 blob、跑迁移链、写入 IndexedDB。返回导入后的项目。 */
export async function importProject(file: VkitFile): Promise<Project> {
  if (file.format !== 'vkit-project') throw new Error('不是 .vkit.json 项目文件');
  if (file.version > CURRENT_PROJECT_VERSION) {
    throw new Error(`文件版本 ${file.version} 高于应用支持的 ${CURRENT_PROJECT_VERSION},请升级应用`);
  }
  for (const [id, a] of Object.entries(file.assets ?? {})) {
    await putAsset(id, base64ToBlob(a.data, a.mime, a.name));
  }
  const project = migrateProject(file.project);
  project.updatedAt = new Date().toISOString();
  await putProject(project);
  return project;
}

export function brandKitIsComplete(b: BrandKit): boolean {
  return b.channel.trim().length > 0;
}
