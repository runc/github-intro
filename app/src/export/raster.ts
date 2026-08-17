/**
 * DOM 舞台光栅化(SVG foreignObject,参考 motion-anything html-capture):
 * 每帧克隆 #stage → canvas 换成快照 <img>(foreignObject 内 canvas 内容不可序列化,
 * 且导出期需确定性 ambient,故先画后快照)→ blob:/http 图片内联为 dataURL → 整页样式内联。
 * #stage 本身按目标像素布局(外层仅 CSS transform 缩放),克隆即设计稿分辨率;
 * pixelRatio>1 时 SVG 画布放大并用 CSS scale,避免 Chromium 1× 栅格化导致文字发糊。
 */

export interface RasterContext {
  /** document.styleSheets 收集到的样式文本(导出期间样式不变,收集一次) */
  css: string;
  /** img src → dataURL(blob: URL 会话内稳定,整个导出只转一次) */
  dataUrls: Map<string, string>;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function collectCss(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) parts.push(rule.cssText);
    } catch {
      // 跨域样式表无法读取规则,跳过(本项目样式全部同源)
    }
  }
  return parts.join('\n');
}

async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const blob = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    });
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    console.warn(`[export] 图片内联失败(导出画面中可能缺失): ${url}`);
    return undefined;
  }
}

/** 导出前一次性准备:收集样式 + 预转换舞台内全部图片 */
export async function prepareRaster(stage: HTMLElement): Promise<RasterContext> {
  const dataUrls = new Map<string, string>();
  for (const img of Array.from(stage.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (!src || src.startsWith('data:') || dataUrls.has(src)) continue;
    const data = await toDataUrl(src);
    if (data) dataUrls.set(src, data);
  }
  return { css: collectCss(), dataUrls };
}

/** 覆盖样式表里的 will-change(.scene-root),避免 foreignObject 落到低分辨率合成层 */
function stripCompositorHints(root: HTMLElement): void {
  root.style.willChange = 'auto';
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    el.style.willChange = 'auto';
  }
}

/** 锁死设计稿盒,避免 FO 首帧落到 300×150 横屏替换元素默认尺寸 */
function lockBox(el: HTMLElement, w: number, h: number): void {
  const box = `${w}px`;
  const high = `${h}px`;
  el.style.boxSizing = 'border-box';
  el.style.width = box;
  el.style.height = high;
  el.style.minWidth = box;
  el.style.maxWidth = box;
  el.style.minHeight = high;
  el.style.maxHeight = high;
  el.style.overflow = 'hidden';
}

/**
 * Chromium 把 SVG 当 <img> 时,未标明宽高会先按 300×150(横屏)栅格化 foreignObject。
 * 显式 width/height 后再 decode,并画到等尺寸 canvas 强制按目标分辨率栅格。
 */
async function decodeSvgToCanvas(url: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.width = w;
  img.height = h;
  img.src = url;
  await img.decode();
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('无法创建栅格画布');
  ctx.drawImage(img, 0, 0, w, h);
  return out;
}

/**
 * 把当前时刻的舞台光栅化为一张图(调用前需已 seek 并画好确定性 ambient)。
 * canvas 快照是同步的,异步的 SVG 解码期间 live canvas 被覆盖也不影响结果。
 * pixelRatio 为捕获像素 / 设计稿像素(通常 2),SVG 内 CSS scale 保证文字按目标分辨率绘制。
 */
export async function rasterizeStage(
  stage: HTMLElement,
  rc: RasterContext,
  w: number,
  h: number,
  pixelRatio = 1,
  canvasSnaps?: string[],
  nonce?: string,
): Promise<HTMLCanvasElement> {
  const pr = Math.max(1, pixelRatio);
  const sw = Math.round(w * pr);
  const sh = Math.round(h * pr);

  // 1. 同步快照全部 live canvas(ambient 等),再克隆 DOM。
  //    导出管线可传入更高分辨率快照(与 CSS scale 对齐,避免氛围层被放大发糊)。
  const snaps = canvasSnaps ?? Array.from(stage.querySelectorAll('canvas')).map((c) => c.toDataURL('image/png'));
  const clone = stage.cloneNode(true) as HTMLElement;
  lockBox(clone, w, h);
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.right = 'auto';
  clone.style.bottom = 'auto';
  clone.style.margin = '0';
  stripCompositorHints(clone);

  // 2. 克隆里的 canvas 依次替换为快照 img(foreignObject 看不见 canvas 位图)
  const deadCanvases = Array.from(clone.querySelectorAll('canvas'));
  deadCanvases.forEach((c, i) => {
    const img = c.ownerDocument.createElement('img');
    img.src = snaps[i] ?? '';
    img.style.cssText = `${c.style.cssText};display:block`;
    c.replaceWith(img);
  });

  // 3. blob:/远程图片换成 dataURL(SVG-as-image 禁止外部资源)
  for (const img of Array.from(clone.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    const data = rc.dataUrls.get(src);
    if (data) img.src = data;
  }

  // 4. 包成 SVG。外框是捕获像素、内容按设计稿 layout 再 CSS scale,
  //    避免 Chromium 把 SVG-as-image 栅在 1× 再拉伸。blob: SVG 会污染画布,走 data URL。
  const xml = new XMLSerializer().serializeToString(clone);
  const css = xmlEscape(rc.css).replace(/<\/style>/gi, '<\\/style>');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">` +
    `<foreignObject x="0" y="0" width="${sw}" height="${sh}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${sw}px;height:${sh}px;overflow:hidden;">` +
    `<style>${css}</style>` +
    `<div style="width:${w}px;height:${h}px;min-width:${w}px;min-height:${h}px;transform:scale(${pr});transform-origin:0 0;">${xml}</div>` +
    `</div></foreignObject>${nonce ? `<!--${xmlEscape(nonce)}-->` : ''}</svg>`;

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    return await decodeSvgToCanvas(url, sw, sh);
  } catch (e) {
    throw new Error(`舞台光栅化失败(浏览器无法渲染 SVG foreignObject):${e instanceof Error ? e.message : String(e)}`);
  }
}
