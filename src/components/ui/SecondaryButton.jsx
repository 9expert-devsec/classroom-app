export default function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl border border-admin-border bg-white text-xs text-admin-text shadow-sm transition hover:bg-admin-surfaceMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-border/80" +
        className
      }
    >
      {children}
    </button>
  );
}
