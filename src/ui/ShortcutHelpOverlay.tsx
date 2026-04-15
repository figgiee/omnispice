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
    title: 'SCHEMATIC HONESTY',
    shortcuts: [
      { keys: 'Select wire, type name', action: 'Label net' },
      { keys: 'Shift+drag from pin', action: 'Diagonal wire' },
      { keys: 'Ctrl+G', action: 'Collapse to subcircuit' },
      { keys: 'Double-click subcircuit', action: 'Descend' },
      { keys: 'Esc', action: 'Ascend from subcircuit' },
    ],
  },
  {
    title: 'MODELESSNESS',
    shortcuts: [
      { keys: 'Type letter', action: 'Place component' },
      { keys: 'R', action: 'Rotate (when selected)' },
      { keys: 'R', action: 'Resistor search (when insert cursor)' },
      { keys: 'Space+drag', action: 'Pan' },
      { keys: 'Shift+D', action: 'Duplicate' },
      { keys: 'Delete / Backspace', action: 'Delete selection' },
      { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / Redo' },
    ],
  },
  {
    title: 'IMMEDIACY',
    shortcuts: [
      { keys: 'Click value, drag', action: 'Scrub' },
      { keys: 'Shift+click value, drag', action: 'Sweep' },
      { keys: 'Hover node', action: 'Show V, I, P' },
      { keys: 'F5', action: 'Run simulation manually' },
    ],
  },
  {
    title: 'LIVE FEEDBACK',
    shortcuts: [
      { keys: 'Ctrl+K', action: 'Command palette' },
      { keys: '?', action: 'This help' },
      { keys: 'F', action: 'Frame selection' },
      { keys: 'A or 0', action: 'Frame all' },
      { keys: 'Shift+2', action: 'Zoom to 100%' },
    ],
  },
  {
    title: 'PEDAGOGY',
    shortcuts: [
      { keys: 'Click waveform peak', action: 'Annotate' },
      { keys: 'Click insight badge', action: 'Expand' },
      { keys: 'Ctrl+E', action: 'Export lab report PDF' },
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
