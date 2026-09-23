"use client";

import { useState } from "react";
import TextInput from "@/components/ui/TextInput";
import { ChevronDown, ChevronUp } from "lucide-react";
import Toggle from "./Toggle";

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}

export default function CategoryPanel({
  restaurantId,
  categories = [],
  loading = false,
  onChanged,
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return alert("กรุณากรอกชื่อหมวดหมู่");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/food/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "เพิ่มหมวดหมู่ไม่สำเร็จ");
      }
      setNewName("");
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่");
    } finally {
      setBusy(false);
    }
  }

  async function patchCategory(id, payload) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/food/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "แก้ไขหมวดหมู่ไม่สำเร็จ");
      }
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(c) {
    if (!confirm(`ต้องการลบหมวดหมู่ "${c.name}" หรือไม่?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/food/categories/${c._id}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
      if (!res.ok) {
        // 409 = ยังมีเมนูใช้หมวดหมู่นี้อยู่
        return alert(out.error || "ลบหมวดหมู่ไม่สำเร็จ");
      }
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบหมวดหมู่");
    } finally {
      setBusy(false);
    }
  }

  async function move(index, dir) {
    const next = [...categories];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);
    try {
      const res = await fetch("/api/admin/food/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          ids: next.map((c) => String(c._id)),
        }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "จัดลำดับหมวดหมู่ไม่สำเร็จ");
      }
      await onChanged?.();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการจัดลำดับหมวดหมู่");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(c) {
    const name = editingName.trim();
    if (!name) return alert("กรุณากรอกชื่อหมวดหมู่");
    setEditingId(null);
    if (name === c.name) return;
    await patchCategory(String(c._id), { name });
  }

  return (
    <div className="min-h-0 rounded-2xl bg-admin-surface p-4 shadow-slate-950/20 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">หมวดหมู่เมนู</h2>
          <p className="text-xs text-admin-textMuted">
            ใช้จัดกลุ่มเมนูในหน้าสั่งอาหารของผู้เรียน
          </p>
        </div>
        {(loading || busy) && (
          <span className="text-xs text-admin-textMuted">กำลังโหลด...</span>
        )}
      </div>

      <form onSubmit={handleAdd} className="mb-3 flex items-center gap-2">
        <div className="flex-1">
          <TextInput
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="เช่น ของคาว, ของหวาน, เครื่องดื่ม"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </form>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 overscroll-contain">
        {categories.map((c, i) => {
          const id = String(c._id);
          const isEditing = editingId === id;

          return (
            <div
              key={id}
              className="flex items-center gap-2 rounded-2xl border border-admin-border bg-white p-3"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                  title="เลื่อนขึ้น"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy || i === categories.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-0.5 text-admin-textMuted hover:bg-admin-surfaceMuted disabled:opacity-30"
                  title="เลื่อนลง"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <TextInput
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => saveRename(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveRename(c);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="block w-full truncate text-left font-semibold text-admin-text"
                    onClick={() => {
                      setEditingId(id);
                      setEditingName(c.name || "");
                    }}
                    title="คลิกเพื่อเปลี่ยนชื่อ"
                  >
                    {c.name}
                  </button>
                )}
                <div className="text-[11px] text-admin-textMuted">
                  {c.isActive === false ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </div>
              </div>

              <Toggle
                checked={c.isActive !== false}
                disabled={busy}
                label={`เปิดใช้งาน ${c.name}`}
                onChange={(v) => patchCategory(id, { isActive: v })}
              />

              <button
                type="button"
                disabled={busy}
                className="flex items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[11px] text-red-500 disabled:opacity-50"
                onClick={() => handleDelete(c)}
                title="ลบหมวดหมู่"
              >
                ลบ
              </button>
            </div>
          );
        })}

        {!loading && categories.length === 0 && (
          <p className="text-xs text-admin-textMuted">ยังไม่มีหมวดหมู่เมนู</p>
        )}
      </div>
    </div>
  );
}
