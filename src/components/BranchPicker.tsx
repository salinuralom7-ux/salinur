import { BRANCHES, ALL_BRANCHES } from '../data/branches';
import { useStore } from '../store/context';

export default function BranchPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { branchId, setBranch } = useStore();
  if (!open) return null;

  const dismissable = branchId !== null;

  const choose = (id: string) => {
    setBranch(id);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => dismissable && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Choose your branch"
    >
      <div className="modal branch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-modal-head">
          <h2>📍 Choose your store</h2>
          {dismissable && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <p className="muted">
          Pick the branch closest to you to see what's in stock there, plus its address, hours and
          direct WhatsApp line.
        </p>

        <div className="branch-options">
          {BRANCHES.map((b) => (
            <button
              key={b.id}
              className={`branch-option ${branchId === b.id ? 'selected' : ''}`}
              onClick={() => choose(b.id)}
            >
              <span className="branch-option-city">{b.city}</span>
              <span className="branch-option-area">{b.area}</span>
              <span className="branch-option-hours">{b.hours}</span>
            </button>
          ))}
        </div>

        <button className="btn btn-outline btn-block" onClick={() => choose(ALL_BRANCHES)}>
          Browse all branches together
        </button>
      </div>
    </div>
  );
}
