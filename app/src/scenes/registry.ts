/**
 * SceneDefinition 注册表(DESIGN.md 4.3):场景经 type 查找。
 */
import type { AnySceneDefinition, SceneDefinition } from './types';
import type { BrandKit, SceneInstance } from '../types';
import { uid } from '../types';
import { bigTitle } from './core/bigTitle';
import { logoReveal } from './core/logoReveal';
import { terminal } from './geek/terminal';
import { repoCard } from './geek/repoCard';
import { glitchTitle } from './geek/glitchTitle';
import { filmstrip } from './geek/filmstrip';
import { starOutro } from './geek/starOutro';
import { mergeSubscribe } from './geek/mergeSubscribe';

const defs = new Map<string, AnySceneDefinition>();

function register<P>(def: SceneDefinition<P>): void {
  defs.set(def.type, def as unknown as AnySceneDefinition);
}

register(bigTitle);
register(logoReveal);
register(terminal);
register(repoCard);
register(glitchTitle);
register(filmstrip);
register(starOutro);
register(mergeSubscribe);

export function getSceneDef(type: string): AnySceneDefinition | undefined {
  return defs.get(type);
}

export function allSceneDefs(): AnySceneDefinition[] {
  return [...defs.values()];
}

export function brandValue(brand: BrandKit, bind: 'channel' | 'tagline' | 'handle' | 'logo'): unknown {
  switch (bind) {
    case 'channel':
      return brand.channel;
    case 'tagline':
      return brand.tagline;
    case 'handle':
      return brand.handle;
    case 'logo':
      return brand.logo;
  }
}

/** 应用 brandBindings:仍绑定的字段以 Brand Kit 值覆盖 */
export function effectiveProps(def: AnySceneDefinition, scene: SceneInstance, brand: BrandKit): Record<string, unknown> {
  const out = { ...scene.props };
  for (const m of def.meta) {
    if (m.brandBind && scene.brandBindings[m.key] !== false) {
      out[m.key] = brandValue(brand, m.brandBind);
    }
  }
  return out;
}

/** 升级旧版本场景 props 到 def 当前版本后校验 */
export function upgradeSceneProps(def: AnySceneDefinition, scene: SceneInstance): Record<string, unknown> {
  let props: unknown = scene.props;
  let v = scene.version;
  while (v < def.version) {
    const m = def.migrations?.[v];
    if (!m) throw new Error(`场景 ${def.type} 缺少 v${v} → v${v + 1} 的迁移`);
    props = m(props);
    v += 1;
  }
  return def.schema.parse(props) as Record<string, unknown>;
}

/** 新建场景实例:defaults 已物化,brandBind 字段默认绑定 */
export function instantiateScene(type: string, brand: BrandKit): SceneInstance {
  const def = getSceneDef(type);
  if (!def) throw new Error(`未注册的场景类型: ${type}`);
  const props = def.defaults(brand);
  const brandBindings: Record<string, boolean> = {};
  for (const m of def.meta) {
    if (m.brandBind) brandBindings[m.key] = true;
  }
  return {
    id: uid('scene_'),
    sceneType: type,
    version: def.version,
    props: props as Record<string, unknown>,
    brandBindings,
  };
}
