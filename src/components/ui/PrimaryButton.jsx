export default function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        " inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-brand-primary text-sm font-regular text-[#0D1B2A] shadow-sm transition hover:bg-brand-primaryDark hover:shadow-md focus-visible:outline-none focus-visible:ring-2  focus-visible:ring-brand-primary/70 disabled:opacity-60 disabled:cursor-not-allowed" +
        className
      }
    >
      {children}
    </button>
  );
}
