"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";

/** แปลงข้อความหลายบรรทัด -> array ของ string */
function parseLines(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Modal เบาๆ (ไม่พึ่ง lib) */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="close overlay"
      />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-admin-text">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-admin-surfaceMuted"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function RestaurantDetailPage({ params }) {
  const router = useRouter();
  const restaurantId = params.restaurantId;

  // data
  const [restaurant, setRestaurant] = useState(null);
  const [menus, setMenus] = useState([]);
  const [sets, setSets] = useState([]);

  // loading
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [loadingSets, setLoadingSets] = useState(false);

  // upload
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);

  // modals
  const [openMenuModal, setOpenMenuModal] = useState(false);
  const [openSetModal, setOpenSetModal] = useState(false);

  // menu form
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuName, setMenuName] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");
  const [menuAddon, setMenuAddon] = useState("");
  const [menuDrinks, setMenuDrinks] = useState("");
  const [savingMenu, setSavingMenu] = useState(false);

  // set form
  const [editingSetId, setEditingSetId] = useState(null);
  const [setName, setSetName] = useState("");
  const [setMenuIds, setSetMenuIds] = useState([]);
  const [savingSet, setSavingSet] = useState(false);

  // search/filter
  const [q, setQ] = useState("");

  /* ---------------- helper อัพโหลดรูปไป Cloudinary ---------------- */
  async function uploadImage(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/food/upload", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    if (!res.ok || !data.url) {
      console.error("upload error:", data);
      throw new Error(data.error || "upload_failed");
    }
    return data.url;
  }

  async function handleUploadMenuImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMenuImage(true);
    try {
      const url = await uploadImage(file);
      setMenuImageUrl(url);
    } catch (err) {
      console.error(err);
      alert("อัพโหลดรูปเมนูไม่สำเร็จ");
    } finally {
      setUploadingMenuImage(false);
      e.target.value = "";
    }
  }

  /* ---------------- fetchers ---------------- */
  async function fetchRestaurant() {
    setLoadingRestaurant(true);
    try {
      // ถ้า backend คุณไม่มี endpoint นี้ ให้เปลี่ยนเป็น fetch list แล้ว find ก็ได้
      const res = await fetch("/api/admin/food/restaurants", { cache: "no-store" });
      const data = await res.json();
      const found =
        (data.items || []).find((r) => String(r._id) === String(restaurantId)) ||
        null;
      setRestaurant(found);
    } catch (err) {
      console.error(err);
      alert("โหลดข้อมูลร้านไม่สำเร็จ");
    } finally {
      setLoadingRestaurant(false);
    }
  }

  async function fetchMenus() {
    setLoadingMenus(true);
    try {
      const res = await fetch(
        `/api/admin/food/menu?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setMenus(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลดรายการเมนูไม่สำเร็จ");
    } finally {
      setLoadingMenus(false);
    }
  }

  async function fetchSets() {
    setLoadingSets(true);
    try {
      const res = await fetch(
        `/api/admin/food/sets?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setSets(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลดชุดเมนูไม่สำเร็จ");
    } finally {
      setLoadingSets(false);
    }
  }

  useEffect(() => {
    fetchRestaurant();
    fetchMenus();
    fetchSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  /* ---------------- derived ---------------- */
  const filteredMenus = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return menus;
    return menus.filter((m) => String(m.name || "").toLowerCase().includes(kw));
  }, [menus, q]);

  /* ---------------- menu actions ---------------- */
  function openNewMenu() {
    setEditingMenuId(null);
    setMenuName("");
    setMenuImageUrl("");
    setMenuAddon("");
    setMenuDrinks("");
    setOpenMenuModal(true);
  }

  function openEditMenu(m) {
    setEditingMenuId(String(m._id));
    setMenuName(m.name || "");
    setMenuImageUrl(m.imageUrl || "");
    setMenuAddon((m.addons || []).join("\n"));
    setMenuDrinks((m.drinks || []).join("\n"));
    setOpenMenuModal(true);
  }

  async function handleSaveMenu(e) {
    e.preventDefault();
    if (!menuName.trim()) return alert("กรุณากรอกชื่อเมนู");

    setSavingMenu(true);
    try {
      const payload = {
        restaurantId,
        name: menuName.trim(),
        imageUrl: menuImageUrl.trim() || null,
        addons: parseLines(menuAddon),
        drinks: parseLines(menuDrinks),
      };

      const url = editingMenuId
        ? `/api/admin/food/menu/${editingMenuId}`
        : "/api/admin/food/menu";
      const method = editingMenuId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "บันทึกเมนูไม่สำเร็จ");
      }

      await fetchMenus();
      setOpenMenuModal(false);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกเมนู");
    } finally {
      setSavingMenu(false);
    }
  }

  async function handleDeleteMenu(id) {
    if (!confirm("ต้องการลบเมนูนี้หรือไม่?")) return;
    try {
      const res = await fetch(`/api/admin/food/menu/${id}`, { method: "DELETE" });
      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "ลบเมนูไม่สำเร็จ");
      }
      await fetchMenus();
      await fetchSets(); // กันกรณี set อ้างอิงเมนูนี้ (เพื่อ refresh view)
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบเมนู");
    }
  }

  /* ---------------- set actions ---------------- */
  function openNewSet() {
    setEditingSetId(null);
    setSetName("");
    setSetMenuIds([]);
    setOpenSetModal(true);
  }

  function openEditSet(s) {
    setEditingSetId(String(s._id));
    setSetName(s.name || "");
    const ids = (s.menuIds || []).map((m) =>
      typeof m === "string" ? m : String(m._id)
    );
    setSetMenuIds(ids);
    setOpenSetModal(true);
  }

  async function handleSaveSet(e) {
    e.preventDefault();
    if (!setName.trim()) return alert("กรุณากรอกชื่อชุดเมนู");

    setSavingSet(true);
    try {
      const payload = {
        restaurant: restaurantId, // ตาม backend เดิมของคุณ
        name: setName.trim(),
        menuIds: setMenuIds,
      };

      const url = editingSetId
        ? `/api/admin/food/sets/${editingSetId}`
        : "/api/admin/food/sets";
      const method = editingSetId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "บันทึกชุดเมนูไม่สำเร็จ");
      }

      await fetchSets();
      setOpenSetModal(false);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกชุดเมนู");
    } finally {
      setSavingSet(false);
    }
  }

  async function handleDeleteSet(id) {
    if (!confirm("ต้องการลบชุดเมนูนี้หรือไม่?")) return;
    try {
      const res = await fetch(`/api/admin/food/sets/${id}`, { method: "DELETE" });
      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "ลบชุดเมนูไม่สำเร็จ");
      }
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบชุดเมนู");
    }
  }

  /* ---------------- render ---------------- */
  return (
    <div className="flex h-[calc(100vh-64px)] min-h-0 flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.push("/admin/classroom/food/restaurants")}
            className="text-xs text-admin-textMuted hover:underline"
          >
            ← กลับไปร้านทั้งหมด
          </button>

          <h1 className="mt-2 text-xl font-semibold">
            {loadingRestaurant ? "กำลังโหลด..." : restaurant?.name || "Vendor"}
          </h1>
          <p className="text-sm text-admin-textMuted">
            จัดการ Menu Set และเมนูทั้งหมดของร้านนี้
          </p>
        </div>

        {restaurant?.logoUrl && (
          <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-white/40">
            <Image
              src={restaurant.logoUrl}
              alt={restaurant.name || "logo"}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        )}
      </div>

      <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ================= LEFT: MENU SET ================= */}
        <div className="min-h-0 rounded-2xl bg-admin-surface p-4 shadow-slate-950/20 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">MENU SET</h2>
            <div className="flex items-center gap-2">
              {loadingSets && (
                <span className="text-xs text-admin-textMuted">กำลังโหลด...</span>
              )}
              <button
                type="button"
                onClick={openNewSet}
                className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                New Set
              </button>
            </div>
          </div>

          {/* list sets */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
            {sets.map((s) => {
              const menuNames =
                (s.menuIds || [])
                  .map((id) => {
                    const key = typeof id === "string" ? id : String(id._id || id);
                    return menus.find((m) => String(m._id) === key)?.name;
                  })
                  .filter(Boolean) || [];

              return (
                <div
                  key={s._id}
                  className="rounded-2xl border border-admin-border bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-admin-text">{s.name}</div>
                      <div className="mt-1 text-[11px] text-admin-textMuted">
                        {menuNames.length
                          ? `เมนูในชุด: ${menuNames.join(", ")}`
                          : "ยังไม่ได้เลือกเมนูในชุด"}
                      </div>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                        onClick={() => openEditSet(s)}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className="flex p-2 items-center justify-center rounded-full bg-red-50 text-red-500"
                        onClick={() => handleDeleteSet(s._id)}
                        title="ลบชุด"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loadingSets && sets.length === 0 && (
              <p className="text-xs text-admin-textMuted">ยังไม่มีชุดเมนู</p>
            )}
          </div>
        </div>

        {/* ================= RIGHT: MENU LIST ================= */}
        <div className="min-h-0 rounded-2xl bg-admin-surface p-4 shadow-slate-950/20 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">MENU LIST</h2>

            <button
              type="button"
              onClick={openNewMenu}
              className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Add Menu
            </button>
          </div>

          {/* search */}
          <div className="mb-3">
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาเมนู..."
            />
            {loadingMenus && (
              <div className="mt-2 text-xs text-admin-textMuted">กำลังโหลดเมนู...</div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
            {filteredMenus.map((m) => (
              <div
                key={m._id}
                className="flex items-start gap-3 rounded-2xl border border-admin-border bg-white p-3"
              >
                <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white/40">
                  {m.imageUrl && (
                    <Image
                      src={m.imageUrl}
                      alt={m.name || "menu"}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-admin-text">{m.name}</div>
                  {(m.addons?.length || m.drinks?.length) && (
                    <div className="mt-1 text-[11px] text-admin-textMuted">
                      {m.addons?.length > 0 && (
                        <div>
                          <span className="font-semibold">Add-on:</span>{" "}
                          {m.addons.join(", ")}
                        </div>
                      )}
                      {m.drinks?.length > 0 && (
                        <div>
                          <span className="font-semibold">Drinks:</span>{" "}
                          {m.drinks.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                    onClick={() => openEditMenu(m)}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    className="flex p-2 items-center justify-center rounded-full bg-red-50 text-red-500"
                    onClick={() => handleDeleteMenu(m._id)}
                    title="ลบเมนู"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))}

            {!loadingMenus && filteredMenus.length === 0 && (
              <p className="text-xs text-admin-textMuted">ยังไม่มีเมนู</p>
            )}
          </div>
        </div>
      </div>

      {/* ================= Menu Modal ================= */}
      <Modal
        open={openMenuModal}
        title={editingMenuId ? "แก้ไขเมนู" : "เพิ่มเมนู"}
        onClose={() => setOpenMenuModal(false)}
      >
        <form onSubmit={handleSaveMenu} className="space-y-3">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อเมนู</span>
            <TextInput
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              placeholder="เช่น สเต็กไก่กรอบเทอริยากิ"
            />
          </label>

          <label className="block text-sm">
            <span className="text-admin-text">รูปเมนู (URL รูป)</span>
            <TextInput
              value={menuImageUrl}
              onChange={(e) => setMenuImageUrl(e.target.value)}
              placeholder="วางลิงก์รูป หรือกดอัพโหลดด้านล่าง"
            />
          </label>

          <div className="flex items-center gap-3">
            <input
              id="menuImageFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadMenuImage}
            />
            <label
              htmlFor="menuImageFile"
              className="inline-flex cursor-pointer items-center rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
            >
              {uploadingMenuImage ? "กำลังอัพโหลด..." : "อัพโหลดรูปจากเครื่อง"}
            </label>
          </div>

          {menuImageUrl && (
            <div className="mt-1 inline-flex items-center gap-3 rounded-xl bg-admin-surfaceMuted px-3 py-2">
              <div className="relative h-14 w-20 overflow-hidden rounded-lg bg-white/40">
                <Image
                  src={menuImageUrl}
                  alt={menuName || "menu"}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs text-front-text">
                {menuName || "ชื่อเมนู"}
              </span>
            </div>
          )}

          <label className="block text-sm">
            <span className="text-admin-text">
              Add-on (หนึ่งบรรทัดต่อ 1 รายการ)
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              rows={2}
              value={menuAddon}
              onChange={(e) => setMenuAddon(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="text-admin-text">
              เครื่องดื่ม (หนึ่งบรรทัดต่อ 1 รายการ)
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              rows={2}
              value={menuDrinks}
              onChange={(e) => setMenuDrinks(e.target.value)}
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpenMenuModal(false)}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
            >
              ยกเลิก
            </button>
            <PrimaryButton type="submit" disabled={savingMenu}>
              {savingMenu
                ? "กำลังบันทึก..."
                : editingMenuId
                ? "อัปเดตเมนู"
                : "บันทึกเมนู"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* ================= Set Modal ================= */}
      <Modal
        open={openSetModal}
        title={editingSetId ? "แก้ไขชุดเมนู" : "สร้างชุดเมนูใหม่"}
        onClose={() => setOpenSetModal(false)}
      >
        <form onSubmit={handleSaveSet} className="space-y-3">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อชุดเมนู</span>
            <TextInput
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="เช่น Set A, Set B"
            />
          </label>

          <div className="text-xs text-admin-text mb-1">
            เลือกเมนูที่จะอยู่ในชุดนี้
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 text-sm border rounded-xl p-2 border-admin-border bg-white">
            {menus.map((m) => {
              const id = String(m._id);
              const checked = setMenuIds.includes(id);
              return (
                <label
                  key={m._id}
                  className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-admin-surfaceMuted/70"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={checked}
                      onChange={() =>
                        setSetMenuIds((prev) =>
                          prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id]
                        )
                      }
                    />
                    <span>{m.name}</span>
                  </div>
                </label>
              );
            })}
            {!menus.length && (
              <p className="text-[11px] text-admin-textMuted">
                ยังไม่มีเมนูในร้านนี้ ให้เพิ่มเมนูก่อน
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpenSetModal(false)}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
            >
              ยกเลิก
            </button>
            <PrimaryButton type="submit" disabled={savingSet}>
              {savingSet
                ? "กำลังบันทึก..."
                : editingSetId
                ? "อัปเดตชุดเมนู"
                : "บันทึกชุดเมนู"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
