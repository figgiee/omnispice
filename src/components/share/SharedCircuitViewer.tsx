import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { circuitToEdges, circuitToNodes } from '@/canvas/circuitToFlow';
import { nodeTypes } from '@/canvas/components/nodeTypes';
import { edgeTypes } from '@/canvas/edges/edgeTypes';
import { loadSharedCircuit } from '@/cloud/api';
import { deserializeCircuit } from '@/cloud/serialization';
import type { Circuit } from '@/circuit/types';

interface SharedCircuitViewerProps {
  token: string;
}

/**
 * Read-only React Flow canvas for shared circuits.
 *
 * Loads the circuit JSON via GET /api/share/:token (no auth required),
 * deserializes it, and renders it in a locked-down ReactFlow instance.
 * Panning and zooming are enabled so viewers can inspect the circuit.
 */
function SharedCircuitViewerInner({ token }: SharedCircuitViewerProps) {
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCircuit() {
      try {
        const json = await loadSharedCircuit(token);
        if (!cancelled) {
          setCircuit(deserializeCircuit(json));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load circuit.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchCircuit();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const nodes = circuit ? circuitToNodes(circuit) : [];
  const edges = circuit ? circuitToEdges(circuit) : [];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas-bg)',
      }}
    >
      {/* Read-only banner */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--surface-primary)',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="var(--accent-primary)" strokeWidth="2" />
            <polyline
              points="6,14 9,10 12,13 15,8 18,11"
              stroke="var(--accent-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-body)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            OmniSpice
          </span>
          <span
            style={{
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-label)',
              marginLeft: 4,
            }}
          >
            Shared Circuit — Read Only
          </span>
        </div>

        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            background: 'none',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            padding: '3px 10px',
            cursor: 'not-allowed',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--font-size-label)',
            opacity: 0.5,
          }}
        >
          Fork to My Account
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-body)',
            }}
          >
            Loading circuit...
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-error)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-body)',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            fitView
            minZoom={0.25}
            maxZoom={4}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={10}
              color="var(--canvas-grid-dot)"
              size={1}
            />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

/**
 * Wraps the viewer in a ReactFlowProvider (required by ReactFlow).
 */
export function SharedCircuitViewer({ token }: SharedCircuitViewerProps) {
  return (
    <ReactFlowProvider>
      <SharedCircuitViewerInner token={token} />
    </ReactFlowProvider>
  );
}
