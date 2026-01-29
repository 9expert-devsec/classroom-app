// src/app/admin/classroom/food/page.jsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { redirect } from "next/navigation";

/** แปลงข้อความหลายบรรทัด -> array ของ string */
function parseLines(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function FoodAdminPage() {
  redirect("/admin/classroom/food/restaurants");
  // ร้านอาหาร
  const [restaurants, setRestaurants] = useState([]);
  const [restName, setRestName] = useState("");
  const [restLogoUrl, setRestLogoUrl] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);

  // เมนูของร้านที่เลือก
  const [menus, setMenus] = useState([]);
  const [menuName, setMenuName] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");
  const [menuAddon, setMenuAddon] = useState("");
  const [menuDrinks, setMenuDrinks] = useState("");
  const [editingMenuId, setEditingMenuId] = useState(null);

  // ชุดเมนู (FoodSet) ของร้านที่เลือก
  const [sets, setSets] = useState([]);
  const [setName, setSetName] = useState("");
  const [setMenuIds, setSetMenuIds] = useState([]); // array ของ menu._id (string)
  const [editingSetId, setEditingSetId] = useState(null);

  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [loadingSets, setLoadingSets] = useState(false);

  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [savingSet, setSavingSet] = useState(false);

  // loading state ตอนอัพรูป
  const [uploadingRestLogo, setUploadingRestLogo] = useState(false);
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);

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

  async function handleUploadRestLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRestLogo(true);
    try {
      const url = await uploadImage(file);
      setRestLogoUrl(url);
    } catch (err) {
      console.error(err);
      alert("อัพโหลดโลโก้ร้านไม่สำเร็จ");
    } finally {
      setUploadingRestLogo(false);
      e.target.value = "";
    }
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

  /* ---------------------- โหลดร้านอาหารทั้งหมด ---------------------- */
  useEffect(() => {
    let cancelled = false;

    async function fetchRestaurants() {
      setLoadingRestaurants(true);
      try {
        const res = await fetch("/api/admin/food/restaurants", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled) {
          setRestaurants(data.items || []);
          // ถ้ายังไม่ได้เลือกร้าน ให้เลือกอันแรก
          if (!selectedRestaurantId && data.items?.length) {
            setSelectedRestaurantId(String(data.items[0]._id));
          }
        }
      } catch (err) {
        console.error("load restaurants error", err);
        if (!cancelled) {
          alert("โหลดรายการร้านอาหารไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoadingRestaurants(false);
      }
    }

    fetchRestaurants();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------- โหลดเมนูของร้านที่เลือก ---------------------- */
  useEffect(() => {
    if (!selectedRestaurantId) {
      setMenus([]);
      setSets([]);
      return;
    }

    let cancelled = false;

    async function fetchMenus() {
      setLoadingMenus(true);
      try {
        const res = await fetch(
          `/api/admin/food/menu?restaurantId=${encodeURIComponent(
            selectedRestaurantId
          )}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!cancelled) {
          setMenus(data.items || []);
        }
      } catch (err) {
        console.error("load menus error", err);
        if (!cancelled) alert("โหลดรายการเมนูไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoadingMenus(false);
      }
    }

    async function fetchSets() {
      setLoadingSets(true);
      try {
        const res = await fetch(
          `/api/admin/food/sets?restaurantId=${encodeURIComponent(
            selectedRestaurantId
          )}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!cancelled) {
          setSets(data.items || []);
        }
      } catch (err) {
        console.error("load sets error", err);
        if (!cancelled) alert("โหลดชุดเมนูไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoadingSets(false);
      }
    }

    fetchMenus();
    fetchSets();

    return () => {
      cancelled = true;
    };
  }, [selectedRestaurantId]);

  /* ---------------------- บันทึกข้อมูลร้านอาหาร (create / update) ---------------------- */
  async function handleSaveRestaurant(e) {
    e.preventDefault();
    if (!restName.trim()) {
      alert("กรุณากรอกชื่อร้านอาหาร");
      return;
    }

    setSavingRestaurant(true);
    try {
      const payload = {
        name: restName.trim(),
        logoUrl: restLogoUrl.trim() || null,
      };

      let res;
      if (editingRestaurantId) {
        // UPDATE
        res = await fetch(
          `/api/admin/food/restaurants/${editingRestaurantId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      } else {
        // CREATE
        res = await fetch("/api/admin/food/restaurants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        alert(out.error || "บันทึกร้านอาหารไม่สำเร็จ");
        return;
      }

      const resList = await fetch("/api/admin/food/restaurants", {
        cache: "no-store",
      });
      const dataList = await resList.json();
      setRestaurants(dataList.items || []);

      setRestName("");
      setRestLogoUrl("");
      setEditingRestaurantId(null);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกร้านอาหาร");
    } finally {
      setSavingRestaurant(false);
    }
  }

  function handleEditRestaurant(r) {
    setEditingRestaurantId(String(r._id));
    setRestName(r.name || "");
    setRestLogoUrl(r.logoUrl || "");
    setSelectedRestaurantId(String(r._id));
  }

  async function handleDeleteRestaurant(id) {
    if (!confirm("ต้องการลบร้านอาหารนี้หรือไม่?")) return;

    try {
      const res = await fetch(`/api/admin/food/restaurants/${id}`, {
        method: "DELETE",
      });
      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        alert(out.error || "ลบร้านอาหารไม่สำเร็จ");
        return;
      }

      const resList = await fetch("/api/admin/food/restaurants", {
        cache: "no-store",
      });
      const dataList = await resList.json();
      setRestaurants(dataList.items || []);

      if (String(selectedRestaurantId) === String(id)) {
        setSelectedRestaurantId(
          dataList.items?.[0] ? String(dataList.items[0]._id) : ""
        );
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบร้านอาหาร");
    }
  }

  /* ---------------------- บันทึกเมนูของร้านที่เลือก (create / update) ---------------------- */
  async function handleSaveMenu(e) {
    e.preventDefault();
    if (!selectedRestaurantId) {
      alert("กรุณาเลือกร้านอาหารทางด้านขวาก่อน");
      return;
    }
    if (!menuName.trim()) {
      alert("กรุณากรอกชื่อเมนู");
      return;
    }

    setSavingMenu(true);
    try {
      const payload = {
        restaurantId: selectedRestaurantId,
        name: menuName.trim(),
        imageUrl: menuImageUrl.trim() || null,
        // ส่งเป็น array ให้ backend
        addons: parseLines(menuAddon),
        drinks: parseLines(menuDrinks),
      };

      let res;
      if (editingMenuId) {
        res = await fetch(`/api/admin/food/menu/${editingMenuId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/food/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        alert(out.error || "บันทึกเมนูไม่สำเร็จ");
        return;
      }

      const resList = await fetch(
        `/api/admin/food/menu?restaurantId=${encodeURIComponent(
          selectedRestaurantId
        )}`,
        { cache: "no-store" }
      );
      const dataList = await resList.json();
      setMenus(dataList.items || []);

      setMenuName("");
      setMenuImageUrl("");
      setMenuAddon("");
      setMenuDrinks("");
      setEditingMenuId(null);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกเมนู");
    } finally {
      setSavingMenu(false);
    }
  }

  function handleEditMenu(m) {
    setEditingMenuId(String(m._id));
    setMenuName(m.name || "");
    setMenuImageUrl(m.imageUrl || "");
    setMenuAddon((m.addons || []).join("\n"));
    setMenuDrinks((m.drinks || []).join("\n"));
  }

  async function handleDeleteMenu(id) {
    if (!confirm("ต้องการลบเมนูนี้หรือไม่?")) return;

    try {
      const res = await fetch(`/api/admin/food/menu/${id}`, {
        method: "DELETE",
      });
      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        alert(out.error || "ลบเมนูไม่สำเร็จ");
        return;
      }

      const resList = await fetch(
        `/api/admin/food/menu?restaurantId=${encodeURIComponent(
          selectedRestaurantId
        )}`,
        { cache: "no-store" }
      );
      const dataList = await resList.json();
      setMenus(dataList.items || []);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบเมนู");
    }
  }

  /* ---------------------- ชุดเมนู (FoodSet) ---------------------- */
  async function handleSaveSet(e) {
    e.preventDefault();
    if (!selectedRestaurantId) {
      alert("กรุณาเลือกร้านอาหารก่อน");
      return;
    }
    if (!setName.trim()) {
      alert("กรุณากรอกชื่อชุดเมนู");
      return;
    }

    setSavingSet(true);
    try {
      const payload = {
        restaurant: selectedRestaurantId,
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
        alert(out.error || "บันทึกชุดเมนูไม่สำเร็จ");
        return;
      }

      // reload sets
      const resList = await fetch(
        `/api/admin/food/sets?restaurantId=${encodeURIComponent(
          selectedRestaurantId
        )}`,
        { cache: "no-store" }
      );
      const dataList = await resList.json();
      setSets(dataList.items || []);

      setSetName("");
      setSetMenuIds([]);
      setEditingSetId(null);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกชุดเมนู");
    } finally {
      setSavingSet(false);
    }
  }

  function handleEditSet(s) {
    setEditingSetId(String(s._id));
    setSetName(s.name || "");
    // menuIds อาจเป็น ObjectId หรือ populated object
    const ids = (s.menuIds || []).map((m) =>
      typeof m === "string" ? m : String(m._id)
    );
    setSetMenuIds(ids);
  }

  async function handleDeleteSet(id) {
    if (!confirm("ต้องการลบชุดเมนูนี้หรือไม่?")) return;

    try {
      const res = await fetch(`/api/admin/food/sets/${id}`, {
        method: "DELETE",
      });
      const out = await res.json();
      if (!res.ok) {
        console.error(out);
        alert(out.error || "ลบชุดเมนูไม่สำเร็จ");
        return;
      }

      const resList = await fetch(
        `/api/admin/food/sets?restaurantId=${encodeURIComponent(
          selectedRestaurantId
        )}`,
        { cache: "no-store" }
      );
      const dataList = await resList.json();
      setSets(dataList.items || []);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบชุดเมนู");
    }
  }

  /* ---------------------- render ---------------------- */

  const selectedRestaurant =
    restaurants.find((r) => String(r._id) === String(selectedRestaurantId)) ||
    null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Food Menu Admin</h1>
      <p className="text-sm text-admin-textMuted">
        จัดการร้านอาหารและเมนูสำหรับใช้ในหน้าจอเลือกอาหารของผู้เรียน (Step 2)
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- ฟอร์มเพิ่ม/แก้ร้านอาหาร + เมนู + ชุดเมนู ---------------- */}
        <div className="space-y-6">
          {/* ฟอร์มร้าน */}
          <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
            <h2 className="mb-3 text-base font-semibold">
              {editingRestaurantId ? "แก้ไขร้านอาหาร" : "เพิ่มร้านอาหาร"}
            </h2>

            <form onSubmit={handleSaveRestaurant} className="space-y-3">
              <label className="block text-sm">
                <span className="text-admin-text">ชื่อร้าน</span>
                <TextInput
                  value={restName}
                  onChange={(e) => setRestName(e.target.value)}
                  placeholder="เช่น Kaizen Sushi Hibachi"
                />
              </label>

              <label className="block text-sm">
                <span className="text-admin-text">โลโก้ร้าน (URL รูป)</span>
                <TextInput
                  value={restLogoUrl}
                  onChange={(e) => setRestLogoUrl(e.target.value)}
                  placeholder="วางลิงก์รูปจาก Cloudinary / CDN หรือกดปุ่มอัพโหลดด้านล่าง"
                />
              </label>

              {/* ปุ่มอัพโหลดโลโก้ */}
              <div className="flex items-center gap-3">
                <input
                  id="restLogoFile"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadRestLogo}
                />
                <label
                  htmlFor="restLogoFile"
                  className="inline-flex cursor-pointer items-center rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
                >
                  {uploadingRestLogo
                    ? "กำลังอัพโหลด..."
                    : "อัพโหลดรูปจากเครื่อง"}
                </label>
              </div>

              {/* preview โลโก้ */}
              {restLogoUrl && (
                <div className="mt-2 inline-flex items-center gap-3 rounded-xl bg-admin-surfaceMuted px-3 py-2">
                  <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white/40">
                    <Image
                      src={restLogoUrl}
                      alt={restName || "โลโก้ร้าน"}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-xs text-front-text">
                    {restName || "ชื่อร้าน"}
                  </span>
                </div>
              )}

              <PrimaryButton type="submit" disabled={savingRestaurant}>
                {savingRestaurant
                  ? "กำลังบันทึก..."
                  : editingRestaurantId
                  ? "อัปเดตร้านอาหาร"
                  : "บันทึกร้านอาหาร"}
              </PrimaryButton>
            </form>
          </div>

          {/* ฟอร์มเมนู */}
          <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
            <h2 className="mb-3 text-base font-semibold">
              {editingMenuId ? "แก้ไขเมนู" : "เพิ่มเมนู (กรุณาเลือกร้านก่อน)"}
            </h2>

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
                  placeholder="วางลิงก์รูปจาก Cloudinary / CDN หรือกดปุ่มอัพโหลดด้านล่าง"
                />
              </label>

              {/* ปุ่มอัพโหลดรูปเมนู */}
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
                  {uploadingMenuImage
                    ? "กำลังอัพโหลด..."
                    : "อัพโหลดรูปจากเครื่อง"}
                </label>
              </div>

              {/* preview รูปเมนู */}
              {menuImageUrl && (
                <div className="mt-2 inline-flex items-center gap-3 rounded-xl bg-admin-surfaceMuted px-3 py-2">
                  <div className="relative h-14 w-20 overflow-hidden rounded-lg bg-white/40">
                    <Image
                      src={menuImageUrl}
                      alt={menuName || "รูปเมนู"}
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
                  Add-on (หนึ่งบรรทัดต่อ 1 รายการ เช่น ไข่เพิ่ม, ข้าวเพิ่ม)
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
                  เครื่องดื่ม (หนึ่งบรรทัดต่อ 1 รายการ เช่น โค้ก, ชาเขียว,
                  น้ำเปล่า)
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  rows={2}
                  value={menuDrinks}
                  onChange={(e) => setMenuDrinks(e.target.value)}
                />
              </label>

              <PrimaryButton type="submit" disabled={savingMenu}>
                {savingMenu
                  ? "กำลังบันทึก..."
                  : editingMenuId
                  ? "อัปเดตเมนู"
                  : "บันทึกเมนู"}
              </PrimaryButton>
            </form>
          </div>

          {/* ฟอร์ม + list ชุดเมนู */}
          <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">ชุดเมนูของร้านนี้</h2>
              {loadingSets && (
                <span className="text-xs text-admin-textMuted">
                  กำลังโหลด...
                </span>
              )}
            </div>

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
              <div className="max-h-40 overflow-y-auto space-y-1 text-sm border rounded-xl p-2 border-admin-border bg-white">
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

              <PrimaryButton type="submit" disabled={savingSet}>
                {savingSet
                  ? "กำลังบันทึก..."
                  : editingSetId
                  ? "อัปเดตชุดเมนู"
                  : "บันทึกชุดเมนู"}
              </PrimaryButton>
            </form>

            {/* list เซ็ต */}
            <div className="mt-4 space-y-2 text-sm">
              {sets.map((s) => {
                // แมป id -> ชื่อเมนูจาก state menus
                const menuNames =
                  (s.menuIds || [])
                    .map((id) => {
                      const key =
                        typeof id === "string" ? id : String(id._id || id);
                      return menus.find((m) => String(m._id) === key)?.name;
                    })
                    .filter(Boolean) || [];

                return (
                  <div
                    key={s._id}
                    className="rounded-xl border border-admin-border px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{s.name}</div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                          onClick={() => handleEditSet(s)}
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500"
                          onClick={() => handleDeleteSet(s._id)}
                        >
                          -
                        </button>
                      </div>
                    </div>
                    {menuNames.length > 0 && (
                      <div className="mt-1 text-[11px] text-admin-textMuted">
                        เมนูในชุดนี้: {menuNames.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}

              {!sets.length && (
                <p className="text-xs text-admin-textMuted">
                  ยังไม่มีชุดเมนูสำหรับร้านนี้
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- list ร้าน & เมนู ---------------- */}
        <div className="space-y-6">
          {/* รายการร้านอาหารทั้งหมด */}
          <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">ร้านอาหารทั้งหมด</h2>
              {loadingRestaurants && (
                <span className="text-xs text-admin-textMuted">
                  กำลังโหลด...
                </span>
              )}
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto">
              {restaurants.map((r) => {
                const isActive = String(r._id) === String(selectedRestaurantId);
                return (
                  <div
                    key={r._id}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      isActive
                        ? "bg-brand-primary/10 text-brand-primary"
                        : "hover:bg-admin-surfaceMuted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRestaurantId(String(r._id))}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-white/40">
                        {r.logoUrl && (
                          <Image
                            src={r.logoUrl}
                            alt={r.name || "โลโก้ร้าน"}
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{r.name}</div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                        onClick={() => handleEditRestaurant(r)}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500"
                        onClick={() => handleDeleteRestaurant(r._id)}
                      >
                        -
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loadingRestaurants && restaurants.length === 0 && (
                <p className="text-xs text-admin-textMuted">
                  ยังไม่มีร้านอาหารในระบบ
                </p>
              )}
            </div>
          </div>

          {/* เมนูของร้านที่เลือก */}
          <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">เมนูของร้านที่เลือก</h2>
              {selectedRestaurant && (
                <span className="text-xs text-admin-textMuted">
                  ร้าน: {selectedRestaurant.name}
                </span>
              )}
            </div>

            {loadingMenus && (
              <p className="text-xs text-admin-textMuted">กำลังโหลดเมนู...</p>
            )}

            {!loadingMenus && menus.length === 0 && selectedRestaurant && (
              <p className="text-xs text-admin-textMuted">
                ยังไม่มีเมนูสำหรับร้านนี้
              </p>
            )}

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {menus.map((m) => (
                <div
                  key={m._id}
                  className="flex items-start gap-3 rounded-xl border border-admin-border px-3 py-2 text-sm"
                >
                  <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/40">
                    {m.imageUrl && (
                      <Image
                        src={m.imageUrl}
                        alt={m.name || "เมนู"}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{m.name}</div>
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

                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="rounded-full px-2 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                      onClick={() => handleEditMenu(m)}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500"
                      onClick={() => handleDeleteMenu(m._id)}
                    >
                      -
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
