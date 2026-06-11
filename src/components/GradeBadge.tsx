import { GRADES } from '../data/grades';
import type { Grade } from '../types';

export default function GradeBadge({ grade, full = false }: { grade: Grade; full?: boolean }) {
  const info = GRADES[grade];
  return (
    <span className="grade-badge" style={{ backgroundColor: info.color }} title={info.name}>
      Grade {grade}
      {full && <span className="grade-badge-label"> · {info.label}</span>}
    </span>
  );
}
