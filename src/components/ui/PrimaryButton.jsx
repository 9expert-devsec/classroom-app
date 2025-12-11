export default function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-2xl bg-brand-primary px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-brand-primaryDark " +
        className
      }
    >
      {children}
    </button>
  );
}
