/**
 * SubcircuitNode — Phase 5 Pillar 1 Part 2 (Plan 05-03).
 *
 * Visual block for collapsed subcircuits. Renders as a titled rectangle
 * with the subcircuit name, child-count subtitle, and one Handle per
 * exposed port distributed along the left and right edges.
 *
 * Per UI-SPEC §7.12 the fold-corner glyph in the top-right signals
 * "double-click to descend". The caller (Canvas.tsx) owns the actual
 * onNodeDoubleClick handler; this component is purely visual.
 */

import { Handle, type NodeProps, Position } from '@xyflow/react';
import type { Port } from '@/circuit/types';
import styles from './SubcircuitNode.module.css';
import type { CircuitNodeData } from './types';

interface SubcircuitNodeData extends CircuitNodeData {
  subcircuitName?: string;
  childComponentIds?: string[];
  ports?: Port[];
}

export function SubcircuitNode({ data, selected }: NodeProps) {
  const d = data as SubcircuitNodeData;
  const name = d.subcircuitName ?? d.value ?? 'SUB';
  const pinCount = d.childComponentIds?.length ?? 0;
  const ports: Port[] = Array.isArray(d.ports) ? d.ports : [];

  // Distribute ports: even-index on the left, odd-index on the right.
  // Each row is 20px tall so the block grows with the exposed-pin count.
  const leftPorts = ports.filter((_, i) => i % 2 === 0);
  const rightPorts = ports.filter((_, i) => i % 2 === 1);
  const maxSide = Math.max(leftPorts.length, rightPorts.length, 2);
  const blockHeight = 40 + maxSide * 20;

  return (
    <div
      className={styles.block}
      data-selected={selected ? 'true' : 'false'}
      data-testid="subcircuit-node"
      role="group"
      aria-label={`Subcircuit: ${name}`}
      style={{ minHeight: `${blockHeight}px` }}
    >
      <div className={styles.foldCorner} aria-hidden="true">
        ⌐
      </div>
      <div className={styles.title}>{name}</div>
      <div className={styles.subtitle}>
        {pinCount} {pinCount === 1 ? 'part' : 'parts'}
      </div>

      {leftPorts.map((p, i) => (
        <Handle
          key={p.id}
          type="target"
          position={Position.Left}
          id={p.name}
          className={`pin pin-type-${p.pinType ?? 'signal'}`}
          style={{ top: `${30 + i * 20}px` }}
        />
      ))}
      {rightPorts.map((p, i) => (
        <Handle
          key={p.id}
          type="source"
          position={Position.Right}
          id={p.name}
          className={`pin pin-type-${p.pinType ?? 'signal'}`}
          style={{ top: `${30 + i * 20}px` }}
        />
      ))}
    </div>
  );
}
