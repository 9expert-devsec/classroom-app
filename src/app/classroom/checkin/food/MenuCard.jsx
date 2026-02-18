export default function MenuCard({ menu, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col w-full items-center  rounded-2xl border p-3 shadow-sm transition ${
        active
          ? "border-2 border-[#66ccff] bg-[#66ccff]/20"
          : "border-brand-border bg-white"
      }`}
    >
      <img
        src={menu.image}
        className="w-24 h-24 rounded-xl object-cover"
        alt={menu.name}
      />
      <p className="mt-3 line-clamp-2 min-h-[2rem] text-center sm:text-xl lg:text-base font-medium">
        {menu.name}
      </p>
    </button>
  );
}
