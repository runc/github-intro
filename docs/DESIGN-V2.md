# 视频片段工厂 V2 · 设计草稿

> 起草日期:2026-08-15。本文档是 V1(`docs/DESIGN.md` + `app/`)的通用化重设计,定位从「片头片尾工厂」升级为「**NLE 伴侣型视频片段工厂**」。
> 输入:V1 代码现状评估、FableCut 调研、motion-anything 调研(三份调研结论已内化到本文,关键出处在各节标注)。
> 状态:**草稿(Draft)**——功能草稿 + 技术选型 + 迭代计划,评审通过后替代 DESIGN.md 成为基线。

---

## 一、V1 复盘:为什么不够通用

V1 的架构底子是好的,问题出在「产品形态」而不是「工程质量」:

### 1.1 V1 已经做对的(V2 全部保留)

| 资产 | 位置 | 价值 |
|---|---|---|
| 确定性时间线四硬规则(单一 GSAP 时钟 / 种子化随机 / Canvas `draw(t)` 纯函数 / 时长静态可算) | `engine/timeline`、`engine/random`、`engine/ambient` | **V2 一切导出与 agent 能力的地基**:任意 `seek(t)` 画面唯一,才能逐帧渲染 |
| SceneDefinition 契约(schema/meta/Component/timeline 四件套 + 注册表) | `scenes/types.ts`、`registry.ts` | 检查器零表单代码、场景可版本化迁移 |
| Brand Kit 与场景 props 分离 + brandBindings | `types.ts`、`store` | 换皮即用,品牌资产沉淀 |
| StageHost 挂载协议(fonts.ready 门控、gsap.context、timelineRev 重建) | `ui/StageHost.tsx` | 解决 React 与 GSAP 冲突的关键路径 |
| 固定像素舞台 + viewport 等比缩放 + shot 路由 | `ui/StageViewport.tsx`、`ShotPage.tsx` | 像素精确输出的基础 |
| IndexedDB + `.vkit.json`(资产 assetId 引用、导出内联) | `io/` | 本地优先、可分享 |

### 1.2 V1 的结构性短板(V2 要解决的问题)

1. **用户不写代码就造不出新动画。** 场景 = TypeScript + GSAP 代码,新增场景要改 5 处文件。用户只能填 5 个预制场景的表单,这是「配置器」不是「工具」。
2. **内容硬编码。** 终端命令写死 `git clone github.com/...`、仓库卡默认 GitHub 语义、主题预设写死 4 套——工具与「GitHub 频道片头」这个用例焊死了。
3. **素材能力残缺。** 只能传 Logo 图片;视频、音频、自定义字体都进不来。做 b-roll、垫片类片段无从谈起。
4. **导出全靠外部录屏。** 无应用内视频导出,无 alpha 通道输出——而「给剪辑软件叠加用的片段」恰恰最需要透明底。
5. **产出物单一。** 只有 16:9 片头/片尾两种文档语义,没有 lower-third、转场遮罩、背景循环、字幕条等「片段」概念。
6. **对 AI 完全关闭。** 项目文件格式没有文档化为 agent 契约,没有任何程序化接口。

**结论:V1 是「GitHub 片头配置器」;V2 要成为「任何视频创作者的片段工厂」。地基(确定性时间线)不动,上层产品形态重做。**

---

## 二、借鉴分析:两个参考项目各拿什么

### 2.1 FableCut(浏览器 NLE + agent 驱动)

| 拿走 | 说明 |
|---|---|
| **项目文件即接口** | 单一 JSON 文档 = UI / Agent / 脚本的统一真相源;`revision` 乐观并发 + SSE 热重载,人机共编 |
| **MCP + patch 语义** | `get(compact)` → `patch(小 ops)` → 热重载可见;token 友好,比整树 PUT 可靠 |
| **AGENT.md 手册模式** | schema + 语义 + recipes + 禁忌写在一处,MCP 可分章节拉取 |
| **预览与导出共用同一合成器/时钟** | 避免「编辑一套、渲染另一套」的偏差 |
| **素材库「目录即库」+ 引用不复制** | `library/` 约定目录,src 按路径引用 |

| 不拿走 | 原因 |
|---|---|
| 完整多轨 NLE(多轨/调色/抠像/嵌套) | 我们不做剪映,片段工厂不需要;这是 FableCut 的包袱不是财富 |
| 零依赖单体 app.js(6000 行) | 保持 V1 的 TS + 模块化 + 测试工程形态 |
| 逐帧 JPEG POST 上传的导出管线 | 我们的确定性 seek 架构支持更干净的无头渲染(见第六章) |
| Google Fonts 自动拉取 | 国内不可用,坚持字体自托管 + 用户上传 |

FableCut 的最大缺口——**agent 无法无头导出成片**(合成器困在浏览器里)——正是我们确定性架构能补上的差异化能力。

### 2.2 motion-anything(agentic 动效层)

| 拿走 | 说明 |
|---|---|
| **层 + 属性关键帧轨的声明式模型** | `layers[] + tracks: { opacity/x/y/scale/rotate/blur: [{t,v,ease}] }`——用数据而非代码描述动效,这是「无代码自定义动画」的钥匙 |
| **动效动词(verbs)+ 触发分类** | 入场 8 动词(fade/slide/zoom/blur/typewriter…)、强调动词(pop/pulse/shake…)作为预设,普通用户选动词,高级用户开关键帧轨 |
| **品味契约(MOTION-SPEC)** | 时长 token、缓动 token、克制预算(≤3 同时入场、stagger 40–80ms、≤1 ambient loop)——写进预设库设计规范与检查器提示 |
| **可 seek 时间轴 = 导出契约** | 任何「动画 → 视频」问题先解决确定性时间;我们已有 |
| **WebCodecs `VideoEncoder` + mp4-muxer 浏览器内出片** | 零安装、无水印、本地出 MP4 的成熟路径 |
| **配方 manifest 的灵魂三字段** | `intent_keywords` / `avoid_when` / `restraint`,进场景/预设元数据 |

| 不拿走 | 原因 |
|---|---|
| 双轨序列化(DOM 属性 vs Canvas JSON 两套) | 它自己的最大债务;我们统一在「一条 GSAP 主时间线 + 一种文档格式」上 |
| foreignObject 栅格化作为主导出路径 | 丢 canvas/WebGL/跨域资源,保真度不可控;只作浏览器内导出的实现细节之一 |
| 218 配方的规模优先策略 | 片段工厂要的是 20 个精品预设,不是 200 个参考卡 |
| 对话生成整页(agentic codegen)作为核心交互 | V2 的核心交互仍是确定性编辑器;agent 是接口层不是生成引擎 |

---

## 三、V2 定位与边界

### 3.1 一句话定位

**面向所有视频创作者的「片段工厂」:用网页动画技术,确定性地生产可直接进任何剪辑软件的短片段(2–20 秒)——片头、片尾、标题卡、lower-third、转场遮罩、背景 b-roll、数据卡、订阅引导——支持透明通道导出与 AI agent 驱动。**

### 3.2 与剪映/NLE 的关系:伴侣,不是替代

用户的成片工作流在剪映/Premiere/FCP/DaVinci 里完成;我们产出的是他们时间线上的**素材**。因此:

- **不做**:多轨剪辑、素材修剪、调色、混音、字幕逐句编辑、成片导出
- **专做**:单个片段的动效编排 + 品牌一致性 + 批量复用(每期换数据) + 各种 NLE 友好的导出格式(尤其 **alpha 通道**)

### 3.3 差异化(竞品卡位更新)

| 层级 | 代表 | 我们的机会 |
|---|---|---|
| 通用剪辑 | 剪映、Canva | 模板同质化;导不出带 alpha 的叠加素材;无品牌资产沉淀 |
| 程序化视频 | Remotion、Motion Canvas | 要写代码;非程序员玩不转 |
| 动效模板站 | Panzoid、mixkit | 不可深度配置;无本地隐私;无 agent 接口 |
| agent 剪辑 | FableCut | 是 NLE 不是片段工厂;无 Brand Kit;**无法无头导出** |

**三个壁垒**:① 确定性时间线带来的像素级无头渲染(含 alpha);② Brand Kit + 期(Episode)的「栏目化批量生产」;③ 项目文件即 agent 契约(MCP 一句话出片段)。

### 3.4 非目标(明确不做)

- 应用内多轨 NLE 与成片合成
- 云端存储、多人协作、账号体系
- 在 2D 合成里假装 WebGL(WebGL 氛围层单独评估,不可 seek 的特效不承诺可导出——学 motion-anything 的架构诚实)
- AI 生成素材(文生图/文生视频);agent 只操作文档,不生成像素

---

## 四、功能设计

### 4.1 核心概念:一切皆场景,场景分三层

V1 的问题不是「场景」抽象错了,而是场景只有「代码实现」一种形态。V2 把创作能力分三层,**全部运行在同一条确定性 GSAP 主时间线上**:

```
L1 预设层(人人可用)   选片段类型 → 选风格模板 → 填内容 → 导出
L2 编排层(进阶用户)   Composer 场景:自由摆放元素层,给每层选动效动词/时序,可开关键帧轨
L3 配方层(开发者)     代码场景(terminal、粒子、glitch 等复杂效果),走 V1 的 SceneDefinition 契约
```

**关键架构决策:L2 的 Composer 本身就是一个内置的「最通用配方场景」**——它的 props 是一份声明式的 layers 数据(见 5.3),`buildTimeline` 读数据生成 GSAP 时间线。这样 L2/L3 在引擎眼里没有区别,组装器、播放器、导出器、agent 接口全部只面对一种东西:场景实例序列。不重蹈 motion-anything「双轨序列化」的覆辙。

### 4.2 片段类型(Segment Kind)

文档语义从 V1 的「片头/片尾/封面」扩展为片段类型体系,每种类型带默认画幅、时长范围、导出建议:

| 类型 | 典型时长 | 默认底 | 导出建议 | 里程碑 |
|---|---|---|---|---|
| 片头 intro | 5–15s | 不透明 | MP4 | M1 |
| 片尾 outro | 5–20s | 不透明 | MP4 | M1 |
| 标题卡 title-card | 3–6s | 不透明/透明 | MP4 / WebM-alpha | M1 |
| lower-third(人名条/信息条) | 4–8s | **透明** | WebM-alpha / ProRes4444 | M3 |
| 转场遮罩 transition-stinger | 0.5–2s | **透明** | WebM-alpha + 遮罩 luma | M3 |
| 背景 b-roll(循环氛围底) | 5–15s 可循环 | 不透明 | MP4(首尾帧闭合循环) | M3 |
| 数据卡/引用卡 | 4–8s | 透明/不透明 | WebM-alpha / MP4 | M3 |
| 封面/静帧 cover | — | 不透明 | PNG | M1(承接 V1) |

画幅全面开放:16:9 / 9:16 / 1:1 / 4:3 / 21:9 + 自定义像素(V1 写死三档的 `ASPECT_PIXELS` 改为配置)。

### 4.3 元素层(Layer)与动效动词(Verb)

Composer 场景的构成单元:

**层类型**:`text`(单行/多行/逐字排版)、`image`、`video`(本地素材,seek 同步主时钟)、`shape`(矩形/圆/线/多边形,支持描边绘制动画)、`svg`、`group`(编组共享变换)。

**每层三段式动效**(与 V1 场景的 in/hold/out 同构):

- **入场动词**:fade / slide(四向) / zoom / blur-in / wipe / typewriter(text 专属) / draw(shape/svg 专属) / pop
- **强调动词**(hold 期间,可选):pulse / float / shimmer / count-up(数字滚动)
- **离场动词**:入场动词的逆 + cut
- 每个动词带参数:时长(用品味 token:`fast 160–300ms / base 300–500ms / slow 500–800ms / cinematic 800–2000ms`)、缓动(`ease-out / ease-in / ease-in-out / spring-soft / spring-snappy`)、延迟/stagger

**高级模式:关键帧轨**。任一层可从「动词模式」切换到「轨道模式」,暴露 6 条属性轨 `opacity / x / y / scale / rotate / blur`,轨道为 `[{ t, v, ease }]`(t 归一化到该层生命周期)。动词本质是关键帧轨的宏——「从动词展开为轨」单向可行(学 motion-anything 的 `seedTracksFromEffect`),便于用户从预设起步再微调。

**品味护栏**(MOTION-SPEC 本地化,做成软约束):同屏同时入场 >3 层、stagger <40ms、强调动词 >1 个时,检查器出现黄色提示(不阻止)。预设库自身必须满足预算。

### 4.4 配方场景(L3)通用化改造

V1 的 5 个场景保留,但内容语义彻底解耦:

- **terminal** → 通用终端:命令序列 `[{ prompt, command, outputs[] }]` 完全可配置,GitHub clone 只是默认值示例
- **repoCard** → 通用信息卡:标题/副题/标签/两组统计数字(图标可换),GitHub 仓库只是一种填法;`dataSource` 仍可选装 GitHub 插件自动填充
- **glitchTitle / bigTitle / logoReveal** → 去掉「频道」语义硬编码,字段全部走 brandBind 可断开
- 新增配方场景的准入清单:schema 无产品专名、defaults 从 Brand Kit 派生、元数据带 `intent_keywords / avoid_when / restraint`

### 4.5 素材系统

- **可导入**:图片、视频(mp4/webm/mov)、音频、字体(woff2/ttf,经 FontFace 注册)、SVG——全部进 IndexedDB assets 表,模型只存 `assetId`
- **视频层同步**:video 层由主时间线 `onUpdate` 驱动 `video.currentTime = f(t)`,seek/导出逐帧对齐(FableCut 同款语义)
- **内置素材库**:约定目录打包少量 CC0 形状/纹理/图标;不做在线素材市场
- **修复 V1 缺口**:`.vkit.json` 导出时递归收集场景 props 内的全部 assetId(V1 只收集 logo 与 audio,会漏资产)

### 4.6 Brand Kit 升级

- 色板从写死 4 槽升级为「4 核心槽 + 可扩展命名 token」,全部落 `#stage` CSS 变量,live 换色零重建
- 字体三槽(heading/body/mono)支持用户上传;内置字体自托管(坚持不依赖 Google Fonts)
- 新增:默认动效风格(缓动偏好 + 节奏偏好 fast/normal/cinematic),预设应用时读取

### 4.7 模板与预设生态

- **风格模板**:片段类型 × 风格(极客/极简/杂志/霓虹…)= 一键铺好的 Composer 层组合或配方场景序列,带 `intent_keywords` 供搜索与 agent 路由
- **模板包 `.vkit-tpl.json`**:数据文件(场景序列 + 默认 props + 依赖的场景类型与版本),导入时版本协商,高版本明确报错——纯数据,无代码分发问题
- **「复制上一期」**保留:栏目化批量生产是核心留存功能

### 4.8 编辑器形态

V1 四区布局不变(场景列表 / 舞台 / 检查器 / 播放条),增量:

- 场景列表升级为「片段结构树」:场景 → 层(Composer 场景可展开),选中层时检查器显示该层的动词/轨道面板
- 播放条:V1 分段进度条保留;M3 升级带层泳道的简易时间轴(只读层时序 + 拖拽层的 delay/时长,不做完整关键帧曲线编辑器)
- 新建入口改为「选片段类型 → 选风格模板」两步

---

## 五、数据模型

### 5.1 项目结构(V1 演进,非重写)

```
Project = BrandKit + Episode[]
Episode = Segment[]                       // V1 的 VDocument 更名为 Segment
Segment = { kind: SegmentKind; aspect; background: 'opaque'|'transparent';
            scenes: SceneInstance[]; transitions; ambient; audio?; seed;
            loop?: boolean }              // b-roll 循环标记
SceneInstance = { id; sceneType; version; props; brandBindings; holdOverride? }
```

`Project.version` bump 一次,V1→V2 走 migration 链(VDocument→Segment 字段映射,旧 kind 'motion'→'intro'/'outro' 按文档名推断或默认 intro)。

### 5.2 场景契约(不变 + 元数据扩展)

`SceneDefinition` 保持 V1 形态,新增:

```ts
interface SceneDefinition<P> {
  // ...V1 全部字段不变...
  intentKeywords?: string[];    // agent/搜索路由
  avoidWhen?: string[];         // 品味元数据
  restraint?: string;           // 该场景自身的克制说明
  segmentKinds?: SegmentKind[]; // 适用的片段类型(默认全部)
}
```

### 5.3 Composer 场景的 props(核心新增,即「动效即数据」)

```ts
interface ComposerProps {
  layers: Layer[];
}

interface Layer {
  id: string;
  type: 'text' | 'image' | 'video' | 'shape' | 'svg' | 'group';
  content: TextContent | AssetContent | ShapeContent;  // 按 type 判别
  // 静态布局(相对 1920×1080 设计空间的百分比坐标,画幅切换按锚点重排)
  frame: { x: number; y: number; w?: number; h?: number; anchor: Anchor };
  style: { color?: string; font?: FontRef; opacity?: number; /* … */ };
  // 时序:相对场景 in 起点的延迟与各段时长
  timing: { delay: number; in: number; hold: 'fill' | number; out: number };
  // 动效:动词模式 或 轨道模式,二选一
  motion:
    | { mode: 'verbs'; enter: VerbSpec; emphasis?: VerbSpec; exit: VerbSpec }
    | { mode: 'tracks'; tracks: Partial<Record<TrackProp, Keyframe[]>> };
}

type TrackProp = 'opacity' | 'x' | 'y' | 'scale' | 'rotate' | 'blur';
interface Keyframe { t: number; v: number; ease?: EaseToken }   // t ∈ [0,1]
interface VerbSpec { verb: string; duration: DurToken | number; ease: EaseToken;
                     stagger?: number; params?: Record<string, unknown> }
```

约束(沿用确定性硬规则):`buildComposerTimeline(props)` 是纯函数,总时长 = max(各层 delay+in+hold+out) 静态可算;typewriter 等内容相关时长 = f(文本长度, cps);随机(如 glitch 抖动)一律走 seeded PRNG。

### 5.4 项目文件即 agent 契约

- `.vkit.json` 的 JSON Schema 正式化(zod → JSON Schema 导出),连同语义说明写入 `AGENT.md`(FableCut 的 CLAUDE.md 模式:schema + 语义 + recipes + 禁忌,分章节可拉取)
- serve 模式下文件带 `revision`,写入必须递增;SSE 通知编辑器热重载

---

## 六、导出体系(V2 最重要的产品升级)

三层导出,逐层升级保真度与格式;**全部建立在同一个前提上:主时间线 `seek(t)` 后画面确定**。

### 6.1 Tier 0 · 录屏向导(保底,承接 V1 规划)

纯净全屏 → 倒计时 → 自动播放 → 定格提示。零依赖,永远可用。M1 落地(V1 只写了设计没实现)。

### 6.2 Tier 1 · 浏览器内导出(零安装,默认路径)

- **管线**:逐帧 `player.seek(t)` → 舞台栅格化 → `VideoEncoder`(WebCodecs)→ mp4-muxer → 下载 MP4
- **栅格化策略**:DOM 场景经 SVG foreignObject 序列化绘制到 canvas;Canvas 氛围层直接 `draw(t)` 叠加;video 层帧等 `seeked` 事件后绘制(motion-anything 的 html-capture 同款,但我们逐层合成而非整页序列化,规避字体/canvas 丢失问题——字体已自托管 + FontFace 注册,foreignObject 内联 @font-face data URL)
- **能力边界(诚实声明)**:WebGL 层不支持;跨域资源不支持(本地优先架构下基本不存在);输出 H.264 MP4,无 alpha
- **音频**:挂载的音频经 OfflineAudioContext 离线渲染混入

### 6.3 Tier 2 · CLI 无头渲染(专业路径 + agent 闭环)

`vkit` 本地 CLI(Node),核心命令:

```
vkit render <project.vkit.json> --segment <id> \
  --format mp4|webm-alpha|prores4444|png-seq|gif \
  --fps 60 --scale 2
```

- **管线**:CLI 起本地静态服务加载应用的 render 路由 → Playwright/CDP 无头 Chromium → 对每帧 `seek(t)` + `captureScreenshot(omitBackground: transparent)` → 管道给 ffmpeg 编码
- **像素真相**:真实 Chromium 渲染,和编辑器预览完全同源——没有 foreignObject 损耗,支持一切 DOM/Canvas 效果
- **alpha 通道**:透明底片段输出 WebM(VP9 yuva420p)/ ProRes 4444 / PNG 序列——lower-third、转场遮罩、叠加卡的生命线,也是对剪映/Panzoid 的核心差异化
- **依赖策略**:ffmpeg 检测系统安装(提示安装指引),Chromium 用 playwright-core 复用系统 Chrome;CLI 自身依赖最小化
- **这就是 agent 的无头出片能力**:FableCut 做不到的闭环,我们靠确定性架构天然获得

### 6.4 导出矩阵

| 产物 | Tier | 用途 |
|---|---|---|
| MP4 (H.264) | 1 / 2 | 片头片尾/标题卡直接进 NLE |
| WebM alpha (VP9) | 2 | 剪映/达芬奇叠加素材 |
| ProRes 4444 | 2 | FCP/Premiere 专业叠加 |
| PNG 序列 | 2 | 万能兜底 |
| GIF | 2 | 预览/社交分享 |
| PNG 静帧 | shot 路由(1) + CLI(2) | 封面 |
| marker JSON | 1 | cue 标记导给剪辑软件对齐 |

---

## 七、Agent 集成(FableCut 模式移植)

### 7.1 三种等价控制面

1. **文件**:直接读写 `.vkit.json`(bump revision),编辑器 SSE 热重载
2. **REST**:`vkit serve` 提供 `GET/PATCH /api/project`(compact 摘要 + patch ops)、`GET /api/events`(SSE)、`POST /api/render`
3. **MCP**:stdio server 封装上述能力

### 7.2 MCP 工具面(最小集)

| 工具 | 作用 |
|---|---|
| `vkit_status` | 拉起 serve,返回项目摘要 |
| `vkit_docs` | 按章节读 AGENT.md(schema/语义/recipes) |
| `vkit_get_project` | 全量或 compact(一行一场景/一层) |
| `vkit_patch` | 小粒度 ops:add/update/remove scene/layer、set brand、set props |
| `vkit_import_asset` | 导入素材并注册 assetId |
| `vkit_render` | **无头导出片段**(Tier 2),返回产物路径 |

### 7.3 典型 agent 场景(写进 AGENT.md recipes)

- 「给我的频道来一个霓虹风 9:16 片头,频道名 XX」→ 选风格模板 → 写 Brand Kit → patch props → render
- 「照上一期复制一份,期号 +1,标题换成 YY,导出」→ duplicate episode → patch → render
- 「做一个人名条,张三/产品经理,透明底」→ lower-third 模板 → patch → render webm-alpha

品味预算同样约束 agent:AGENT.md 明确写入克制规则与 avoid_when,预设元数据供其路由。

---

## 八、技术选型

### 8.1 保留(V1 已验证)

```
Vite + React 18 + TypeScript 严格模式
GSAP            — 唯一动画引擎(时间线 seek/scrub 最成熟,确定性前提;继续禁 CSS animation/WAAPI/独立 rAF 做内容动效)
Zustand + zod + idb
Vitest + Playwright(确定性回归截图,三时刻基线)
```

### 8.2 新增

| 选型 | 用途 | 决策理由 |
|---|---|---|
| **WebCodecs + mp4-muxer** | Tier 1 浏览器内导出 | motion-anything 验证过的成熟组合;零服务端、无水印 |
| **playwright-core(CDP)** | Tier 2 无头渲染截帧 | 真实 Chromium 像素;`omitBackground` 出 alpha;与回归截图共用技术栈 |
| **ffmpeg(系统依赖,CLI 检测)** | Tier 2 编码 | ProRes/VP9-alpha/GIF 无替代;不打包进应用,学 FableCut 的检测 + 指引 |
| **Node CLI(`vkit`)** | serve / render / MCP 宿主 | 依赖最小化;与 app 同仓库共享 engine 类型 |
| **OfflineAudioContext** | Tier 1 音频离线混渲 | 浏览器原生 |

### 8.3 明确不引入

- Remotion(整套 React 帧渲染范式与 GSAP 时间线冲突,且引入服务端渲染复杂度)
- anime.js / CSS keyframes(V1 结论不变:独立时钟破坏确定性)
- Electron(浏览器 + CLI 已覆盖;不背桌面壳)
- 服务端/云渲染(本地优先)

### 8.4 目录结构增量

```
app/src/
  engine/           # 不变 + timeline/composer.ts(层数据 → GSAP 时间线)
  scenes/
    composer/       # L2 通用编排场景(最重要的新场景)
    core/ geek/     # L3 配方(通用化改造)
  export/           # Tier1: 栅格化器、WebCodecs 管线、离线混音
  ...
cli/                # vkit CLI: serve / render / mcp
  render/           # CDP 截帧 + ffmpeg 管道
  mcp/              # stdio server
docs/
  AGENT.md          # agent 契约手册(schema + 语义 + recipes)
```

---

## 九、迭代计划

原则:每个里程碑独立可交付;**先把 V1 洗成真正通用的基线,再叠新能力**;导出先于编排(用户拿到产物才有留存)。

### V2-M0 · 通用化清洗(约 1–1.5 周)

| 任务 | 说明 |
|---|---|
| 配方场景去硬编码 | terminal 命令序列化、repoCard → 通用信息卡、去 GitHub 专名 |
| 画幅开放 | ASPECT_PIXELS 配置化,+1:1/21:9/自定义 |
| 素材补全 | 字体上传(FontFace)、音频挂载 + 播放/seek 同步、assetId 递归收集修复 |
| 转场补齐 | slide/glitch 实现;updateTransition 触发 timelineRev(V1 bug) |
| Segment 模型迁移 | VDocument → Segment(kind 体系、background、loop),migration 链 v1→v2 |

**验收**:一个非 GitHub 频道(如美食频道)不改代码做出全套片头片尾;导出 JSON 再导入资产无损。

### V2-M1 · 导出闭环(约 2 周)

| 任务 | 说明 |
|---|---|
| 录屏向导 | V1 设计的预检→纯净→倒计时→定格全流程落地 |
| Tier 1 浏览器导出 | 逐帧 seek + 分层栅格化 + WebCodecs + mp4-muxer;音频离线混渲 |
| 导出预设 | 按片段类型推荐格式/fps/分辨率 |
| 封面 PNG | shot 路由 + 一键导出 |

**验收**:纯浏览器无安装导出 1080p60 MP4,与预览逐帧一致(抽帧比对);带 BGM 的片头音画同步。

### V2-M2 · Composer 编排层(约 3 周,核心)

| 任务 | 说明 |
|---|---|
| 层模型 + composer 引擎 | Layer schema、`buildComposerTimeline` 纯函数、动词库(入场 8 + 强调 4 + 离场) |
| 层编辑 UI | 结构树、舞台直接选中/拖拽定位、层检查器(动词/时序面板) |
| 关键帧轨模式 | 6 属性轨、动词→轨展开、轨道表格编辑(不做曲线编辑器) |
| 素材层 | image/video/shape/svg 层 + 视频帧同步 |
| 品味护栏 | 克制预算软提示 |

**验收**:不写代码,从空白 Segment 用层 + 动词做出一个标题卡与一个信息卡,导出 MP4;video 层 seek 逐帧对齐。

### V2-M3 · CLI 渲染 + 片段类型全家桶(约 2–3 周)

| 任务 | 说明 |
|---|---|
| `vkit render` | CDP 无头截帧 + ffmpeg;mp4/webm-alpha/prores4444/png-seq/gif |
| 透明底片段 | background: transparent 全链路(舞台/预览棋盘格/导出) |
| 新片段类型模板 | lower-third ×2、转场遮罩 ×2、数据卡 ×1、可循环 b-roll ×2(首尾闭合) |
| 简易时间轴 | 层泳道视图 + delay/时长拖拽 + holdOverride 接入 |

**验收**:导出的 WebM-alpha 人名条在剪映/达芬奇中叠加正常;b-roll 循环无缝;CLI 在干净机器上跑通(仅装 ffmpeg)。

### V2-M4 · Agent 层(约 2 周)

| 任务 | 说明 |
|---|---|
| `vkit serve` | REST + revision + SSE 热重载,编辑器接入 |
| MCP server | 7.2 工具集;`vkit_render` 无头出片 |
| AGENT.md | schema + 语义 + recipes + 品味禁忌,分章节 |
| patch ops | compact 摘要 + 小粒度写操作 |

**验收**:在 Claude/Cursor 中一句话完成「复制上期→改标题→导出 MP4」全流程,人未碰编辑器。

### V2-M5 · 生态与打磨(持续)

模板包导入导出与版本协商、风格模板扩充(每片段类型 ≥3 风格)、撤销重做、WebGL 氛围层评估(必须满足 `draw(t)` 确定性才准入)、性能预算(4K 导出、120 粒子上限复评)。

---

## 十、风险与对策

| 风险 | 对策 |
|---|---|
| Composer 声明式模型表现力不足,用户仍需代码 | 动词→轨道的双模式给足梯度;复杂效果留在 L3 配方层,不强求数据化;先做 20 个精品预设验证覆盖率 |
| foreignObject 栅格化保真度(Tier 1) | 分层合成 + 字体内联;每场景回归截图 CI 比对 Tier1 输出 vs 无头截图;差异超阈值时 UI 引导用户走 Tier 2 |
| CLI 环境摩擦(ffmpeg/Chromium) | 检测 + 一键指引;Tier 1 保证零安装可用,Tier 2 只是升级不是门槛 |
| video 层逐帧 seek 慢(导出耗时) | 导出为离线任务 + 进度条;长视频素材建议先在 NLE 粗剪再导入;帧缓存 |
| 层模型 + 关键帧使 schema 迁移复杂化 | Composer props 自带独立 version 与 migrations(契约已支持);关键帧格式从一开始就定 `{t,v,ease}` 最小形不再变 |
| 品味护栏被无视,产出俗气模板 | 内置预设强制过预算;文档与 AGENT.md 双写克制规则;护栏只提示不阻止,保留用户自由 |
| 范围蔓延回「做剪映」 | 3.4 非目标清单进 PR 检查项;任何多轨/修剪类需求一律回答「去你的 NLE 做」 |

---

## 附录 · V1 → V2 决策对照速查

| 维度 | V1 | V2 |
|---|---|---|
| 定位 | GitHub 频道片头工厂 | 通用视频片段工厂(NLE 伴侣) |
| 自定义动画 | 不可能(须写代码) | Composer 层 + 动词 + 关键帧轨 |
| 产物 | 片头/片尾/封面 | 8 类片段,含透明底叠加素材 |
| 导出 | 外部录屏 | 录屏 + WebCodecs MP4 + CLI 无头全格式(alpha) |
| 素材 | 仅 Logo 图片 | 图/视频/音频/字体/SVG |
| AI | 无 | 文件/REST/MCP 三控制面 + AGENT.md + 无头出片 |
| 确定性时间线 | 有(核心资产) | 不变,升级为导出与 agent 的公共地基 |
