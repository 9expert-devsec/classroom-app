export default function RestaurantCard({ restaurant, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-row gap-3 rounded-2xl border px-3 py-4 shadow-sm transition text-left ${
        active
          ? "border-brand-primary bg-front-bgSoft"
          : "border-brand-border bg-white"
      }`}
    >
      <img
        src={restaurant.logo}
        className="flex h-full sm:w-36 lg:w-24 items-center justify-center rounded-xl  object-contain"
        alt={restaurant.name}
      />
      <p className="flex items-center sm:text-lg lg:text-base font-bold">{restaurant.name}</p>
      
    </button>
  );
}
