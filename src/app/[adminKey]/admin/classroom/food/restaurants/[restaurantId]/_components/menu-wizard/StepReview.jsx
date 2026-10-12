"use client";

import { Pencil } from "lucide-react";
import { MenuImage } from "../MenuBits";
import { formatPrice, isRecommendedCategory, sortCategories } from "../menuUi";

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2 py-1 text-sm">
      <span className="text-admin-textMuted">{label}</span>
      <span className="min-w-0 break-words text-admin-text">{children}</span>
    </div>
  );
}

function OptionColumn({ title, children, empty }) {
  return (
    <div className="min-w-0 rounded-xl border border-admin-border p-3">
      <div className="mb-1 text-sm font-semibold text-brand-primaryDark">{title}</div>
      {empty ? <div className="text-xs text-admin-textMuted">—</div> : children}
    </div>
  );
}

export default function StepReview({ form, categories, addons, drinks, onEditInfo, error }) {
  const catById = new Map(sortCategories(categories).map((c) => [String(c._id), c]));
  const cats = sortCategories(categories).filter((c) => form.categoryIds.includes(String(c._id)));
  const pick = (items, ids) => {
    const byId = new Map(items.map((x) => [String(x._id), x.name]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  };
  const addonNames = pick(addons, form.addonIds);
  const drinkNames = pick(drinks, form.drinkIds);
  const preview = { imageUrl: form.imageUrl, name: form.name };
  const price = String(form.price).trim() === "" ? "ยังไม่มีราคา" : formatPrice(Number(form.price));

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center gap-3 rounded-2xl border border-admin-border p-3">
        <MenuImage menu={preview} sizes="64px" className="h-16 w-16 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{form.name || "—"}</div>
          <div className="text-sm">{price}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {cats.map((c) => (
              <span
                key={String(c._id)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  c.isActive === false
                    ? "bg-slate-100 text-slate-500 line-through"
                    : isRecommendedCategory(c)
                      ? "bg-orange-100 text-orange-700"
                      : "bg-brand-primary/15 text-brand-primaryDark"
                }`}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onEditInfo}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl border border-brand-primary/60 px-3 py-1.5 text-sm text-brand-primaryDark hover:bg-brand-primary/10"
        >
          <Pencil className="h-3.5 w-3.5" /> แก้ไข
        </button>
      </div>

      {/* menu info */}
      <div className="grid gap-4 rounded-2xl border border-admin-border p-4 md:grid-cols-[minmax(0,1fr)_160px]">
        <div>
          <div className="mb-1 text-sm font-semibold">ข้อมูลเมนู</div>
          <Row label="ชื่อเมนู">{form.name || "—"}</Row>
          <Row label="ราคา">{price}</Row>
          <Row label="หมวดหมู่">
            {form.categoryIds.length
              ? form.categoryIds
                  .map((id) => catById.get(id))
                  .filter(Boolean)
                  .map((c) => (c.isActive === false ? `${c.name} (ปิดใช้งาน)` : c.name))
                  .join(", ") || "—"
              : "—"}
          </Row>
          <Row label="ลำดับการแสดงผล">{form.sortOrder || "0"}</Row>
          <Row label="คำอธิบาย">{form.description.trim() || "—"}</Row>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">รูปเมนู</div>
          <MenuImage menu={preview} sizes="160px" className="aspect-square w-full" />
        </div>
      </div>

      {/* options */}
      <div>
        <div className="mb-2 text-sm font-semibold">ตัวเลือกเพิ่มเติม</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OptionColumn title={`Add-on (${addonNames.length})`} empty={!addonNames.length}>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {addonNames.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </OptionColumn>
          <OptionColumn title={`Drink (${drinkNames.length})`} empty={!drinkNames.length}>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {drinkNames.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </OptionColumn>
          <OptionColumn
            title={`ตัวเลือก (${form.optionGroups.length} กลุ่ม)`}
            empty={!form.optionGroups.length}
          >
            <div className="space-y-2 text-xs">
              {form.optionGroups.map((g) => (
                <div key={g._uiKey}>
                  <div className="font-medium">
                    {g.name || "—"}{" "}
                    <span className="font-normal text-admin-textMuted">
                      ({g.required ? "บังคับ" : "ไม่บังคับ"} · {g.selectType === "multi" ? "เลือกได้หลายอย่าง" : "เลือก 1 อย่าง"})
                    </span>
                  </div>
                  <ul className="list-disc pl-4">
                    {(g.choices || []).map((c) => (
                      <li key={c._uiKey} className={c.isActive === false ? "text-admin-textMuted line-through" : ""}>
                        {c.name || "—"} ({Number(c.priceDelta) > 0 ? `+${Number(c.priceDelta)} บาท` : "ฟรี"})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </OptionColumn>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
