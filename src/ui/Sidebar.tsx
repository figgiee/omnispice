/**
 * Component library sidebar with fuzzy search and drag-to-canvas.
 *
 * Implements:
 * - D-29: Categorized component list (Passives, Semiconductors, Sources, Op-Amps)
 * - D-30: Fuzzy search via cmdk command palette
 * - D-31: Drag-to-canvas with application/omnispice-component MIME type
 * - D-32: 20x20 SVG preview icon per component
 * - Ctrl+K global shortcut to focus search
 */

import { Command } from 'cmdk';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentDefinition } from '@/circuit/componentLibrary';
import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import type { ComponentType } from '@/circuit/types';
import { useUiStore } from '@/store/uiStore';
import styles from './Sidebar.module.css';

/** MIME type for drag-and-drop component transfers to canvas. */
const DND_MIME_TYPE = 'application/omnispice-component';

/** Category display names and order. */
const CATEGORIES: { key: ComponentDefinition['category']; label: string }[] = [
  { key: 'passives', label: 'Passives' },
  { key: 'semiconductors', label: 'Semiconductors' },
  { key: 'sources', label: 'Sources' },
  { key: 'opamps', label: 'Op-Amps' },
];

/** Group library components by category. */
function groupByCategory(): Record<string, { type: ComponentType; def: ComponentDefinition }[]> {
  const groups: Record<string, { type: ComponentType; def: ComponentDefinition }[]> = {};
  for (const category of CATEGORIES) {
    groups[category.key] = [];
  }
  for (const [type, def] of Object.entries(COMPONENT_LIBRARY) as [
    ComponentType,
    ComponentDefinition,
  ][]) {
    // Phase 5: net_label is a pseudo-component placed via type-on-wire gesture,
    // not dragged from the palette. Keep it out of the sidebar listing.
    if (type === 'net_label') continue;
    if (groups[def.category]) {
      groups[def.category]!.push({ type, def });
    }
  }
  return groups;
}

const GROUPED_COMPONENTS = groupByCategory();

/**
 * Minimal SVG preview icon for a component (20x20).
 * Shows a simplified schematic symbol.
 */
function ComponentIcon({ type }: { type: ComponentType }) {
  switch (type) {
    case 'resistor':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="10" x2="3" y2="10" />
          <polyline points="3,10 4,6 6,14 8,6 10,14 12,6 14,14 16,10" />
          <line x1="16" y1="10" x2="20" y2="10" />
        </svg>
      );
    case 'capacitor':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="10" x2="8" y2="10" />
          <line x1="8" y1="4" x2="8" y2="16" />
          <line x1="12" y1="4" x2="12" y2="16" />
          <line x1="12" y1="10" x2="20" y2="10" />
        </svg>
      );
    case 'inductor':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="10" x2="2" y2="10" />
          <path d="M2,10 C2,6 5,6 5,10 C5,6 8,6 8,10 C8,6 11,6 11,10 C11,6 14,6 14,10 C14,6 17,6 17,10" />
          <line x1="17" y1="10" x2="20" y2="10" />
        </svg>
      );
    case 'transformer':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="6" x2="3" y2="6" />
          <path d="M3,6 C3,3 6,3 6,6 C6,3 9,3 9,6" />
          <line x1="0" y1="14" x2="3" y2="14" />
          <path d="M3,14 C3,11 6,11 6,14 C6,11 9,11 9,14" />
          <line x1="9" y1="2" x2="9" y2="18" strokeDasharray="1,1" />
          <line x1="11" y1="2" x2="11" y2="18" strokeDasharray="1,1" />
          <path d="M11,6 C11,3 14,3 14,6 C14,3 17,3 17,6" />
          <line x1="17" y1="6" x2="20" y2="6" />
          <path d="M11,14 C11,11 14,11 14,14 C14,11 17,11 17,14" />
          <line x1="17" y1="14" x2="20" y2="14" />
        </svg>
      );
    case 'diode':
    case 'schottky_diode':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="10" x2="6" y2="10" />
          <polygon points="6,5 14,10 6,15" />
          <line x1="14" y1="5" x2="14" y2="15" />
          <line x1="14" y1="10" x2="20" y2="10" />
        </svg>
      );
    case 'zener_diode':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="10" x2="6" y2="10" />
          <polygon points="6,5 14,10 6,15" />
          <polyline points="12,5 14,5 14,15 16,15" />
          <line x1="14" y1="10" x2="20" y2="10" />
        </svg>
      );
    case 'npn_bjt':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="10" r="6" />
          <line x1="0" y1="10" x2="9" y2="10" />
          <line x1="9" y1="6" x2="9" y2="14" />
          <line x1="9" y1="7" x2="14" y2="4" />
          <line x1="14" y1="4" x2="20" y2="2" />
          <line x1="9" y1="13" x2="14" y2="16" />
          <line x1="14" y1="16" x2="20" y2="18" />
          <polyline points="11,15 14,16 13,13" />
        </svg>
      );
    case 'pnp_bjt':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="10" r="6" />
          <line x1="0" y1="10" x2="9" y2="10" />
          <line x1="9" y1="6" x2="9" y2="14" />
          <line x1="9" y1="7" x2="14" y2="4" />
          <line x1="14" y1="4" x2="20" y2="2" />
          <line x1="9" y1="13" x2="14" y2="16" />
          <line x1="14" y1="16" x2="20" y2="18" />
          <polyline points="10,8 9,7 12,7" />
        </svg>
      );
    case 'nmos':
    case 'pmos':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="0" y1="10" x2="6" y2="10" />
          <line x1="6" y1="4" x2="6" y2="16" />
          <line x1="8" y1="5" x2="8" y2="9" />
          <line x1="8" y1="11" x2="8" y2="15" />
          <line x1="8" y1="7" x2="14" y2="7" />
          <line x1="8" y1="13" x2="14" y2="13" />
          <line x1="14" y1="7" x2="14" y2="2" />
          <line x1="14" y1="13" x2="14" y2="18" />
          <line x1="14" y1="10" x2="20" y2="10" />
          <line x1="10" y1="10" x2="14" y2="10" />
        </svg>
      );
    case 'ideal_opamp':
    case 'ua741':
    case 'lm741':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="3,3 3,17 17,10" />
          <line x1="0" y1="7" x2="3" y2="7" />
          <line x1="0" y1="13" x2="3" y2="13" />
          <line x1="17" y1="10" x2="20" y2="10" />
          <text x="5" y="9" fontSize="3" fill="currentColor" stroke="none">
            +
          </text>
          <text x="5" y="15" fontSize="3" fill="currentColor" stroke="none">
            −
          </text>
        </svg>
      );
    case 'dc_voltage':
    case 'ac_voltage':
    case 'pulse_voltage':
    case 'sin_voltage':
    case 'pwl_voltage':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="7" />
          <line x1="10" y1="0" x2="10" y2="3" />
          <line x1="10" y1="17" x2="10" y2="20" />
          <text x="10" y="9" textAnchor="middle" fontSize="4" fill="currentColor" stroke="none">
            +
          </text>
          <text x="10" y="14" textAnchor="middle" fontSize="4" fill="currentColor" stroke="none">
            −
          </text>
        </svg>
      );
    case 'dc_current':
    case 'ac_current':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="7" />
          <line x1="10" y1="0" x2="10" y2="3" />
          <line x1="10" y1="17" x2="10" y2="20" />
          <line x1="10" y1="6" x2="10" y2="14" />
          <polyline points="7,11 10,14 13,11" />
        </svg>
      );
    case 'ground':
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="10" y1="0" x2="10" y2="8" />
          <line x1="4" y1="8" x2="16" y2="8" />
          <line x1="6" y1="11" x2="14" y2="11" />
          <line x1="8" y1="14" x2="12" y2="14" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="7" width="12" height="6" />
          <line x1="0" y1="10" x2="4" y2="10" />
          <line x1="16" y1="10" x2="20" y2="10" />
        </svg>
      );
  }
}

export function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const [search, setSearch] = useState('');
  const [draggingType, setDraggingType] = useState<ComponentType | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen for Ctrl+K dispatch from useCanvasInteractions. Per locked decision
  // #3 (focus-based disambiguation): Sidebar library search only claims the
  // shortcut when focus is ALREADY inside the sidebar-library surface. When
  // focus is on the canvas (or anywhere else), CommandPalette.tsx opens the
  // global palette instead. The omnispice:type-to-place event is also handled
  // here so type-to-place pre-fills the library search.
  useEffect(() => {
    const handleOpenPalette = () => {
      const active = document.activeElement;
      if (!active?.closest('[data-surface="sidebar-library"]')) return;
      if (sidebarCollapsed) {
        toggleSidebar();
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    };
    window.addEventListener('omnispice:open-command-palette', handleOpenPalette);
    return () => window.removeEventListener('omnispice:open-command-palette', handleOpenPalette);
  }, [sidebarCollapsed, toggleSidebar]);

  // Type-to-place: when the canvas insert cursor is active and the user
  // presses a printable letter, Sidebar pre-fills the library search with
  // that character and auto-focuses the input (decision #3, Pillar 2).
  useEffect(() => {
    const handleTypeToPlace = (event: Event) => {
      const detail = (event as CustomEvent).detail as { firstChar?: string } | undefined;
      const firstChar = detail?.firstChar ?? '';
      setSearch(firstChar);
      if (sidebarCollapsed) {
        toggleSidebar();
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    };
    window.addEventListener('omnispice:type-to-place', handleTypeToPlace);
    return () => window.removeEventListener('omnispice:type-to-place', handleTypeToPlace);
  }, [sidebarCollapsed, toggleSidebar]);

  const handleDragStart = useCallback((event: React.DragEvent, type: ComponentType) => {
    event.dataTransfer.setData(DND_MIME_TYPE, type);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingType(type);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingType(null);
  }, []);

  const toggleCategory = useCallback((key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Filter components based on search query
  const searchLower = search.toLowerCase();
  const filteredComponents = search
    ? Object.values(COMPONENT_LIBRARY).filter(
        (def) =>
          def.name.toLowerCase().includes(searchLower) ||
          def.type.toLowerCase().includes(searchLower) ||
          def.category.toLowerCase().includes(searchLower),
      )
    : null;

  return (
    <div
      className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}
      data-testid="sidebar-library"
      data-surface="sidebar-library"
    >
      {/* Collapse toggle */}
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Search bar (hidden when collapsed) */}
      {!sidebarCollapsed && (
        <div className={styles.searchContainer}>
          <Command className={styles.command} shouldFilter={false}>
            <div className={styles.searchInputWrapper}>
              <Command.Input
                ref={searchInputRef}
                value={search}
                onValueChange={setSearch}
                placeholder="Search components..."
                className={styles.searchInput}
                aria-label="Search components"
              />
              {search && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </Command>
        </div>
      )}

      {/* Component list */}
      <div className={styles.categoryList}>
        {filteredComponents !== null ? (
          // Search results view
          <>
            {filteredComponents.length === 0 ? (
              <div className={styles.noResults}>No components match &ldquo;{search}&rdquo;</div>
            ) : (
              filteredComponents.map(({ type, name }) => (
                <ComponentItem
                  key={type}
                  type={type as ComponentType}
                  name={name}
                  collapsed={sidebarCollapsed}
                  dragging={draggingType === type}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))
            )}
          </>
        ) : (
          // Categorized view
          CATEGORIES.map(({ key, label }) => {
            const components = GROUPED_COMPONENTS[key] ?? [];
            const isCategoryCollapsed = collapsedCategories.has(key);

            return (
              <div key={key} className={styles.category}>
                {/* Category header */}
                <button
                  type="button"
                  className={styles.categoryHeader}
                  onClick={() => toggleCategory(key)}
                  aria-expanded={!isCategoryCollapsed}
                  title={sidebarCollapsed ? label : undefined}
                >
                  {!sidebarCollapsed && (
                    <>
                      <span className={styles.categoryLabel}>{label}</span>
                      {isCategoryCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </>
                  )}
                </button>

                {/* Category items */}
                {!isCategoryCollapsed &&
                  components.map(({ type, def }) => (
                    <ComponentItem
                      key={type}
                      type={type}
                      name={def.name}
                      collapsed={sidebarCollapsed}
                      dragging={draggingType === type}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface ComponentItemProps {
  type: ComponentType;
  name: string;
  collapsed: boolean;
  dragging: boolean;
  onDragStart: (event: React.DragEvent, type: ComponentType) => void;
  onDragEnd: () => void;
}

function ComponentItem({
  type,
  name,
  collapsed,
  dragging,
  onDragStart,
  onDragEnd,
}: ComponentItemProps) {
  return (
    <div
      className={`${styles.componentItem} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      onDragEnd={onDragEnd}
      title={collapsed ? name : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${name} component`}
    >
      <span className={styles.componentIcon}>
        <ComponentIcon type={type} />
      </span>
      {!collapsed && <span className={styles.componentName}>{name}</span>}
    </div>
  );
}
