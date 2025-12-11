export default function MenuCard({ menu, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 shadow-sm transition ${
        active
          ? "border-brand-primary bg-front-bgSoft"
          : "border-brand-border bg-white"
      }`}
    >
      <img
        src={menu.image}
        className="h-16 w-16 rounded-xl object-cover"
        alt={menu.name}
      />
      <div className="text-left">
        <p className="text-sm font-medium">{menu.name}</p>
      </div>
    </button>
  );
}
