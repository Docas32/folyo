export function RouteSkeleton() {
  return (
    <main className="route-skeleton" aria-busy="true">
      <span className="skeleton-line skeleton-heading" />
      <div className="skeleton-card">
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
      </div>
    </main>
  );
}
