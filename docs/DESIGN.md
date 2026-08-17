# 视频片头片尾工厂 · 产品设计方案

> 定稿日期:2026-08-15。本文档是「通用化视频包装工具」的设计基线,后续迭代以此为准。
> 修订记录:
> - 2026-08-15 评审修订:补确定性硬规则/场景契约/数据版本化,砍 anime.js,补音频决策。
> - 2026-08-15 二次修订:功能设计、技术方案、迭代计划展开为详细规格。
>
> 现有 `index.html`(单文件版 GitHub 快讲片头生成器)作为参考实现保留,其能力将在 M2 按新架构**重写**(非代码搬运——旧版是 async/await + WAAPI 流程式写法,与确定性时间线不兼容),并完整覆盖旧能力。

## 一、定位

面向内容创作者的「配置化视频片头/片尾/封面工厂」——用网页动画技术做视频包装,配置化生产,录屏导出。

**差异化**:Remotion 的表现力 + Panzoid 的开箱即用。核心壁垒是「场景组件库 + 动效预设库」,把终端打字、Glitch 标题、数字滚动、粒子场等极客动效做成乐高积木。

**竞品卡位**:

| 层级 | 代表 | 我们的机会 |
|---|---|---|
| 通用剪辑 | 剪映、Canva | 模板同质化,无开发者/极客美学 |
| 程序化视频 | Remotion、Cavalry | 要写代码,非程序员玩不转 |
| 录屏小工具 | Screen Studio、Panzoid | 不可配置、无品牌资产沉淀 |

## 二、产品边界(已决策)

**直接做通用工具。** GitHub 三场景(终端/仓库卡/标题揭示)降级为首个模板包「开源极客包」,与通用场景(Logo 落版、大字标题、订阅引导、二维码尾板、数据滚动字)平级。

- **Brand Kit(品牌资产:频道名/Logo/字体/色板/Handle)与场景数据彻底分离**——任何频道换皮即用
- 场景 schema 只声明通用字段类型(文本/颜色/数字/图片/开关)
- GitHub API 自动填充做成可选的「数据源插件」,不污染核心;未认证限额 60 次/小时,只做「手动触发 + 本地缓存」,不自动轮询
- 字体不依赖 Google Fonts(国内加载慢/不可用):内置字体自托管打包,Brand Kit 自定义字体由用户上传文件存 IndexedDB,兜底系统字体栈
- **非目标**:应用内视频合成/编码导出(见第四章导出决策)、应用内混音与音频合成、多人协作、云端存储

## 三、功能设计

### 3.1 编辑器整体布局

单页应用,四个区域:

```
┌──────────────────────────────────────────────────────────┐
│ 顶栏:项目名 · 期切换 · 文档切换(片头/片尾/封面)· 保存态 · 导出 │
├────────┬────────────────────────────────────┬────────────┤
│ 场景列表 │            舞台(Stage)             │  检查器     │
│(纵向)  │      1920×1080 等比缩放预览          │(Inspector)│
│ +场景库 │                                    │            │
├────────┴────────────────────────────────────┴────────────┤
│ 播放控制条:播放/暂停 · 进度条(带场景分段)· 速度 · 循环      │
└──────────────────────────────────────────────────────────┘
```

- **场景列表**:当前文档的场景序列,支持选中(检查器跟随)、增删、拖拽排序;底部「+ 添加场景」打开场景库(按包分组:通用包/开源极客包/已安装模板包)。
- **舞台**:始终渲染完整文档,选中某场景时进度自动 seek 到该场景 `in` 结束时刻(静帧可编辑预览)。
- **检查器**:三个 tab——「场景」(当前场景 props 表单)、「品牌」(Brand Kit)、「全局」(氛围层/音频/seed)。
- **播放控制条**:进度条按场景分段着色,可点击/拖拽 seek;M3 起升级为完整时间轴面板(见 3.8)。

### 3.2 项目 / Brand Kit / 期(Episode)

三层数据结构(详见 4.2):**项目 = Brand Kit + 若干期;每期 = 若干文档(片头/片尾/封面)**。

**项目管理**
- 启动页:项目列表(IndexedDB 内所有项目)+ 新建 + 导入(`.vkit.json` 文件 / 旧版 URL 粘贴)
- 新建项目走引导:填 Brand Kit 最小集(频道名/色板)→ 选一个模板 → 生成第一期
- 自动保存:编辑后防抖 1s 写 IndexedDB;顶栏显示保存状态
- 导出:整项目 → `.vkit.json`(资产 base64 内联);单期 → 同格式子集

**Brand Kit**
- 字段:频道名、标语、Handle、Logo(图片上传)、色板(bg / bgDeep / accent / accent2 四色 + 主题预设)、字体(标题字体/正文字体/等宽字体,内置列表 + 用户上传)
- 主题预设:GitHub 绿 / 电光紫 / 日落橙 / 香槟金(与旧版一致),选择预设仅覆盖四色
- **场景不直接存品牌字段**:场景 props 中凡语义为「品牌」的字段默认绑定 Brand Kit(如大字标题默认 = 频道名),可在检查器中断开绑定改为本期自定义值

**期(Episode)**
- 字段:期号(如 `EP.02`)、期标题、每期覆盖数据(如本期仓库信息)
- 「复制上一期」:克隆全部文档配置,期号自动 +1,清空数据源填充字段
- M3 批量管理:期列表视图,支持重命名/复制/删除/按期号排序

### 3.3 场景与场景库

场景是最小可复用单元,分两类 `kind`:

- **motion**:有时间线的动画场景,用于片头/片尾文档,固定 16:9
- **cover**:静态构图场景,用于封面文档,可声明支持多画幅(16:9 / 9:16 / 4:3)

**首发场景清单**:

| 包 | 场景 | kind | 里程碑 |
|---|---|---|---|
| 通用 core | 大字标题揭示(逐字入场 + 下划线 + 标语打字) | motion | M1 |
| 通用 core | Logo 落版(Logo 缩放定格 + 频道名 + Handle) | motion | M1 |
| 极客 geek | 终端(命令打字 + 输出滚动,命令/输出行可配置) | motion | M2 |
| 极客 geek | 仓库卡片(GitHub 风格卡片 + star 数滚动) | motion | M2 |
| 极客 geek | Glitch 标题(频道名逐字 + 故障闪现 + 期号条) | motion | M2 |
| 极客 geek | 极客封面(现有封面构图:期号/大标题/仓库卡/幽灵数字) | cover | M2 |
| 通用 core | 经典封面(大标题 + 副题 + Logo,多画幅) | cover | M3 |
| 通用 core | 订阅引导、二维码尾板、数据滚动字 | motion | M4 |

每个场景暴露的配置一律来自其 zod schema,检查器表单自动生成(见 3.5)。

### 3.4 模板(Template)

- 模板 = 场景类型的有序组合 + 转场选择 + 各场景默认 props,用于「新建文档」时一键铺场景
- 内置模板:「开源极客片头」(终端 → 仓库卡 → Glitch 标题)、「极简片头」(Logo 落版 → 大字标题)
- M4 模板包机制:模板 + 其依赖的场景默认值打包为 `.vkit-tpl.json`,支持导入/分享/版本协商

### 3.5 检查器(schema 驱动表单)

- 表单由「zod schema + 伴生 meta」自动生成,场景零表单代码
- meta 声明:label、分组、控件类型(text / textarea / color / number / slider / switch / image / select / font)、slider 范围、`live` 标记、`brandBind` 标记(默认绑定 Brand Kit 哪个字段)
- **生效策略**(与场景契约一致):`live: true` 字段(颜色、特效开关等不影响时长的纯视觉字段)实时生效;其余字段修改后进度条出现「需重建」标记,播放/seek 时自动重建时间线
- 校验失败:字段级红框 + 错误信息,不写入 store

### 3.6 播放控制

- 播放/暂停、重播、循环开关
- 进度条:按场景分段,悬停显示场景名与时刻;支持点击与拖拽 scrub(确定性时间线保证任意时刻画面唯一)
- 速度 0.5×–2×(作用于 `timeScale`,不影响导出时长语义:录制向导默认锁 1×,可显式改)
- 步进:`←/→` 一帧(1/60s),`Shift+←/→` 一秒

### 3.7 导出

**录制向导(片头/片尾)**
1. 预检:窗口是否 ≥1920×1080、`devicePixelRatio` 提示(HiDPI 屏说明录制像素)、速度是否为 1×、字体是否加载完成
2. 一键进入「纯净全屏」(旧版 `F` + `X` 合一):隐藏全部 UI,只留舞台
3. 用户启动系统录屏/OBS 后按任意键 → 3 秒倒计时(倒计时结束后画面完全干净)→ 从 0 自动播放
4. 播完定格末帧,2 秒后角落淡入「■ 可停止录制」提示(录后裁剪即可)
5. 退出向导恢复 UI

**封面导出**
- 专用 shot 路由(`/shot/:docId?aspect=16:9`):整页 1:1 展开为目标像素、无任何 UI(等价旧版 `fit=0&clean=1&shot=1`)
- 页面内嵌导出指引:DevTools「Capture node screenshot」选 `#stage`,或全屏后系统截图
- 一键 PNG 按钮:基于 DOM 截图库(html-to-image)的尽力而为导出,标注「像素级精确请用截图流程」

**音频(已决策:轻量同步,不做合成)**
- 文档可挂载一个本地音频文件(BGM/音效轨),播放/seek 时同步 `audio.currentTime`,录屏时由系统/OBS 采集
- 时间线支持命名 cue 标记,可导出 marker JSON 供剪辑软件对齐

### 3.8 时间轴面板(M3)

播放控制条升级为可编辑时间轴:

- 场景块:拖拽排序、拖拽右缘调整 `hold` 时长(`in/out` 时长归场景动效设计,不开放)
- 转场:场景块间隙点击选择转场类型(切/叠化/推移/故障闪切)与重叠时长
- cue 轨:添加/拖动命名标记(供音频对齐与 marker 导出)

### 3.9 数据源插件(GitHub)

- 检查器「场景」tab 内,凡声明了 `dataSource: 'github-repo'` 的场景显示「从 GitHub 填充」按钮
- 输入 `owner/repo` → 拉取 description / language / stars / forks → 写入对应 props(用户可再改)
- 结果按 `owner/repo` 缓存于 IndexedDB(TTL 24h);未认证限额 60 次/小时,只做手动触发
- 插件接口通用化:数据源 = `{ id, fields, fetch(params) → 部分 props }`,GitHub 是第一个实现

### 3.10 快捷键

| 按键 | 作用 |
|---|---|
| `SPACE` | 播放 / 暂停 |
| `R` | 从头重播 |
| `1`–`9` | 跳到第 N 个场景起点 |
| `←/→`、`Shift+←/→` | 步进一帧 / 一秒 |
| `S` | 切换检查器 |
| `F` | 全屏 |
| `X` | 纯净模式(隐藏全部 UI) |
| `H` | 隐藏/显示 HUD 提示 |
| `⌘S` | 立即保存 |

## 四、技术方案

### 4.1 架构总览

```
┌─ 项目(Project)   = 品牌套件(BrandKit) + 若干期(Episode)
├─ 期(Episode)     = 若干文档(Document:片头/片尾/封面)
├─ 文档(Document)  = 场景实例(SceneInstance)有序组合 + 转场 + 氛围层 + 音频 + seed
└─ 场景(Scene)     = React 组件 + zod schema + GSAP 时间线片段(经注册表按 type 查找)
```

分层原则:`engine/`(时间线、随机、氛围绘制、迁移)不依赖 React;`scenes/` 依赖 engine 与 React;`ui/` 只消费 store 与 engine 的公开接口。

### 4.2 数据模型

```ts
interface Project {
  version: number;              // 项目格式版本,migration 链依据
  id: string;
  name: string;
  brandKit: BrandKit;
  episodes: Episode[];
  updatedAt: string;
}

interface BrandKit {
  channel: string; tagline: string; handle: string;
  logo?: AssetRef;              // IndexedDB blob 引用 { assetId, mime }
  palette: { bg: string; bgDeep: string; accent: string; accent2: string };
  fonts: { heading: FontRef; body: FontRef; mono: FontRef };  // 内置 id 或 AssetRef
}

interface Episode {
  id: string; ep: string;       // 'EP.02'
  title: string;
  documents: VDocument[];
}

interface VDocument {
  id: string;
  kind: 'motion' | 'cover';
  aspect: '16:9' | '9:16' | '4:3';   // motion 固定 '16:9'
  scenes: SceneInstance[];
  transitions: TransitionInstance[]; // 长度 = scenes.length - 1
  ambient: { particles: boolean; grid: boolean; scanlines: boolean; vignette: boolean };
  audio?: { assetId: string; offset: number };
  seed: number;                  // 文档级随机种子
}

interface SceneInstance {
  id: string;
  sceneType: string;             // 注册表 key,如 'geek.terminal'
  version: number;               // 该场景 schema 的版本
  props: Record<string, unknown>;
  brandBindings: Record<string, boolean>;  // 字段是否仍绑定 BrandKit
  holdOverride?: number;         // M3 时间轴编辑
}
```

### 4.3 场景契约(M1 实现前的强约定)

场景以 `SceneDefinition` 注册:

```ts
interface SceneDefinition<P> {
  type: string;                  // 'core.bigTitle'
  version: number;
  kind: 'motion' | 'cover';
  aspects: Aspect[];             // motion 恒为 ['16:9']
  schema: z.ZodType<P>;
  meta: FieldMeta[];             // label/分组/控件/范围/live/brandBind/dataSource
  defaults: (brand: BrandKit) => P;
  Component: React.FC<SceneComponentProps<P>>;   // 只负责结构与内容
  buildTimeline: (ctx: SceneBuildCtx<P>) => SceneTimeline;
  migrations: Record<number, (old: unknown) => unknown>;  // v→v+1
}

interface SceneBuildCtx<P> {
  props: P; brand: BrandKit;
  el: HTMLElement;               // 场景根节点(组件已挂载)
  rng: (stream: string) => Rng;  // seed 派生,见 4.5
}

interface SceneTimeline {
  tl: gsap.core.Timeline;        // paused,从 0 开始
  marks: { in: number; hold: number; out: number };  // 三段时长(秒)
}
```

强约定:

- **React / GSAP 职责边界**:内容与结构(文本、DOM 树)归 React;动效属性(transform / opacity / clip-path / 绘制进度)归 GSAP 经 `el` 内的 `data-anim` 标记节点命令式操作。两者不得交叉,否则 React 重渲染会覆盖 GSAP 状态。
- **时间线纯函数化**:`buildTimeline` 返回时总时长即确定(打字类场景时长 = f(文本长度, cps),禁止播放中才知道时长)。同一 `(props, brand, seed)` 必须产出相同时间线。
- **props 失效策略**:props 变化 → 销毁并重建时间线(即「重播后生效」)。例外白名单:meta 标注 `live: true` 的纯视觉字段(颜色、特效开关)经 CSS 变量 / `gsap.quickSetter` 实时生效,不触发重建。
- **转场拼接**:组装器负责串联,场景自身只声明 `in / hold / out` 三段,不感知相邻场景。

### 4.4 确定性时间线 · 四条硬规则

「确定性」是本项目最重要的架构承诺,以下为不可协商的实现规则(旧版 `index.html` 的 async/setTimeout 流程、`Math.random()`、CSS keyframes、WAAPI 全部是反例,重写时不得沿用):

1. **单一时钟**:所有出现在导出画面内的动效必须挂在同一条 GSAP 主时间线上(或由其 tick 驱动)。禁止用 CSS animation、WAAPI、独立 rAF 做内容动效。
2. **随机必须种子化**:打字抖动、Glitch 位移、粒子初始分布等一切随机,统一走 seeded PRNG,seed 是文档配置的一部分(可存档、可复现)。
3. **Canvas 层纯函数化**:粒子/网格等绘制层实现为 `draw(t)`——给定时刻直接算出画面,禁止帧间状态累积(初始状态由 seed 决定,演化由 t 闭式计算)。
4. **时长可静态计算**:任何场景的总时长在 `buildTimeline` 返回时即确定,时间轴面板与录制向导据此工作。

### 4.5 时间线组装器与播放控制器

**组装器**(`engine/timeline/assemble.ts`):

- 输入:各场景的 `SceneTimeline[]` + `TransitionInstance[]`
- 输出:一条 paused 的主时间线。第 i+1 个场景以负偏移接入:`offset = -(scene_i.out 与 transition_i.overlap 的重叠量)`;转场自身的补间(叠化透明度、推移位移)也由组装器加在主时间线上
- 每个场景起点打 GSAP label(供「跳到第 N 场景」与进度条分段)
- 氛围层与音频经 `onUpdate` 从主时间线取 t 驱动(见 4.6 / 4.9)

**播放控制器**(`engine/timeline/player.ts`):

- 包装主时间线:`play / pause / seek / setSpeed(timeScale) / loop`
- 播放进度不进 React state:控制器暴露 `subscribeTime(cb)`,进度条组件用 ref 直接写 DOM
- **重建流程**:非 live 字段变更 → 标记 dirty → 下一次 play/seek 前:记住当前 t → 各场景 `buildTimeline` → 重新组装 → `seek(min(t, total))`

**seeded PRNG**(`engine/random/`):mulberry32;`docSeed + sceneId + stream 名` 哈希派生子流,保证「改一个场景的文本不影响另一个场景的随机」。

### 4.6 React 集成与舞台渲染

- **StageHost**:按 `document.scenes` 渲染全部场景组件(全部常驻挂载,显隐由时间线控制的 opacity/visibility 决定,避免 seek 时挂载抖动)。
- **场景挂载协议**:组件挂载完成(`useLayoutEffect`)且 `document.fonts.ready` 后才调用 `buildTimeline`——字体未就绪会导致排版尺寸不同,破坏确定性。
- 每个场景用 `gsap.context(el)` 收敛副作用,重建/卸载时 `revert()`。
- 舞台缩放:`#stage` 固定目标像素(motion 1920×1080;cover 按画幅映射,如 9:16 → 1080×1920),外层 viewport 等比 `scale` 适配窗口;shot 路由不缩放。
- live 字段通道:色板等写为 `#stage` 上的 CSS 变量(`--accent` 等),Brand Kit 换色零重建。

### 4.7 Canvas 氛围层

- `drawAmbient(ctx2d, t, config, seed)`:粒子第 i 个的位置 = `initial_i(seed) + velocity_i(seed) * t`(按舞台环绕取模),闪烁 = `sin(t·ω + phase_i(seed))`——无帧间状态,任意 t 可复现
- 星座连线 O(n²) 距离判断:粒子数上限 120,连线距离阈值内再计算,1080p 下压力可控;M4 shader 背景另行评估
- 编辑器空闲(未播放)时氛围层以「预览时钟」继续走动(仅观感),录制向导内一律走主时间线 t

### 4.8 状态管理(Zustand)

三个 slice,单 store:

| slice | 内容 | 持久化 |
|---|---|---|
| `project` | 当前项目完整数据(4.2 模型),所有编辑经 action 修改 | 防抖 1s 写 IndexedDB |
| `editor` | 选中场景、检查器 tab、面板开关、dirty 标记 | 否 |
| `playback` | isPlaying、speed、loop(低频控制态) | 否 |

播放头时刻、每帧数据一律不进 store(见 4.5)。撤销/重做基于 `project` slice 的补丁栈(zundo 或自实现,M3)。

### 4.9 持久化、资产与迁移

- **IndexedDB**(经 `idb`):`projects` 表(JSON)、`assets` 表(blob:Logo/字体/音频)。不使用 localStorage
- **资产引用**:数据模型中只存 `assetId`,渲染时经 `URL.createObjectURL` 装载;导出文件时 base64 内联,导入时还原为 blob
- **字体**:内置字体随应用打包(自托管 woff2);用户上传字体经 `FontFace` API 注册,存 assets 表
- **迁移**:`Project.version` 走全局 migration 链逐版本升级;`SceneInstance.version` 由各场景自带 `migrations` 升级;zod 只校验升级后的数据。模板包(M4)导入时做版本协商:高版本包在低版本应用中明确报错,不静默降级
- **旧 URL 一次性导入**:解析旧版全部查询参数(channel/tagline/handle/ep/title/sub/owner/repo/desc/lang/langColor/stars/forks/四色/特效开关/speed),映射为「临时 Brand Kit + 一期(片头文档:终端→仓库卡→Glitch 标题;封面文档:极客封面)」,提示保存为项目。新版不在参数空间里长期背负旧平铺格式

### 4.10 技术栈与目录结构

```
Vite + React 18 + TypeScript(严格模式)
GSAP(唯一动画引擎;不引入 anime.js / barba.js)
Zustand(store)+ zod(schema)+ idb(IndexedDB)
html-to-image(封面尽力而为导出)
Vitest(engine 单测)+ Playwright(确定性回归截图,M2 起)
```

动画引擎说明:GSAP 是唯一动画引擎——Timeline 的 seek/scrub/timeScale 最成熟,是确定性渲染的前提;v3.13 起全部插件免费。**anime.js 不引入**:它有独立时钟,动画不受 GSAP 主时间线 seek/timeScale 控制,与硬规则第 1 条直接冲突,微动效同样用 GSAP 实现。barba.js 是多页路由过渡库,SPA 编辑器用不上,场景转场用 GSAP 自实现。

```
src/
  app/            # 应用壳、路由(编辑器 / 启动页 / shot 页)
  engine/         # 不依赖 React 的核心
    timeline/     #   组装器、播放控制器、转场库
    random/       #   seeded PRNG 与派生
    ambient/      #   canvas draw(t)
    migrate/      #   项目级 migration 链
  scenes/
    core/         # 通用包(每场景一目录:schema.ts / Component.tsx / timeline.ts / index.ts)
    geek/         # 开源极客包
    registry.ts   # SceneDefinition 注册表
  store/          # zustand slices
  ui/             # 检查器、场景列表、播放条、录制向导、启动页
  io/             # indexeddb、导入导出、旧 URL 导入、github 数据源、字体装载
```

### 4.11 确定性验证(测试策略)

- engine 单测:同 seed 同 props 下 `buildTimeline` 时长与关键 tween 参数一致;PRNG 子流独立性
- 回归截图(Playwright,M2 起):固定 seed + 固定 props,对每个场景在 `t = in 中点 / hold 中点 / out 中点` 三个时刻 seek 后截图,与基线比对——这是「任意 seek 画面唯一」的可执行验收

## 五、迭代计划

原则:每个里程碑可独立交付、验收标准可执行;M2 三场景按「重写」估工作量,不按「移植」。

### M0 · 地基(约 1 周)

| 任务 | 说明 |
|---|---|
| 工程脚手架 | Vite + React + TS 严格模式 + ESLint;`engine/` 与 UI 分层的目录骨架 |
| 舞台缩放引擎 | 固定像素舞台 + viewport 等比缩放 + shot 路由(不缩放) |
| schema 基座 | zod + meta 约定(含 `live`/`brandBind`)、`version` 字段规范落地 |
| seeded PRNG | mulberry32 + 子流派生 + 单测 |
| store 骨架 | 三 slice 结构 + IndexedDB 读写(idb)+ 防抖自动保存 |

**验收**:空编辑器可跑——启动页新建项目 → 空文档 → 舞台正确缩放;刷新后项目仍在;PRNG 单测通过。

### M1 · 通用工具闭环(约 2–3 周)

| 任务 | 说明 |
|---|---|
| 时间线引擎 | 组装器(含负偏移转场)、播放控制器(play/pause/seek/speed/loop/重建流程)、`subscribeTime` |
| 场景契约落地 | `SceneDefinition` 注册表、StageHost 挂载协议(含 `fonts.ready` 门控)、gsap.context 生命周期 |
| 通用场景 ×2 | 大字标题揭示、Logo 落版(全部走契约,作为后续场景的样板) |
| Brand Kit | 品牌 tab 表单、四色 CSS 变量通道、主题预设、Logo 上传(assets 表) |
| 检查器 | schema+meta → 表单自动生成、live 实时通道、校验反馈、brandBind 断开/恢复 |
| 播放控制条 | 分段进度条、scrub、速度、步进快捷键 |
| 项目存取 | 启动页项目列表、`.vkit.json` 导出/导入(含资产内联) |

**验收**:通用工具闭环——新建项目 → 铺两个场景 → 改品牌与场景配置 → 播放/scrub 任意 seek 画面可复现 → 导出 JSON 再导入无损。

### M2 · 开源极客包 + 导出(约 2–3 周)

| 任务 | 说明 |
|---|---|
| 极客场景 ×3 | 终端 / 仓库卡片 / Glitch 标题,按新架构重写(种子化随机、纯函数时间线) |
| 极客封面 | cover kind 场景 + `【】`高亮 / `\|` 换行排版语法 |
| 氛围层 | `draw(t)` 粒子星空/星座连线/透视网格 + 扫描线/暗角,全局 tab 开关 |
| 录制向导 | 预检 → 纯净全屏 → 倒计时 → 自动播放 → 定格提示(3.7 全流程) |
| 音频挂载 | 本地音频上传、播放/seek 同步、cue 标记 + marker JSON 导出 |
| GitHub 数据源 | 插件接口 + github-repo 实现 + 24h 缓存 |
| 旧 URL 导入 | 一次性导入映射(4.9) |
| 回归截图 | Playwright 三时刻截图基线建立 |

**验收**:第七章核对表全项通过;录制向导产出的录屏与旧版观感等价或更好;固定 seed 回归截图全绿。

### M3 · 编辑器完整形态(约 2 周)

| 任务 | 说明 |
|---|---|
| 时间轴面板 | 场景拖拽排序、hold 时长拖拽、转场类型/重叠编辑、cue 轨 |
| 转场库 | 切 / 叠化 / 推移 / 故障闪切 |
| 多画幅封面 | cover 场景画幅声明与切换、经典封面场景、shot 路由多画幅 |
| 批量期管理 | 期列表视图、复制上一期(期号 +1)、重命名/删除 |
| 撤销/重做 | project slice 补丁栈 |
| 一键 PNG | html-to-image 尽力而为导出 |

**验收**:不写代码可完成「复制上期 → 改数据 → 调节奏 → 录片头 → 出三画幅封面」全流程。

### M4 · 模板生态雏形(约 2 周起)

| 任务 | 说明 |
|---|---|
| 模板包机制 | `.vkit-tpl.json` 导出/导入、版本协商(高版本明确报错) |
| 新场景 ×3 | 订阅引导、二维码尾板、数据滚动字 |
| shader 背景 | WebGL 氛围层(仍满足 `draw(t)` 确定性)评估与首个实现 |

**验收**:一个模板包能在另一台机器的全新项目中导入即用。

## 六、旧版能力清单(M2 复刻核对表)

来自 `index.html` 单文件版,全部需要在新版中保留或升级:

- [ ] 三场景片头时间线(终端 git clone 打字 → 仓库卡片 star 滚动 → 频道名逐字揭示 + Glitch)
- [ ] 封面模式(静态构图,`【】`高亮 / `|` 换行排版语法)
- [ ] 粒子星空/星座连线、透视网格、扫描线、暗角氛围层
- [ ] 主题预设(GitHub 绿/电光紫/日落橙/香槟金)+ 自定义四色
- [ ] 配置分享(新格式导出/导入);旧 URL 参数按「一次性导入」处理(见 4.9),不承诺长期兼容
- [ ] 舞台自适应缩放、shot 路由精确截图(覆盖旧版 `fit=0` / `shot=1`)
- [ ] 快捷键体系(见 3.10,覆盖旧版 SPACE/1/2/S/F/H/X)
- [ ] 播放速度 0.5×–2×

## 七、主要风险与对策

| 风险 | 对策 |
|---|---|
| React 重渲染覆盖 GSAP 状态 | 契约强制职责边界(4.3)+ 场景样板代码(M1 两个场景即样板)+ code review 清单 |
| 字体加载时序破坏确定性 | `fonts.ready` 门控后才 buildTimeline(4.6);字体自托管消除网络不确定性 |
| 「确定性」口头承诺无人验证 | Playwright 三时刻回归截图作为 CI 门禁(4.11),M2 起强制 |
| 粒子连线 O(n²) 性能 | 粒子数上限 120;超预算时降为空间网格加速或减少连线 |
| 场景越加越多、表单/迁移失控 | 表单全自动生成(3.5);每场景自带 migrations;新场景必须走 M1 样板结构 |
| 录屏路线体验上限(帧率/音画) | 已决策接受;确定性架构为未来 WebCodecs 帧渲染导出保留可能 |
