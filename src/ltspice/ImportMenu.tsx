/**
 * ImportMenu — toolbar button for importing LTspice .asc files.
 *
 * Reads the selected file as text, runs it through parseAsc → mapAscToCircuit,
 * then replaces the current circuit in the store via setCircuit.
 */

import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { mapAscToCircuit } from './mapper';
import { parseAsc } from './parser';
import styles from './ImportMenu.module.css';

export function ImportMenu() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setCircuit = useCircuitStore((s) => s.setCircuit);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const asc = parseAsc(content);
        const circuit = mapAscToCircuit(asc);
        setCircuit(circuit);
      } catch (err) {
        console.error('[OmniSpice] Failed to import .asc file:', err);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="file"
        accept=".asc"
        onChange={handleFile}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <button
        type="button"
        className={styles.btn}
        onClick={() => inputRef.current?.click()}
        title="Import LTspice .asc file"
        aria-label="Import LTspice schematic"
      >
        <Upload size={16} />
      </button>
    </div>
  );
}
