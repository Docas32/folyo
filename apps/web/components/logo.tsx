export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`folyo-logo ${className}`}>
      <img src="/favicon.svg" width="36" height="36" alt="" />
      <span>Folyo</span>
    </span>
  );
}
