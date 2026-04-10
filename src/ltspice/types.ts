/**
 * Intermediate representation types for LTspice .asc file parsing.
 *
 * These types represent the raw parsed content of a .asc file before
 * mapping to the OmniSpice Circuit data model.
 */

export interface AscSymbol {
  name: string;         // lowercase symbol name: "res", "cap", "voltage", etc.
  x: number;
  y: number;
  orientation: string;  // "R0" | "R90" | "R180" | "R270" | "M0" | ...
  instName: string;     // from SYMATTR InstName
  value: string;        // from SYMATTR Value
  spiceModel?: string;  // from SYMATTR SpiceModel
}

export interface AscWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AscFlag {
  x: number;
  y: number;
  netName: string;      // "0" = ground
}

export interface AscCircuit {
  symbols: AscSymbol[];
  wires: AscWire[];
  flags: AscFlag[];
  directives: string[]; // SPICE directives (TEXT lines starting with "!")
}
