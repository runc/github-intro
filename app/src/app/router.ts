/**
 * 轻量 hash 路由:'#/'(启动页)/ '#/editor/:projectId' / '#/shot/:docId?aspect=16:9'
 */
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'launcher' }
  | { name: 'editor'; projectId: string }
  | { name: 'shot'; docId: string; aspect?: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'editor' && parts[1]) return { name: 'editor', projectId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'shot' && parts[1]) {
    const aspect = new URLSearchParams(query ?? '').get('aspect') ?? undefined;
    return { name: 'shot', docId: decodeURIComponent(parts[1]), aspect };
  }
  return { name: 'launcher' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string): void {
  location.hash = path;
}
