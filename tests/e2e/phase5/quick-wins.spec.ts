/**
 * Phase 5 editor UX quick-wins Playwright suite.
 *
 * Covers the one-listener/one-config wins shipped in 05-01:
 *   - Minimap always visible
 *   - F/A/0 framing hotkeys
 *   - Spacebar-hold temporary pan
 *   - Shift+D duplicate selection
 *   - Double-click node centers viewport
 *   - ? toggles ShortcutHelpOverlay
 *
 * Task 0 scaffolds the suite with skipped tests; Task 5 un-skips them.
 */

import { test } from '@playwright/test';

test.describe('Phase 5 quick wins', () => {
  test.skip('minimap is visible on first render', async () => {
    // Unskipped in Task 5
  });

  test.skip('F frames selection', async () => {
    // Unskipped in Task 5
  });

  test.skip('A frames all nodes', async () => {
    // Unskipped in Task 5
  });

  test.skip('0 frames all nodes', async () => {
    // Unskipped in Task 5
  });

  test.skip('Space-drag pans canvas', async () => {
    // Unskipped in Task 5
  });

  test.skip('Shift+D duplicates selection', async () => {
    // Unskipped in Task 5
  });

  test.skip('Double-click node centers viewport', async () => {
    // Unskipped in Task 5
  });

  test.skip('? toggles shortcut help overlay', async () => {
    // Unskipped in Task 5
  });
});
