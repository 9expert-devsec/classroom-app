// src/lib/lunchMenu.server.js
//
// เมนู DTO ของร้านหนึ่งร้านสำหรับวันหนึ่ง — ก้อนเดียวที่หน้าเมนู หน้ารายละเอียดเมนู
// และ GET /api/lunch/[token]/menu ใช้ร่วมกัน ราคาใน DTO เป็นของปัจจุบันเสมอ
import FoodMenu from "@/models/FoodMenu";
import FoodMenuCategory from "@/models/FoodMenuCategory";

/** daySet entry ของร้านนั้น (อาจเป็น undefined) */
export function entryOf(daySet, restaurantId) {
  return (daySet?.entries || []).find(
    (e) => String(e.restaurant) === String(restaurantId),
  );
}

export async function loadRestaurantMenu({ daySet, restaurantId }) {
  const entry = entryOf(daySet, restaurantId);
  // เมนูที่ร้านแจ้งว่าหมดเฉพาะวันนี้
  const soldOut = new Set((entry?.soldOutMenuIds || []).map((x) => String(x)));

  const [categories, menus] = await Promise.all([
    FoodMenuCategory.find({ restaurant: restaurantId, isActive: { $ne: false } })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select("name")
      .lean(),
    FoodMenu.find({ restaurant: restaurantId, isActive: { $ne: false } })
      .sort({ sortOrder: 1, name: 1 })
      .select("name imageUrl price description categoryIds optionGroups")
      .lean(),
  ]);

  return {
    categories: categories.map((c) => ({ id: String(c._id), name: c.name || "" })),
    menus: menus.map((m) => ({
      id: String(m._id),
      name: m.name || "",
      image: m.imageUrl || "",
      price: m.price ?? null,
      description: m.description || "",
      categoryIds: (m.categoryIds || []).map((x) => String(x)),
      unavailableToday: soldOut.has(String(m._id)),
      optionGroups: (m.optionGroups || []).map((g) => ({
        id: String(g._id),
        name: g.name || "",
        required: !!g.required,
        selectType: g.selectType === "multi" ? "multi" : "single",
        choices: (g.choices || [])
          .filter((c) => c?.isActive !== false)
          .map((c) => ({
            id: String(c._id),
            name: c.name || "",
            priceDelta: c.priceDelta || 0,
          })),
      })),
    })),
  };
}
