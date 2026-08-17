/**
 * 快捷键(DESIGN.md 3.10):SPACE / R / 1-9 / ←→ / Shift+←→ / S / F / X / ⌘S
 */
import { useEffect } from 'react';
import type { Player } from '../engine/timeline/player';
import { useStore } from '../store';
import { togglePresent, togglePureMode } from './present';

export function useHotkeys(player: Player | null): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          void useStore.getState().flushSave();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 's') {
          e.preventDefault();
          void useStore.getState().flushSave();
        }
        return;
      }

      const store = useStore.getState();
      if (store.exportLock) {
        if (e.key === 'Escape') {
          e.preventDefault();
          window.dispatchEvent(new Event('vk-export-cancel'));
        }
        return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (player) {
            if (store.isPlaying) {
              player.pause();
              store.setPlaying(false);
            } else {
              player.play();
              store.setPlaying(true);
            }
          }
          break;
        case 'r':
        case 'R':
          player?.seek(0);
          player?.play();
          store.setPlaying(true);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player?.stepFrames(e.shiftKey ? -60 : -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          player?.stepFrames(e.shiftKey ? 60 : 1);
          break;
        case 's':
        case 'S':
          store.toggleInspector();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          togglePresent();
          break;
        case 'x':
        case 'X':
          togglePureMode();
          break;
        case 'h':
        case 'H':
          document.documentElement.classList.toggle('hud-hidden');
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            player?.seekScene(Number(e.key) - 1);
          }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);
}
