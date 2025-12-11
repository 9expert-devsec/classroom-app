export default function TextInput({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm text-front-text focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition " +
        className
      }
    />
  );
}
