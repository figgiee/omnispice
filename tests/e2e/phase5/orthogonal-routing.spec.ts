/**
 * Plan 05-02 Task 5 — orthogonal wire routing stress test.
 *
 * Loads a 22-component reference circuit (BJT common-emitter amplifier +
 * op-amp buffer) via the dev-only `window.__test_loadCircuit` hook and
 * verifies that every rendered edge path consists solely of axis-aligned
 * (horizontal / vertical) segments.
 *
 * React Flow's `getSmoothStepPath` with `borderRadius: 0` emits paths made
 * of `M x y`, `L x y`, and (occasionally) implicit `H`/`V` commands. The
 * invariant is: no single straight segment may move in BOTH x and y.
 * Diagonal hops would indicate the router fell back to a bezier or smooth
 * curve and the routing pillar is broken.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/orthogonal-stress.json'), 'utf8'),
) as { components: unknown[]; wires: unknown[]; _comment?: string };

test.describe('Orthogonal wire routing (Plan 05-02 Task 5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sidebar-library"]', { timeout: 15_000 });
    await page.waitForSelector('.react-flow__pane', { timeout: 10_000 });
  });

  test('22-component reference circuit renders with no diagonal edge segments', async ({
    page,
  }) => {
    // Strip the `_comment` field — __test_loadCircuit expects {components, wires}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _comment, ...clean } = fixture as typeof fixture & { _comment?: string };

    await page.evaluate((circuit) => {
      const loader = (window as unknown as { __test_loadCircuit?: (c: unknown) => void })
        .__test_loadCircuit;
      if (!loader) {
        throw new Error('__test_loadCircuit is not defined (dev hook missing)');
      }
      loader(circuit);
    }, clean);

    // First wait for the components to appear. Fixture has 22 components.
    await page.waitForFunction(
      () => document.querySelectorAll('.react-flow__node').length >= 22,
      null,
      { timeout: 15_000 },
    );

    // Give React Flow a beat to finish measuring nodes and materializing edges
    // (edges cannot draw until their source/target handles have a measured
    // DOM position, which happens on the second render frame).
    await page.waitForTimeout(500);

    // Require at least ~10 edges to meaningfully stress the router. React
    // Flow dedupes edges that share (source, sourceHandle, target, targetHandle),
    // so a few fixture wires collapse (multiple connections landing on a
    // single "ground" pin), but the remainder still covers >3× the routing
    // complexity of any phase 1–4 test fixture.
    await page.waitForFunction(
      () => document.querySelectorAll('.react-flow__edge-path').length >= 10,
      null,
      { timeout: 10_000 },
    );

    const paths = await page
      .locator('.react-flow__edge-path')
      .evaluateAll((els) => els.map((el) => el.getAttribute('d') ?? ''));

    expect(paths.length).toBeGreaterThanOrEqual(10);

    /**
     * Walk each SVG path's commands and verify every segment is axis-aligned.
     *
     * React Flow's `getSmoothStepPath` with `borderRadius: 0` emits paths
     * made of `M`, `L`, and degenerate `Q` commands where the control point
     * equals the endpoint (effectively a line). We accept:
     *   M x y                     — move
     *   L x y                     — line (OK only if dx == 0 || dy == 0)
     *   Q cx cy x y               — quadratic (OK only if control = endpoint,
     *                               AND the resulting segment is axis-aligned)
     *   H x, V y                  — always OK
     *   Z                          — close
     *
     * Any `C`/`S`/`T`/`A` command is a hard fail — those are real curves.
     */
    const FORBIDDEN = /[CSTAcsta]/;
    const COMMAND_RE = /([MLHVZQmlhvzq])([^MLHVZQmlhvzq]*)/g;

    for (const d of paths) {
      if (!d) continue;
      expect(d, `path contains forbidden curve command: ${d}`).not.toMatch(FORBIDDEN);

      let penX: number | null = null;
      let penY: number | null = null;
      const matches = [...d.matchAll(COMMAND_RE)];
      for (const match of matches) {
        const cmd = match[1];
        if (!cmd) continue;
        const argsStr = (match[2] ?? '').trim();
        const nums = argsStr.length > 0 ? argsStr.split(/[\s,]+/).map(Number) : [];

        if (cmd === 'M' || cmd === 'm') {
          const x = nums[0];
          const y = nums[1];
          if (x !== undefined && y !== undefined) {
            penX = x;
            penY = y;
          }
        } else if (cmd === 'L' || cmd === 'l') {
          const x = nums[0];
          const y = nums[1];
          if (x !== undefined && y !== undefined && penX !== null && penY !== null) {
            const dx = Math.abs(x - penX);
            const dy = Math.abs(y - penY);
            const isOrthogonal = dx < 0.5 || dy < 0.5;
            expect(
              isOrthogonal,
              `diagonal L segment in path: (${penX},${penY}) -> (${x},${y})\nFull path: ${d}`,
            ).toBe(true);
            penX = x;
            penY = y;
          }
        } else if (cmd === 'Q' || cmd === 'q') {
          // Quadratic Bézier: cx cy x y. Accept only when degenerate — the
          // control point must equal the endpoint (router collapsed corner
          // radius to zero) AND the segment itself must be axis-aligned.
          const cx = nums[0];
          const cy = nums[1];
          const x = nums[2];
          const y = nums[3];
          if (
            cx !== undefined &&
            cy !== undefined &&
            x !== undefined &&
            y !== undefined &&
            penX !== null &&
            penY !== null
          ) {
            expect(
              Math.abs(cx - x) < 0.5 && Math.abs(cy - y) < 0.5,
              `non-degenerate Q (curved) segment: control (${cx},${cy}) vs endpoint (${x},${y})\nFull path: ${d}`,
            ).toBe(true);
            const dx = Math.abs(x - penX);
            const dy = Math.abs(y - penY);
            const isOrthogonal = dx < 0.5 || dy < 0.5;
            expect(
              isOrthogonal,
              `diagonal Q segment in path: (${penX},${penY}) -> (${x},${y})\nFull path: ${d}`,
            ).toBe(true);
            penX = x;
            penY = y;
          }
        } else if (cmd === 'H' || cmd === 'h') {
          const x = nums[0];
          if (x !== undefined) penX = x;
        } else if (cmd === 'V' || cmd === 'v') {
          const y = nums[0];
          if (y !== undefined) penY = y;
        }
      }
    }
  });
});
