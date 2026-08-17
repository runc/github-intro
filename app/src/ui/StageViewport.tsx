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
  children: ReactNode;
}

export function StageViewport({ w, h, fill = false, children }: StageViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const pad = fill ? 0 : 32;
      const s = Math.max(0.05, Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h));
      setScale(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, fill]);

  return (
    <div ref={viewportRef} className={`stage-viewport${fill ? ' fill' : ''}`}>
      <div
        className="stage-scaler"
        style={{ width: w, height: h, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
