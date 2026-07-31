export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="page-loader__ring" />
      <p className="page-loader__label">{label}</p>
    </div>
  );
}
