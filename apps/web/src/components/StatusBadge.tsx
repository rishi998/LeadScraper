const STATUS_CLASS: Record<string, string> = {
  RUNNING: 'status-running',
  COMPLETED: 'status-completed',
  PARTIALLY_COMPLETED: 'status-partial',
  FAILED: 'status-failed',
  CANCELLED: 'status-cancelled',
  CREATED: 'status-created',
  PENDING: 'status-pending',
  HOT: 'priority-hot',
  WARM: 'priority-warm',
  REVIEW: 'priority-review',
  LOW: 'priority-low',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? 'status-default';
  const label = status.replace(/_/g, ' ');
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = STATUS_CLASS[priority] ?? 'status-default';
  return <span className={`status-badge ${cls}`}>{priority}</span>;
}
