export default function TextInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-brand-border bg-white sm:p-3 lg:p-2 sm:text-2xl lg:text-base text-front-text focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition " +
        className
      }
    />
  );
}
