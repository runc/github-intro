/**
 * 资产引用(DESIGN.md 4.9):数据模型只存 assetId,渲染时经 URL.createObjectURL 装载。
 */
import type { AssetRef } from '../types';
import { uid } from '../types';
import { deleteAsset, getAsset, putAsset, type AssetEntry } from './db';

const urlCache = new Map<string, string>();

export async function saveAssetFile(file: File | Blob, name?: string): Promise<AssetRef> {
  const assetId = uid('asset_');
  await putAsset(assetId, file);
  return { assetId, mime: file.type, name: name ?? (file instanceof File ? file.name : undefined) };
}

/** 库条目 → AssetRef;名字依赖 File 结构化克隆保留(导入路径在 projectFile 还原为 File) */
export function entryToRef(entry: AssetEntry): AssetRef {
  return {
    assetId: entry.id,
    mime: entry.blob.type,
    name: entry.blob instanceof File ? entry.blob.name : undefined,
  };
}

/** 删除资产:先回收 objectURL 与位图缓存再删 blob。调用方须确保未被任何项目引用。 */
export async function removeAsset(assetId: string): Promise<void> {
  const url = urlCache.get(assetId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(assetId);
    bitmapCache.delete(url);
  }
  await deleteAsset(assetId);
}

export async function getAssetURL(ref: AssetRef | undefined): Promise<string | undefined> {
  if (!ref) return undefined;
  const cached = urlCache.get(ref.assetId);
  if (cached) return cached;
  const blob = await getAsset(ref.assetId);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(ref.assetId, url);
  return url;
}

export function peekAssetURL(assetId: string): string | undefined {
  return urlCache.get(assetId);
}

const bitmapCache = new Map<string, HTMLImageElement>();

/** 解码后的图片位图缓存(氛围背景图等 canvas 绘制用;按 objectURL 缓存,资产内容不可变) */
export async function loadImageAsset(ref: AssetRef): Promise<HTMLImageElement | undefined> {
  const url = await getAssetURL(ref);
  if (!url) return undefined;
  const cached = bitmapCache.get(url);
  if (cached) return cached;
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    return undefined;
  }
  bitmapCache.set(url, img);
  return img;
}
