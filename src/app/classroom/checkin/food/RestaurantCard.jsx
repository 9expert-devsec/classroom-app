export default function RestaurantCard({ restaurant, active, onClick }) {
  const isCoupon = !!restaurant?.isCoupon;
  const couponAmount = Number(restaurant?.couponAmount) || 0;

  // ✅ ร้านที่เป็นคูปองวันนี้: ไม่มีโลโก้ก็ใช้รูปคูปองกลาง
  const logo = restaurant?.logo || (isCoupon ? "/coupon.png" : "");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-row gap-3 rounded-2xl border px-3 py-4 shadow-sm transition text-left ${
        active
          ? "border-2 border-[#66ccff] bg-[#66ccff]/20"
          : "border-brand-border bg-white"
      }`}
    >
      <img
        src={logo}
        className="flex h-full sm:w-36 lg:w-24 items-center justify-center rounded-xl  object-contain"
        alt={restaurant.name}
      />
      <div className="flex flex-col justify-center">
        <p className="sm:text-lg lg:text-base font-bold">{restaurant.name}</p>
        {isCoupon && couponAmount > 0 && (
          <p className="sm:text-base lg:text-sm text-front-textMuted">
            คูปองมูลค่า {couponAmount} บาท
          </p>
        )}
      </div>
    </button>
  );
}
