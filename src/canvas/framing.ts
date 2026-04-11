/**
 * Canvas framing helpers — pure math for computing bounding boxes and
 * fit-to-view zoom levels for the F (frame selection) and A/0 (frame all)
 * hotkeys. Pure functions so they can be unit-tested without React Flow.
 */

import type { Node } from '@xyflow/react';

export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the axis-aligned bounding box that encloses every node in the
 * input set, honoring React Flow's `measured.{width,height}` preference
 * over the legacy `width`/`height` fields.
 *
 * Returns a zero-size bbox at origin when the input set is empty.
 */
export function computeSelectionBbox(nodes: Node[]): Bbox {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const nx = node.position.x;
    const ny = node.position.y;
    const nw = node.measured?.width ?? node.width ?? 0;
    const nh = node.measured?.height ?? node.height ?? 0;

    if (nx < minX) minX = nx;
    if (ny < minY) minY = ny;
    if (nx + nw > maxX) maxX = nx + nw;
    if (ny + nh > maxY) maxY = ny + nh;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Compute a zoom level that fits `bbox` into ~60% of a viewport of the
 * given size. Clamped to [0.25, 2] so the camera never jumps to a silly
 * level for 1px selections or huge schematics.
 */
export function fitZoomForBbox(
  bbox: Bbox,
  viewport: { width: number; height: number },
  { padding = 0.6, minZoom = 0.25, maxZoom = 2 } = {},
): number {
  if (bbox.width === 0 && bbox.height === 0) {
    return Math.min(maxZoom, 1);
  }
  const zx = bbox.width > 0 ? (viewport.width / bbox.width) * padding : maxZoom;
  const zy = bbox.height > 0 ? (viewport.height / bbox.height) * padding : maxZoom;
  const z = Math.min(zx, zy);
  if (Number.isNaN(z) || !Number.isFinite(z)) return 1;
  return Math.max(minZoom, Math.min(maxZoom, z));
}
