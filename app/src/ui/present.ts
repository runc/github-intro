/**
 * 全屏播放(DESIGN.md 3.10 F + 3.7 纯净全屏):
 * F = 隐藏 chrome + Fullscreen API + 舞台 contain 铺满。
 * X = 仅隐藏 chrome(窗口内录制,不申请浏览器全屏)。
 */
import { useStore } from '../store';

export function editorEl(): HTMLElement | null {
  return document.querySelector('[data-vk-editor]');
}

export function enterPresent(): void {
  useStore.getState().setPureMode(true);
  const el = editorEl();
  if (el && !document.fullscreenElement) {
    void el.requestFullscreen().catch(() => {
      /* 浏览器拒绝全屏时仍保留窗口内纯净模式 */
    });
  }
}

export function exitPresent(): void {
  useStore.getState().setPureMode(false);
  if (document.fullscreenElement) void document.exitFullscreen();
}

/** F:已在浏览器全屏则退出;否则进入纯净全屏 */
export function togglePresent(): void {
  if (document.fullscreenElement) exitPresent();
  else enterPresent();
}

/** X:全屏中则退出演示;否则只切 chrome */
export function togglePureMode(): void {
  if (document.fullscreenElement) {
    exitPresent();
    return;
  }
  useStore.getState().setPureMode(!useStore.getState().pureMode);
}
