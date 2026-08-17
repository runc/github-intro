/**
 * 舞台缩放引擎(DESIGN.md 4.6):#stage 固定目标像素,外层 viewport 等比 scale 适配窗口。
 * 编辑态留边距;纯净/全屏播放 pad=0,contain 铺满(横屏信箱 / 竖屏柱箱)。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StageViewportProps {
  w: number;
  h: number;
  /** 铺满视口、无边距(纯净模式 / 浏览器全屏) */
  fill?: boolean;
  /** 导出:取消 CSS scale,舞台按设计像素排版,供 Element Capture 拿到满分辨率层 */
  nativePixels?: boolean;
  children: ReactNode;
}

export function StageViewport({ w, h, fill = false, nativePixels = false, children }: StageViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (nativePixels) {
      setScale(1);
      return;
    }
    const update = () => {
      const pad = fill ? 0 : 32;
      const s = Math.max(0.05, Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h));
      setScale(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, fill, nativePixels]);

  return (
    <div
      ref={viewportRef}
      className={`stage-viewport${fill ? ' fill' : ''}${nativePixels ? ' native-pixels' : ''}`}
    >
      <div
        className="stage-scaler"
        style={{ width: w, height: h, transform: nativePixels ? 'none' : `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
