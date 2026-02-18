export default function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        " inline-flex items-center justify-center gap-2  px-10 py-2 rounded-xl bg-brand-primary sm:text-2xl lg:text-base font-regular text-[#0D1B2A] shadow-sm transition hover:bg-brand-primaryDark hover:shadow-md focus-visible:outline-none focus-visible:ring-2  focus-visible:ring-brand-primary/70 disabled:opacity-60 disabled:cursor-not-allowed" +
        className
      }
    >
      {children}
    </button>
  );
}
