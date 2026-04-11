/**
 * Type-to-place gesture hook (Phase 5 plan 05-06, Task 4).
 *
 * Modelessness pillar: once the user clicks an empty spot on the canvas an
 * "insert cursor" is set in uiStore. From that point any printable letter
 * (with no modifiers and no component selected) dispatches
 * `omnispice:type-to-place` so the Sidebar library search can pre-filter to
 * the matching component type. Escape clears the cursor.
 *
 * Rotate (`R`) co-existence is handled by the guard "skip when a component
 * is selected" — useCanvasInteractions owns the `r` hotkey for rotation.
 */

import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';

export function useTypeToPlace(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const ui = useUiStore.getState();

      // Escape clears the insert cursor whether or not focus is in an input;
      // this mirrors every other "cancel current gesture" shortcut in the app.
      if (event.key === 'Escape') {
        if (ui.insertCursor) {
          useUiStore.getState().setInsertCursor(null);
        }
        return;
      }

      // Skip while focus is inside a text-editing surface so form controls
      // keep their native typing behaviour.
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      if ((document.activeElement as HTMLElement | null)?.isContentEditable) {
        return;
      }

      // Only trigger when the insert cursor is armed AND nothing is selected
      // (selection means R/C etc. are rotation/copy hotkeys).
      if (!ui.insertCursor) return;
      if (ui.selectedComponentIds.length > 0) return;

      // Ignore modifier shortcuts — those are handled by useHotkeys.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // Only letters. Digits, punctuation, and control keys are not valid
      // type-to-place seeds because the library is indexed by component name.
      if (event.key.length !== 1) return;
      if (!/^[a-zA-Z]$/.test(event.key)) return;

      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent('omnispice:type-to-place', {
          detail: { firstChar: event.key, cursor: ui.insertCursor },
        }),
      );
    };

    // Capture phase ensures we run BEFORE react-hotkeys-hook's document
    // listener for the rotate 'r' shortcut, so preventDefault() can stop
    // the rotate action when there is no selection.
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
