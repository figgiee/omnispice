/**
 * Download a SPICE netlist string as a .cir file.
 * The caller is responsible for generating the netlist string
 * (use generateNetlist from src/circuit/netlister.ts).
 */
export function exportNetlist(netlistString: string, filename = 'circuit.cir'): void {
  const blob = new Blob([netlistString], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
