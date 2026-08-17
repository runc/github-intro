/**
 * IndexedDB 持久化(DESIGN.md 4.9):projects 表存 JSON,assets 表存 blob。不使用 localStorage。
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from '../types';

interface VkitDB extends DBSchema {
  projects: { key: string; value: Project };
  assets: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<VkitDB>> | null = null;

function db(): Promise<IDBPDatabase<VkitDB>> {
  dbPromise ??= openDB<VkitDB>('vkit', 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets');
    },
  });
  return dbPromise;
}

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll('projects');
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await db()).get('projects', id);
}

export async function putProject(p: Project): Promise<void> {
  await (await db()).put('projects', p);
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  await d.delete('projects', id);
}

export async function putAsset(id: string, blob: Blob): Promise<void> {
  await (await db()).put('assets', blob, id);
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return (await db()).get('assets', id);
}

export interface AssetEntry {
  id: string;
  blob: Blob;
}

/** 素材库列表:getAllKeys 与 getAll 同序返回,按位配对 */
export async function listAssetEntries(): Promise<AssetEntry[]> {
  const d = await db();
  const [ids, blobs] = await Promise.all([d.getAllKeys('assets'), d.getAll('assets')]);
  return ids.map((id, i) => ({ id, blob: blobs[i] }));
}

export async function deleteAsset(id: string): Promise<void> {
  await (await db()).delete('assets', id);
}
