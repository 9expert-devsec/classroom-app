export default function DrinkCard({ drink, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-1 text-sm ${
        active
          ? "bg-brand-primary text-white border-brand-primary"
          : "bg-white text-front-text border-brand-border"
      }`}
    >
      {drink}
    </button>
  );
}
