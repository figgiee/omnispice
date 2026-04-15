/**
 * ShortcutHelpOverlay — docked right-panel keyboard reference (UI-SPEC §7.6).
 *
 * Listens for the `omnispice:toggle-shortcut-help` window event (dispatched
 * by the `?` hotkey in useCanvasInteractions) and toggles visibility.
 * - Second `?` press closes (toggle).
 * - Esc closes and returns focus to the canvas.
 * - Click outside the panel closes it.
 * - On open, focus moves to the first heading (a11y per UI-SPEC §7.6).
 *
 * Plan 05-01 shipped the chrome + listener; Plan 05-11 fills in the full
 * pillar-grouped content per UI-SPEC §7.6.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './ShortcutHelpOverlay.module.css';

interface Shortcut {
  keys: string;
  action: string;
}
interface PillarSection {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: PillarSection[] = [
  {
    title: 'PLACING COMPONENTS',
    shortcuts: [
      { keys: 'Drag from sidebar', action: 'Place component' },
      { keys: 'Right-click canvas', action: 'Search & place' },
      { keys: 'Drag wire to empty space', action: 'Place & auto-connect' },
      { keys: 'Ctrl+K', action: 'Command palette / templates' },
    ],
  },
  {
    title: 'WIRING',
    shortcuts: [
      { keys: 'Drag from pin', action: 'Draw wire' },
      { keys: 'Select wire, type name', action: 'Label net' },
      { keys: 'Right-click wire', action: 'Delete wire' },
    ],
  },
  {
    title: 'EDITING',
    shortcuts: [
      { keys: 'R', action: 'Rotate selected' },
      { keys: 'Shift+D', action: 'Duplicate selected' },
      { keys: 'Delete / Backspace', action: 'Delete selected' },
      { keys: 'Ctrl+Z / Ctrl+Shift+Z', action: 'Undo / Redo' },
      { keys: 'Ctrl+G', action: 'Group into subcircuit' },
      { keys: 'Double-click subcircuit', action: 'Enter subcircuit' },
      { keys: 'Esc', action: 'Exit subcircuit / cancel' },
      { keys: 'Click value', action: 'Edit component value' },
    ],
  },
  {
    title: 'VIEW & NAVIGATION',
    shortcuts: [
      { keys: 'Space + drag', action: 'Pan canvas' },
      { keys: 'Scroll', action: 'Zoom' },
      { keys: 'F', action: 'Frame selection' },
      { keys: 'A  or  0', action: 'Frame all' },
      { keys: 'Shift+2', action: 'Zoom to 100%' },
    ],
  },
  {
    title: 'SIMULATION',
    shortcuts: [
      { keys: 'F5', action: 'Run simulation' },
      { keys: 'Ctrl+.', action: 'Cancel simulation' },
      { keys: 'Hover node / wire', action: 'Show live voltage & current' },
      { keys: 'Click insight badge', action: 'Expand insight detail' },
    ],
  },
];

export function ShortcutHelpOverlay() {
  const [open, setOpen] = useState(false);
  const firstHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Toggle on omnispice:toggle-shortcut-help; Esc closes
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('omnispice:toggle-shortcut-help', toggle);
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('omnispice:toggle-shortcut-help', toggle);
      window.removeEventListener('keydown', onKeydown);
    };
  }, []);

  // Focus management: capture active element before opening; restore on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      const t = setTimeout(() => firstHeadingRef.current?.focus(), 0);
      return () => clearTimeout(t);
    } else {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    }
  }, [open]);

  // Click-outside close — delayed one tick so the opening click doesn't fire it
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const overlay = document.querySelector('[data-testid="shortcut-help-overlay"]');
      if (overlay && !overlay.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  if (!open) return null;

  return (
    <aside
      className={styles.overlay}
      role="dialog"
      aria-label="Keyboard reference"
      aria-modal="false"
      data-testid="shortcut-help-overlay"
    >
      <header className={styles.header}>
        {/* tabIndex={-1} so programmatic focus works without a tab stop */}
        <h2 ref={firstHeadingRef} tabIndex={-1}>
          Keyboard reference
        </h2>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.title} className={styles.section}>
          <h3>{section.title}</h3>
          <dl>
            {section.shortcuts.map((s) => (
              <div key={`${s.keys}-${s.action}`} className={styles.row}>
                <dt>
                  <kbd>{s.keys}</kbd>
                </dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </aside>
  );
}
