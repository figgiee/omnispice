import { Eye, EyeOff } from 'lucide-react';
import { useOverlayStore } from '@/overlay/overlayStore';
import styles from './OverlayToggle.module.css';

export function OverlayToggle() {
  const { isVisible, toggleVisibility, nodeVoltages } = useOverlayStore();
  const hasData = Object.keys(nodeVoltages).length > 0;

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={toggleVisibility}
      disabled={!hasData}
      title="Show/hide simulation overlay"
      aria-label={isVisible ? 'Hide overlay' : 'Show overlay'}
    >
      {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  );
}
