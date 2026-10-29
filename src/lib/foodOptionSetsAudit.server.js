// src/lib/foodOptionSetsAudit.server.js
//
// OS-3: audit attach / detach / remove ของชุดตัวเลือกที่เกิดจากการบันทึกเมนู (POST/PUT เมนู)
// แยกจาก foodOptionSets.server.js เพราะไฟล์นั้น import ได้จาก Node ตรง ๆ (ไม่มี alias @/)
import { writeAuditLog } from "@/lib/auditLog.server";
import { linkedGroupChanges } from "@/lib/foodOptionSets.server";

const ACTIONS = {
  attached: "food.option_set_attach",
  detached: "food.option_set_detach",
  removed: "food.option_set_remove",
};

/** best-effort เหมือน safeAudit ของ route เมนู — ไม่ทำให้การบันทึกเมนูล้ม */
export async function auditMenuOptionSetChanges({ ctx, req, menu, beforeGroups }) {
  const changes = linkedGroupChanges(beforeGroups || [], menu?.optionGroups || []);
  for (const [kind, rows] of Object.entries(changes)) {
    for (const r of rows) {
      try {
        await writeAuditLog({
          ctx,
          req,
          action: ACTIONS[kind],
          entityType: "FoodMenu",
          entityId: String(menu._id),
          entityLabel: menu.name || "",
          meta: { via: "menu_save", setId: r.setId, groupId: r.groupId, groupName: r.name },
        });
      } catch (e) {
        console.error("writeAuditLog failed:", e);
      }
    }
  }
}
