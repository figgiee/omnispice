/**
 * Pre-simulation circuit validator for OmniSpice.
 *
 * Validates a circuit before sending to ngspice, catching common errors
 * like missing ground, floating nodes, voltage source loops, and
 * disconnected components. Returns human-readable error messages
 * with fix suggestions per the UI-SPEC copywriting contract.
 */

import type { Circuit, Component } from './types';

export interface ValidationError {
  type: 'floating_node' | 'no_ground' | 'source_loop' | 'disconnected';
  message: string;
  suggestion: string;
  componentIds: string[];
  severity: 'error' | 'warning';
}

/**
 * Validate a circuit for common errors before simulation.
 *
 * Checks (in order):
 * 1. No ground: Every circuit needs a ground (node 0).
 * 2. Floating nodes: Ports not connected to any wire.
 * 3. Disconnected components: ALL ports of a component are unconnected.
 * 4. Voltage source loops: Two voltage sources sharing both nets.
 *
 * @returns Array of validation errors/warnings. Empty array = valid circuit.
 */
export function validateCircuit(circuit: Circuit): ValidationError[] {
  const errors: ValidationError[] = [];

  checkNoGround(circuit, errors);
  checkFloatingNodes(circuit, errors);
  checkDisconnectedComponents(circuit, errors);
  checkVoltageSourceLoops(circuit, errors);

  return errors;
}

/**
 * Check if the circuit has at least one ground component.
 */
function checkNoGround(circuit: Circuit, errors: ValidationError[]): void {
  const hasGround = [...circuit.components.values()].some((c) => c.type === 'ground');
  if (!hasGround) {
    errors.push({
      type: 'no_ground',
      message: 'No ground connection',
      suggestion:
        'Every node needs a path to ground (node 0). Add a ground symbol to your circuit.',
      componentIds: [],
      severity: 'error',
    });
  }
}

/**
 * Check for floating nodes (individual ports not connected to any wire).
 * Skips ground components (they only have one implicit connection).
 */
function checkFloatingNodes(circuit: Circuit, errors: ValidationError[]): void {
  // Build set of all port IDs that are connected by wires
  const connectedPortIds = new Set<string>();
  for (const wire of circuit.wires.values()) {
    connectedPortIds.add(wire.sourcePortId);
    connectedPortIds.add(wire.targetPortId);
  }

  for (const [id, comp] of circuit.components) {
    if (comp.type === 'ground') continue;

    for (const port of comp.ports) {
      if (!connectedPortIds.has(port.id)) {
        errors.push({
          type: 'floating_node',
          message: `${comp.refDesignator} pin "${port.name}" is not connected.`,
          suggestion: 'Connect this pin to complete the circuit.',
          componentIds: [id],
          severity: 'warning',
        });
      }
    }
  }
}

/**
 * Check for completely disconnected components (ALL ports unconnected).
 */
function checkDisconnectedComponents(circuit: Circuit, errors: ValidationError[]): void {
  const connectedPortIds = new Set<string>();
  for (const wire of circuit.wires.values()) {
    connectedPortIds.add(wire.sourcePortId);
    connectedPortIds.add(wire.targetPortId);
  }

  for (const [id, comp] of circuit.components) {
    if (comp.type === 'ground') continue;

    const allDisconnected = comp.ports.every((port) => !connectedPortIds.has(port.id));

    if (allDisconnected && comp.ports.length > 0) {
      errors.push({
        type: 'disconnected',
        message: `${comp.refDesignator} is completely disconnected from the circuit.`,
        suggestion: 'Connect at least one pin to make this component part of the circuit.',
        componentIds: [id],
        severity: 'warning',
      });
    }
  }
}

/**
 * Check for voltage source loops: two voltage sources sharing both nets.
 *
 * This is a simplified check -- two voltage sources directly in parallel
 * (sharing the same two nets) creates an invalid circuit in SPICE.
 */
function checkVoltageSourceLoops(circuit: Circuit, errors: ValidationError[]): void {
  const voltageSources: Array<{ id: string; comp: Component; nets: [string, string] }> = [];

  // Build set of connected port IDs for net computation
  const connectedPortIds = new Set<string>();
  for (const wire of circuit.wires.values()) {
    connectedPortIds.add(wire.sourcePortId);
    connectedPortIds.add(wire.targetPortId);
  }

  // Collect voltage sources with their net connections
  for (const [id, comp] of circuit.components) {
    const isVoltageSource =
      comp.type === 'dc_voltage' ||
      comp.type === 'ac_voltage' ||
      comp.type === 'pulse_voltage' ||
      comp.type === 'sin_voltage' ||
      comp.type === 'pwl_voltage';

    if (isVoltageSource && comp.ports.length >= 2) {
      const net1 = comp.ports[0]!.netId;
      const net2 = comp.ports[1]!.netId;
      if (net1 && net2) {
        voltageSources.push({
          id,
          comp,
          nets: [net1, net2],
        });
      }
    }
  }

  // Check all pairs of voltage sources for shared nets
  for (let i = 0; i < voltageSources.length; i++) {
    for (let j = i + 1; j < voltageSources.length; j++) {
      const a = voltageSources[i]!;
      const b = voltageSources[j]!;

      const sameNets =
        (a.nets[0] === b.nets[0] && a.nets[1] === b.nets[1]) ||
        (a.nets[0] === b.nets[1] && a.nets[1] === b.nets[0]);

      if (sameNets) {
        errors.push({
          type: 'source_loop',
          message: `Voltage source loop between ${a.comp.refDesignator} and ${b.comp.refDesignator}.`,
          suggestion: 'Remove one voltage source or add a resistor between them.',
          componentIds: [a.id, b.id],
          severity: 'error',
        });
      }
    }
  }
}
