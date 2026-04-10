/**
 * PredicateEditor dispatcher — routes a checkpoint to the right editor based
 * on its `kind`. Re-exports individual editors for tests.
 *
 * The dispatcher is the single place the editor UI needs to know about new
 * predicate kinds; adding a sixth predicate means adding a case here and a
 * new file alongside the others.
 */
import type { Checkpoint } from '@/labs/schema';
import { AcGainAtEditor } from './AcGainAtEditor';
import { BranchCurrentEditor } from './BranchCurrentEditor';
import { CircuitContainsEditor } from './CircuitContainsEditor';
import { NodeVoltageEditor } from './NodeVoltageEditor';
import { WaveformMatchEditor } from './WaveformMatchEditor';

export { AcGainAtEditor } from './AcGainAtEditor';
export { BranchCurrentEditor } from './BranchCurrentEditor';
export { CircuitContainsEditor } from './CircuitContainsEditor';
export { NodeVoltageEditor } from './NodeVoltageEditor';
export { WaveformMatchEditor } from './WaveformMatchEditor';

interface Props {
  predicate: Checkpoint;
  onChange: (next: Checkpoint) => void;
}

export function PredicateEditor({ predicate, onChange }: Props) {
  switch (predicate.kind) {
    case 'node_voltage':
      return <NodeVoltageEditor predicate={predicate} onChange={onChange} />;
    case 'branch_current':
      return <BranchCurrentEditor predicate={predicate} onChange={onChange} />;
    case 'waveform_match':
      return <WaveformMatchEditor predicate={predicate} onChange={onChange} />;
    case 'circuit_contains':
      return <CircuitContainsEditor predicate={predicate} onChange={onChange} />;
    case 'ac_gain_at':
      return <AcGainAtEditor predicate={predicate} onChange={onChange} />;
  }
}
