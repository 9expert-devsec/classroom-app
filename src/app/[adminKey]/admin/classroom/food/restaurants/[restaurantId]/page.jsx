// src/app/admin/classroom/food/restaurants/[restaurantId]/page.jsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import TextInput from "@/components/ui/TextInput";
import { MIN_MENU_IMAGE_W } from "@/lib/menuImage";
import PrimaryButton from "@/components/ui/PrimaryButton";

import CouponSettingsCard from "./_components/CouponSettingsCard";
import CouponStockCard from "./_components/CouponStockCard";
import RestaurantTabs from "./_components/RestaurantTabs";
import MenuTab from "./_components/MenuTab";
import SetsTab from "./_components/SetsTab";
import LibraryTab from "./_components/LibraryTab";
import CategoryManagerModal from "./_components/CategoryManagerModal";
import { useListParams } from "./_components/menuUi";
import OptionGroupsEditor, {
  toEditorGroups,
  toPayloadGroups,
} from "./_components/OptionGroupsEditor";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

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
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl max-h-[calc(100svh-2rem)] flex flex-col">
        <div className="p-4 pb-3 border-b border-admin-border/60">
        <div className="flex items-center justify-between">
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
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function uniq(arr) {
  return Array.from(new Set((arr || []).map((x) => String(x)).filter(Boolean)));
}

function toggleId(list, id) {
  const s = String(id);
  return list.includes(s) ? list.filter((x) => x !== s) : [...list, s];
}

/** ความกว้างจริงของไฟล์รูป (0 = อ่านไม่ได้ เช่น ฟอร์แมตที่เบราว์เซอร์ถอดไม่ได้) */
async function imageWidthOf(file) {
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width;
    bmp.close?.();
    return w;
  } catch {
    return 0;
  }
}

function toIdString(x) {
  if (!x) return "";
  if (typeof x === "string") return String(x);
  if (typeof x === "object") {
    if (x._id) return String(x._id);
  }
  return String(x);
}

async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}

export default function RestaurantDetailPage({ params }) {
  return (
    <Suspense fallback={null}>
      <RestaurantDetail params={params} />
    </Suspense>
  );
}

function RestaurantDetail({ params }) {
  const router = useRouter();
  const restaurantId = params.restaurantId;
  const [listParams, setListParams] = useListParams();
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // P1c follow-up: adminKey มาจาก route ไม่ฮาร์ดโค้ดอีกต่อไป
  const routeParams = useParams();
  const adminKey = String(routeParams?.adminKey || "");

  // data
  const [restaurant, setRestaurant] = useState(null);
  const [menus, setMenus] = useState([]);
  const [sets, setSets] = useState([]);

  const [addonsList, setAddonsList] = useState([]);
  const [drinksList, setDrinksList] = useState([]);

  // ✅ lunch pre-order (P1b)
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // loading
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [loadingDrinks, setLoadingDrinks] = useState(false);

  // upload
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);
  const [uploadingAddonImage, setUploadingAddonImage] = useState(false);
  const [uploadingDrinkImage, setUploadingDrinkImage] = useState(false);

  // modals
  const [openMenuModal, setOpenMenuModal] = useState(false);
  const [openSetModal, setOpenSetModal] = useState(false);
  const [openAddonModal, setOpenAddonModal] = useState(false);
  const [openDrinkModal, setOpenDrinkModal] = useState(false);

  // menu form
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuName, setMenuName] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");
  // ความกว้างจริงของไฟล์ที่เพิ่งเลือก ถ้าเล็กกว่า MIN_MENU_IMAGE_W (0 = ไม่ต้องเตือน)
  const [menuImageSmallW, setMenuImageSmallW] = useState(0);
  const [savingMenu, setSavingMenu] = useState(false);

  // ✅ new: ids (ผูกจริง)
  const [menuAddonIds, setMenuAddonIds] = useState([]);
  const [menuDrinkIds, setMenuDrinkIds] = useState([]);

  // ✅ modal search (แยกจากหน้า list)
  const [qMenuAddon, setQMenuAddon] = useState("");
  const [qMenuDrink, setQMenuDrink] = useState("");

  // ✅ menu form: ฟิลด์ใหม่สำหรับร้านคูปอง (P1b)
  const [menuCategoryIds, setMenuCategoryIds] = useState([]);
  const [menuPrice, setMenuPrice] = useState("");
  const [menuDescription, setMenuDescription] = useState("");
  const [menuSortOrder, setMenuSortOrder] = useState("0");
  const [menuOptionGroups, setMenuOptionGroups] = useState([]);

  // set form
  const [editingSetId, setEditingSetId] = useState(null);
  const [setName, setSetName] = useState("");
  const [setMenuIds, setSetMenuIds] = useState([]);
  const [savingSet, setSavingSet] = useState(false);

  // addon form
  const [editingAddonId, setEditingAddonId] = useState(null);
  const [addonName, setAddonName] = useState("");
  const [addonImageUrl, setAddonImageUrl] = useState("");
  const [savingAddon, setSavingAddon] = useState(false);

  // drink form
  const [editingDrinkId, setEditingDrinkId] = useState(null);
  const [drinkName, setDrinkName] = useState("");
  const [drinkImageUrl, setDrinkImageUrl] = useState("");
  const [savingDrink, setSavingDrink] = useState(false);

  // search/filter (page)
  const [qAddon, setQAddon] = useState("");
  const [qDrink, setQDrink] = useState("");

  /* ---------------- upload to Cloudinary ---------------- */
  async function uploadImage(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/food/upload", {
      method: "POST",
      body: form,
    });

    const data = await safeJson(res);
    if (!res.ok || !data.url) {
      console.error("upload error:", data);
      throw new Error(data.error || "upload_failed");
    }
    return { url: data.url, publicId: data.publicId || "" };
  }

  async function handleUploadMenuImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // รูปเล็กแค่เตือน ไม่บล็อกการอัพโหลด (หน้าเมนูมือถือแสดงกว้างเต็มจอ)
    const w = await imageWidthOf(file);
    setMenuImageSmallW(w > 0 && w < MIN_MENU_IMAGE_W ? w : 0);
    setUploadingMenuImage(true);
    try {
      const out = await uploadImage(file);
      setMenuImageUrl(out.url);
    } catch (err) {
      console.error(err);
      alert("อัพโหลดรูปเมนูไม่สำเร็จ");
    } finally {
      setUploadingMenuImage(false);
      e.target.value = "";
    }
  }

  async function handleUploadAddonImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAddonImage(true);
    try {
      const out = await uploadImage(file);
      setAddonImageUrl(out.url);
    } catch (err) {
      console.error(err);
      alert("อัพโหลดรูป Add-on ไม่สำเร็จ");
    } finally {
      setUploadingAddonImage(false);
      e.target.value = "";
    }
  }

  async function handleUploadDrinkImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDrinkImage(true);
    try {
      const out = await uploadImage(file);
      setDrinkImageUrl(out.url);
    } catch (err) {
      console.error(err);
      alert("อัพโหลดรูป Drink ไม่สำเร็จ");
    } finally {
      setUploadingDrinkImage(false);
      e.target.value = "";
    }
  }

  /* ---------------- fetchers ---------------- */
  async function fetchRestaurant() {
    setLoadingRestaurant(true);
    try {
      const res = await fetch("/api/admin/food/restaurants", {
        cache: "no-store",
      });
      const data = await safeJson(res);
      const found =
        (data.items || []).find(
          (r) => String(r._id) === String(restaurantId),
        ) || null;
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
        { cache: "no-store" },
      );
      const data = await safeJson(res);
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
        { cache: "no-store" },
      );
      const data = await safeJson(res);
      setSets(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลดชุดเมนูไม่สำเร็จ");
    } finally {
      setLoadingSets(false);
    }
  }

  async function fetchAddons() {
    setLoadingAddons(true);
    try {
      const res = await fetch(
        `/api/admin/food/addons?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const data = await safeJson(res);
      setAddonsList(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลด Add-on ไม่สำเร็จ");
    } finally {
      setLoadingAddons(false);
    }
  }

  async function fetchDrinks() {
    setLoadingDrinks(true);
    try {
      const res = await fetch(
        `/api/admin/food/drinks?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const data = await safeJson(res);
      setDrinksList(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลด Drink ไม่สำเร็จ");
    } finally {
      setLoadingDrinks(false);
    }
  }

  async function fetchCategories() {
    setLoadingCategories(true);
    try {
      const res = await fetch(
        `/api/admin/food/categories?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const data = await safeJson(res);
      setCategories(data.items || []);
    } catch (err) {
      console.error(err);
      alert("โหลดหมวดหมู่เมนูไม่สำเร็จ");
    } finally {
      setLoadingCategories(false);
    }
  }

  useEffect(() => {
    fetchRestaurant();
    fetchMenus();
    fetchSets();
    fetchAddons();
    fetchDrinks();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  /* ---------------- derived ---------------- */

  // the menu form only offers active categories; ids of disabled ones the
  // menu already has stay in menuCategoryIds and are saved unchanged
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories],
  );
  const activeCategoryIdSet = useMemo(
    () => new Set(activeCategories.map((c) => String(c._id))),
    [activeCategories],
  );
  const pickedActiveCategoryCount = menuCategoryIds.filter((id) =>
    activeCategoryIdSet.has(id),
  ).length;
  const hiddenPickedCategoryCount =
    menuCategoryIds.length - pickedActiveCategoryCount;

  const filteredAddons = useMemo(() => {
    const kw = qAddon.trim().toLowerCase();
    const list = addonsList || [];
    if (!kw) return list;
    return list.filter((x) =>
      String(x.name || "")
        .toLowerCase()
        .includes(kw),
    );
  }, [addonsList, qAddon]);

  const filteredDrinks = useMemo(() => {
    const kw = qDrink.trim().toLowerCase();
    const list = drinksList || [];
    if (!kw) return list;
    return list.filter((x) =>
      String(x.name || "")
        .toLowerCase()
        .includes(kw),
    );
  }, [drinksList, qDrink]);

  const activeAddons = useMemo(() => {
    return (addonsList || []).filter((a) => a?.isActive !== false);
  }, [addonsList]);

  const activeDrinks = useMemo(() => {
    return (drinksList || []).filter((d) => d?.isActive !== false);
  }, [drinksList]);

  const filteredMenuAddons = useMemo(() => {
    const kw = qMenuAddon.trim().toLowerCase();
    const list = activeAddons;
    if (!kw) return list;
    return list.filter((x) =>
      String(x.name || "")
        .toLowerCase()
        .includes(kw),
    );
  }, [activeAddons, qMenuAddon]);

  const filteredMenuDrinks = useMemo(() => {
    const kw = qMenuDrink.trim().toLowerCase();
    const list = activeDrinks;
    if (!kw) return list;
    return list.filter((x) =>
      String(x.name || "")
        .toLowerCase()
        .includes(kw),
    );
  }, [activeDrinks, qMenuDrink]);

  /* ---------------- menu actions ---------------- */
  function openNewMenu() {
    setEditingMenuId(null);
    setMenuName("");
    setMenuImageUrl("");
    setMenuImageSmallW(0);

    setMenuAddonIds([]);
    setMenuDrinkIds([]);

    setQMenuAddon("");
    setQMenuDrink("");

    // ✅ P1b
    setMenuCategoryIds([]);
    setMenuPrice("");
    setMenuDescription("");
    setMenuSortOrder("0");
    setMenuOptionGroups([]);

    setOpenMenuModal(true);
  }

  function openEditMenu(m) {
    setEditingMenuId(String(m._id));
    setMenuName(m.name || "");
    setMenuImageUrl(m.imageUrl || "");
    setMenuImageSmallW(0);

    setMenuAddonIds(uniq((m.addonIds || []).map(toIdString)));
    setMenuDrinkIds(uniq((m.drinkIds || []).map(toIdString)));

    setQMenuAddon("");
    setQMenuDrink("");

    // ✅ P1b
    setMenuCategoryIds(uniq((m.categoryIds || []).map(toIdString)));
    setMenuPrice(
      m.price === null || m.price === undefined ? "" : String(m.price),
    );
    setMenuDescription(m.description || "");
    setMenuSortOrder(String(m.sortOrder ?? 0));
    setMenuOptionGroups(toEditorGroups(m.optionGroups));

    setOpenMenuModal(true);
  }

  async function handleSaveMenu(e) {
    e.preventDefault();
    if (!menuName.trim()) return alert("กรุณากรอกชื่อเมนู");

    // กันเลือกของที่ถูก disable (กรองด้วย active list)
    const activeAddonIdSet = new Set(activeAddons.map((a) => String(a._id)));
    const activeDrinkIdSet = new Set(activeDrinks.map((d) => String(d._id)));

    const cleanAddonIds = uniq(menuAddonIds).filter((id) =>
      activeAddonIdSet.has(String(id)),
    );
    const cleanDrinkIds = uniq(menuDrinkIds).filter((id) =>
      activeDrinkIdSet.has(String(id)),
    );

    // ✅ P1b: ตรวจเบื้องต้นฝั่ง client (server ตรวจซ้ำอยู่แล้ว)
    const priceRaw = String(menuPrice).trim();
    if (priceRaw !== "") {
      const n = Number(priceRaw);
      if (!Number.isFinite(n) || n < 0) {
        return alert("ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      }
    }
    for (const g of menuOptionGroups) {
      if (!String(g.name || "").trim()) {
        return alert("กรุณากรอกชื่อกลุ่มตัวเลือกให้ครบ");
      }
      if (!(g.choices || []).length) {
        return alert(`กลุ่ม "${g.name}" ต้องมีตัวเลือกอย่างน้อย 1 รายการ`);
      }
      for (const c of g.choices || []) {
        if (!String(c.name || "").trim()) {
          return alert(`กรุณากรอกชื่อตัวเลือกในกลุ่ม "${g.name}" ให้ครบ`);
        }
      }
    }

    setSavingMenu(true);
    try {
      const payload = {
        restaurantId,
        name: menuName.trim(),
        imageUrl: menuImageUrl.trim() || "",

        // ✅ new refs
        addonIds: cleanAddonIds,
        drinkIds: cleanDrinkIds,

        // ✅ P1b
        categoryIds: menuCategoryIds,
        price: priceRaw === "" ? null : Number(priceRaw),
        description: menuDescription.trim(),
        sortOrder: Number(menuSortOrder) || 0,
        optionGroups: toPayloadGroups(menuOptionGroups),
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

      const out = await safeJson(res);
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
      const res = await fetch(`/api/admin/food/menu/${id}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "ลบเมนูไม่สำเร็จ");
      }
      await fetchMenus();
      await fetchSets();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบเมนู");
    }
  }

  // optimistic on/off; rolls back if the save fails
  async function handleToggleMenuActive(m, next) {
    const id = String(m._id);
    const setActive = (value) =>
      setMenus((prev) =>
        prev.map((x) => (String(x._id) === id ? { ...x, isActive: value } : x)),
      );

    setActive(next);
    try {
      const res = await fetch(`/api/admin/food/menu/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const out = await safeJson(res);
      if (!res.ok) throw new Error(out.error || "เปลี่ยนสถานะเมนูไม่สำเร็จ");
    } catch (err) {
      console.error(err);
      setActive(m.isActive !== false);
      toast.error(err?.message || "เปลี่ยนสถานะเมนูไม่สำเร็จ");
    }
  }

  // category changes can also change menus (delete detaches them)
  async function refreshCategoriesAndMenus() {
    await Promise.all([fetchCategories(), fetchMenus()]);
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
      typeof m === "string" ? m : String(m._id),
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
        restaurant: restaurantId,
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

      const out = await safeJson(res);
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
      const res = await fetch(`/api/admin/food/sets/${id}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
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

  /* ---------------- addon actions ---------------- */
  function openNewAddon() {
    setEditingAddonId(null);
    setAddonName("");
    setAddonImageUrl("");
    setOpenAddonModal(true);
  }

  function openEditAddon(a) {
    setEditingAddonId(String(a._id));
    setAddonName(a.name || "");
    setAddonImageUrl(a.imageUrl || "");
    setOpenAddonModal(true);
  }

  async function handleSaveAddon(e) {
    e.preventDefault();
    if (!addonName.trim()) return alert("กรุณากรอกชื่อ Add-on");

    setSavingAddon(true);
    try {
      const payload = {
        restaurantId,
        name: addonName.trim(),
        imageUrl: addonImageUrl.trim() || "",
        imagePublicId: "",
      };

      const url = editingAddonId
        ? `/api/admin/food/addons/${editingAddonId}`
        : "/api/admin/food/addons";
      const method = editingAddonId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "บันทึก Add-on ไม่สำเร็จ");
      }

      await fetchAddons();
      setOpenAddonModal(false);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก Add-on");
    } finally {
      setSavingAddon(false);
    }
  }

  async function handleDisableAddon(a) {
    const id = String(a?._id || "");
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/food/addons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "disable ไม่สำเร็จ");
      }
      await fetchAddons();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการ disable Add-on");
    }
  }

  async function handleDeleteAddon(a) {
    const id = String(a?._id || "");
    if (!id) return;
    if (!confirm("ต้องการลบ Add-on นี้หรือไม่?")) return;
    try {
      const res = await fetch(`/api/admin/food/addons/${id}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "ลบ Add-on ไม่สำเร็จ");
      }
      await fetchAddons();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบ Add-on");
    }
  }

  /* ---------------- drink actions ---------------- */
  function openNewDrink() {
    setEditingDrinkId(null);
    setDrinkName("");
    setDrinkImageUrl("");
    setOpenDrinkModal(true);
  }

  function openEditDrink(d) {
    setEditingDrinkId(String(d._id));
    setDrinkName(d.name || "");
    setDrinkImageUrl(d.imageUrl || "");
    setOpenDrinkModal(true);
  }

  async function handleSaveDrink(e) {
    e.preventDefault();
    if (!drinkName.trim()) return alert("กรุณากรอกชื่อ Drink");

    setSavingDrink(true);
    try {
      const payload = {
        restaurantId,
        name: drinkName.trim(),
        imageUrl: drinkImageUrl.trim() || "",
        imagePublicId: "",
      };

      const url = editingDrinkId
        ? `/api/admin/food/drinks/${editingDrinkId}`
        : "/api/admin/food/drinks";
      const method = editingDrinkId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "บันทึก Drink ไม่สำเร็จ");
      }

      await fetchDrinks();
      setOpenDrinkModal(false);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก Drink");
    } finally {
      setSavingDrink(false);
    }
  }

  async function handleDisableDrink(d) {
    const id = String(d?._id || "");
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/food/drinks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "disable ไม่สำเร็จ");
      }
      await fetchDrinks();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการ disable Drink");
    }
  }

  async function handleDeleteDrink(d) {
    const id = String(d?._id || "");
    if (!id) return;
    if (!confirm("ต้องการลบ Drink นี้หรือไม่?")) return;
    try {
      const res = await fetch(`/api/admin/food/drinks/${id}`, {
        method: "DELETE",
      });
      const out = await safeJson(res);
      if (!res.ok) {
        console.error(out);
        return alert(out.error || "ลบ Drink ไม่สำเร็จ");
      }
      await fetchDrinks();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบ Drink");
    }
  }

  /* ---------------- render ---------------- */
  const tabCounts = {
    menus: menus.length,
    sets: sets.length,
    addons: addonsList.length,
    drinks: drinksList.length,
  };

  return (
    // ✅ P1b-fix: layout แม่ (<main>) เป็น overflow-hidden และส่ง slot ที่สูงคงที่มาให้
    // (flex-1 min-h-0) หน้านี้จึงต้องสูงเท่า slot แล้วเลื่อนในตัวเอง
    <div className="flex h-full flex-col gap-5 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {restaurant?.logoUrl && (
            <div className="relative mt-6 h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-white/40">
              <Image
                src={restaurant.logoUrl}
                alt={restaurant.name || "logo"}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            <button
              type="button"
              onClick={() =>
                router.push(`/${adminKey}/admin/classroom/food/restaurants`)
              }
              className="text-xs text-admin-textMuted hover:underline"
            >
              ← กลับไปร้านทั้งหมด
            </button>
            <h1 className="mt-1 truncate text-2xl font-bold">
              {loadingRestaurant ? "กำลังโหลด..." : restaurant?.name || "Vendor"}
            </h1>
            <p className="text-sm text-admin-textMuted">
              จัดการเมนูอาหาร ชุดอาหาร และตัวเลือกเพิ่มเติม
            </p>
          </div>
        </div>

        <PrimaryButton onClick={openNewMenu}>
          <Plus className="h-4 w-4" />
          เพิ่มเมนู
        </PrimaryButton>
      </div>

      {/* coupon settings (existing) */}
      <div className="grid shrink-0 gap-5 lg:grid-cols-2">
        <CouponSettingsCard
          restaurant={restaurant}
          onSaved={(item) => setRestaurant(item)}
        />
        {/* P2: คลังคูปองกระดาษ แสดงเฉพาะร้านที่เปิดใช้ stock */}
        {restaurant?.usesCouponStock && (
          <CouponStockCard
            restaurant={restaurant}
            adminKey={adminKey}
            onSaved={(item) => setRestaurant(item)}
          />
        )}
      </div>

      <div className="shrink-0 space-y-4 rounded-2xl bg-admin-surface p-4 shadow-sm">
        <RestaurantTabs
          tab={listParams.tab}
          counts={tabCounts}
          onChange={(tab) =>
            setListParams({ tab: tab === "menus" ? "" : tab, q: "", cat: "", status: "" })
          }
        />

        {listParams.tab === "menus" && (
          <MenuTab
            menus={menus}
            categories={categories}
            loading={loadingMenus}
            couponEnabled={!!restaurant?.couponEnabled}
            params={listParams}
            setParams={setListParams}
            onAdd={openNewMenu}
            onEdit={openEditMenu}
            onDelete={(m) => handleDeleteMenu(m._id)}
            onToggleActive={handleToggleMenuActive}
            onManageCategories={() => setCategoryManagerOpen(true)}
          />
        )}
        {listParams.tab === "sets" && (
          <SetsTab
            sets={sets}
            menus={menus}
            loading={loadingSets}
            onNew={openNewSet}
            onEdit={openEditSet}
            onDelete={handleDeleteSet}
          />
        )}
        {listParams.tab === "addons" && (
          <LibraryTab
            label="Add-on"
            description="สร้าง Add-on (พร้อมรูป) แล้วนำไปผูกกับเมนู"
            items={filteredAddons}
            q={qAddon}
            setQ={setQAddon}
            loading={loadingAddons}
            onNew={openNewAddon}
            onEdit={openEditAddon}
            onDelete={handleDeleteAddon}
          />
        )}
        {listParams.tab === "drinks" && (
          <LibraryTab
            label="Drink"
            description="สร้าง Drink (พร้อมรูป) แล้วนำไปผูกกับเมนู"
            items={filteredDrinks}
            q={qDrink}
            setQ={setQDrink}
            loading={loadingDrinks}
            onNew={openNewDrink}
            onEdit={openEditDrink}
            onDelete={handleDeleteDrink}
          />
        )}
      </div>

      {categoryManagerOpen && (
        <CategoryManagerModal
          restaurantId={restaurantId}
          categories={categories}
          menus={menus}
          onClose={() => setCategoryManagerOpen(false)}
          onChanged={refreshCategoriesAndMenus}
        />
      )}

      {/* ================= Menu Modal ================= */}
      <Modal
        open={openMenuModal}
        title={editingMenuId ? "แก้ไขเมนู" : "เพิ่มเมนู"}
        onClose={() => setOpenMenuModal(false)}
      >
        <form onSubmit={handleSaveMenu} className="space-y-4">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อเมนู</span>
            <TextInput
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              placeholder="เช่น สเต็กไก่กรอบเทอริยากิ"
            />
          </label>

          {/* ✅ P1b-2: หมวดหมู่เลือกได้หลายหมวด */}
          <div className="text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-admin-text">
                หมวดหมู่ (เลือกได้หลายหมวด)
              </span>
              {pickedActiveCategoryCount > 0 && (
                <button
                  type="button"
                  className="text-[11px] text-admin-textMuted underline"
                  onClick={() =>
                    setMenuCategoryIds((prev) =>
                      prev.filter((id) => !activeCategoryIdSet.has(id)),
                    )
                  }
                >
                  ล้างที่เลือก
                </button>
              )}
            </div>

            <div className="max-h-44 overflow-y-auto rounded-xl border border-admin-border bg-white p-2 space-y-1">
              {activeCategories.map((c) => {
                const id = String(c._id);
                return (
                  <label
                    key={id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-admin-surfaceMuted/70"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={menuCategoryIds.includes(id)}
                      onChange={() =>
                        setMenuCategoryIds((prev) => toggleId(prev, id))
                      }
                    />
                    <span>{c.name}</span>
                  </label>
                );
              })}

              {activeCategories.length === 0 && (
                <p className="text-[11px] text-admin-textMuted">
                  ยังไม่มีหมวดหมู่ที่เปิดใช้งานในร้านนี้
                </p>
              )}
            </div>

            <span className="mt-1 block text-[11px] text-admin-textMuted">
              {pickedActiveCategoryCount === 0
                ? "ไม่ได้เลือก = ไม่มีหมวดหมู่"
                : `เลือกแล้ว ${pickedActiveCategoryCount} หมวด — เมนูจะแสดงในทุกหมวดที่เลือก`}
            </span>
            {hiddenPickedCategoryCount > 0 && (
              <span className="mt-0.5 block text-[11px] text-admin-textMuted">
                เมนูนี้อยู่ในหมวดที่ปิดใช้งานอีก {hiddenPickedCategoryCount} หมวด
                (ไม่แสดงที่นี่ และยังคงไว้เมื่อบันทึก)
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-admin-text">ราคา (บาท)</span>
              <TextInput
                type="number"
                min="0"
                step="1"
                value={menuPrice}
                onChange={(e) => setMenuPrice(e.target.value)}
                placeholder="เว้นว่างได้ถ้าเป็นร้าน set menu"
              />
            </label>

            <label className="block text-sm">
              <span className="text-admin-text">ลำดับ</span>
              <TextInput
                type="number"
                step="1"
                value={menuSortOrder}
                onChange={(e) => setMenuSortOrder(e.target.value)}
                placeholder="0"
              />
              <span className="mt-1 block text-[11px] text-admin-textMuted">
                ใช้ลำดับเดียวกันในทุกหมวดที่เมนูนี้อยู่
              </span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-admin-text">คำอธิบาย (ไม่บังคับ)</span>
            <TextInput
              value={menuDescription}
              onChange={(e) => setMenuDescription(e.target.value)}
              maxLength={300}
              placeholder="รายละเอียดสั้น ๆ ที่ผู้เรียนจะเห็นตอนสั่ง"
            />
            <span className="mt-1 block text-[11px] text-admin-textMuted">
              {menuDescription.length}/300
            </span>
          </label>

          <OptionGroupsEditor
            value={menuOptionGroups}
            onChange={setMenuOptionGroups}
          />

          <label className="block text-sm">
            <span className="text-admin-text">รูปเมนู (URL รูป)</span>
            <TextInput
              value={menuImageUrl}
              onChange={(e) => {
                setMenuImageUrl(e.target.value);
                setMenuImageSmallW(0);
              }}
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

          {menuImageSmallW ? (
            <p
              data-testid="menu-image-small-warning"
              className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700"
            >
              ภาพมีขนาดเล็ก อาจไม่คมชัดบนมือถือ แนะนำความกว้างอย่างน้อย {MIN_MENU_IMAGE_W}px
              (ภาพนี้กว้าง {menuImageSmallW}px)
            </p>
          ) : null}

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

          {/* ✅ Add-on selection by id */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-admin-text">
                Add-on (เลือกได้หลายรายการ)
                <span className="ml-2 text-[11px] text-admin-textMuted">
                  เลือกแล้ว {menuAddonIds.length}
                </span>
              </div>
              <button
                type="button"
                className="text-[11px] text-admin-textMuted underline"
                onClick={() => setMenuAddonIds([])}
              >
                ล้างที่เลือก
              </button>
            </div>

            <TextInput
              value={qMenuAddon}
              onChange={(e) => setQMenuAddon(e.target.value)}
              placeholder="ค้นหา add-on ในร้านนี้..."
            />

            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-admin-border bg-white p-2 space-y-1">
              {filteredMenuAddons.map((a) => {
                const id = String(a._id);
                const checked = menuAddonIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-admin-surfaceMuted/70"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={checked}
                        onChange={() =>
                          setMenuAddonIds((prev) => toggleId(prev, id))
                        }
                      />
                      <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-admin-surfaceMuted">
                        {a.imageUrl ? (
                          <Image
                            src={a.imageUrl}
                            alt={a.name || "addon"}
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="text-sm">{a.name}</span>
                    </div>
                  </label>
                );
              })}

              {!loadingAddons && filteredMenuAddons.length === 0 && (
                <p className="text-[11px] text-admin-textMuted">
                  ไม่มี Add-on (หรือถูกปิดการใช้งานทั้งหมด)
                </p>
              )}
            </div>
          </div>

          {/* ✅ Drink selection by id */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-admin-text">
                Drink options (หน้าเช็คอินลูกค้าจะเลือกได้ 1 อย่าง)
                <span className="ml-2 text-[11px] text-admin-textMuted">
                  เลือกแล้ว {menuDrinkIds.length}
                </span>
              </div>
              <button
                type="button"
                className="text-[11px] text-admin-textMuted underline"
                onClick={() => setMenuDrinkIds([])}
              >
                ล้างที่เลือก
              </button>
            </div>

            <TextInput
              value={qMenuDrink}
              onChange={(e) => setQMenuDrink(e.target.value)}
              placeholder="ค้นหา drink ในร้านนี้..."
            />

            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-admin-border bg-white p-2 space-y-1">
              {filteredMenuDrinks.map((d) => {
                const id = String(d._id);
                const checked = menuDrinkIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-admin-surfaceMuted/70"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={checked}
                        onChange={() =>
                          setMenuDrinkIds((prev) => toggleId(prev, id))
                        }
                      />
                      <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-admin-surfaceMuted">
                        {d.imageUrl ? (
                          <Image
                            src={d.imageUrl}
                            alt={d.name || "drink"}
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="text-sm">{d.name}</span>
                    </div>
                  </label>
                );
              })}

              {!loadingDrinks && filteredMenuDrinks.length === 0 && (
                <p className="text-[11px] text-admin-textMuted">
                  ไม่มี Drink (หรือถูกปิดการใช้งานทั้งหมด)
                </p>
              )}
            </div>
          </div>

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
                            : [...prev, id],
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

      {/* ================= Addon Modal ================= */}
      <Modal
        open={openAddonModal}
        title={editingAddonId ? "แก้ไข Add-on" : "เพิ่ม Add-on"}
        onClose={() => setOpenAddonModal(false)}
      >
        <form onSubmit={handleSaveAddon} className="space-y-3">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อ Add-on</span>
            <TextInput
              value={addonName}
              onChange={(e) => setAddonName(e.target.value)}
              placeholder="เช่น ไข่ดาว"
            />
          </label>

          <label className="block text-sm">
            <span className="text-admin-text">รูป (URL)</span>
            <TextInput
              value={addonImageUrl}
              onChange={(e) => setAddonImageUrl(e.target.value)}
              placeholder="วางลิงก์รูป หรืออัปโหลด"
            />
          </label>

          <div className="flex items-center gap-3">
            <input
              id="addonImageFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadAddonImage}
            />
            <label
              htmlFor="addonImageFile"
              className="inline-flex cursor-pointer items-center rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
            >
              {uploadingAddonImage ? "กำลังอัพโหลด..." : "อัพโหลดรูปจากเครื่อง"}
            </label>
          </div>

          {addonImageUrl && (
            <div className="inline-flex items-center gap-3 rounded-xl bg-admin-surfaceMuted px-3 py-2">
              <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-white/40">
                <Image
                  src={addonImageUrl}
                  alt={addonName || "addon"}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs text-front-text">
                {addonName || "ชื่อ Add-on"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpenAddonModal(false)}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
            >
              ยกเลิก
            </button>
            <PrimaryButton type="submit" disabled={savingAddon}>
              {savingAddon
                ? "กำลังบันทึก..."
                : editingAddonId
                  ? "อัปเดต Add-on"
                  : "บันทึก Add-on"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* ================= Drink Modal ================= */}
      <Modal
        open={openDrinkModal}
        title={editingDrinkId ? "แก้ไข Drink" : "เพิ่ม Drink"}
        onClose={() => setOpenDrinkModal(false)}
      >
        <form onSubmit={handleSaveDrink} className="space-y-3">
          <label className="block text-sm">
            <span className="text-admin-text">ชื่อ Drink</span>
            <TextInput
              value={drinkName}
              onChange={(e) => setDrinkName(e.target.value)}
              placeholder="เช่น โค้ก"
            />
          </label>

          <label className="block text-sm">
            <span className="text-admin-text">รูป (URL)</span>
            <TextInput
              value={drinkImageUrl}
              onChange={(e) => setDrinkImageUrl(e.target.value)}
              placeholder="วางลิงก์รูป หรืออัปโหลด"
            />
          </label>

          <div className="flex items-center gap-3">
            <input
              id="drinkImageFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadDrinkImage}
            />
            <label
              htmlFor="drinkImageFile"
              className="inline-flex cursor-pointer items-center rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs font-medium text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
            >
              {uploadingDrinkImage ? "กำลังอัพโหลด..." : "อัพโหลดรูปจากเครื่อง"}
            </label>
          </div>

          {drinkImageUrl && (
            <div className="inline-flex items-center gap-3 rounded-xl bg-admin-surfaceMuted px-3 py-2">
              <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-white/40">
                <Image
                  src={drinkImageUrl}
                  alt={drinkName || "drink"}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs text-front-text">
                {drinkName || "ชื่อ Drink"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpenDrinkModal(false)}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
            >
              ยกเลิก
            </button>
            <PrimaryButton type="submit" disabled={savingDrink}>
              {savingDrink
                ? "กำลังบันทึก..."
                : editingDrinkId
                  ? "อัปเดต Drink"
                  : "บันทึก Drink"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
