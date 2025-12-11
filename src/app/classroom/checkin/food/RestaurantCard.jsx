export default function RestaurantCard({ restaurant, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-4 shadow-sm transition text-left ${
        active
          ? "border-brand-primary bg-front-bgSoft"
          : "border-brand-border bg-white"
      }`}
    >
      <img
        src={restaurant.logo}
        className="h-10 w-auto object-contain"
        alt={restaurant.name}
      />
      <p className="mt-2 text-sm font-medium">{restaurant.name}</p>
    </button>
  );
}
