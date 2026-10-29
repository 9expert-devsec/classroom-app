// src/app/admin/classroom/food/restaurants/[restaurantId]/page.jsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";

import CouponSettingsButton from "./_components/CouponSettingsButton";
import { MerchantShopButton } from "../_components/MerchantLinks";
import RestaurantTabs from "./_components/RestaurantTabs";
import MenuTab from "./_components/MenuTab";
import SetsTab from "./_components/sets/SetsTab";
import SetFormModal from "./_components/sets/SetFormModal";
import SetDetailModal from "./_components/sets/SetDetailModal";
import SetDeleteDialog from "./_components/sets/SetDeleteDialog";
import { menusInSet } from "./_components/sets/setUi";
import LibraryTab from "./_components/LibraryTab";
import CategoryManagerModal from "./_components/CategoryManagerModal";
import { useListParams } from "./_components/menuUi";
import MenuWizard from "./_components/menu-wizard/MenuWizard";
import OptionSetsTab from "./_components/option-sets/OptionSetsTab";
import OptionSetFormModal from "./_components/option-sets/OptionSetFormModal";
import OptionSetAttachModal from "./_components/option-sets/OptionSetAttachModal";
import OptionSetDeleteDialog from "./_components/option-sets/OptionSetDeleteDialog";

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

// GET a list endpoint; throws (instead of returning a non-array) on any
// error status or unexpected body, so callers never store a wrong shape
async function loadList(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!Array.isArray(data.items)) throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");
  return data.items;
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
  const [uploadingAddonImage, setUploadingAddonImage] = useState(false);
  const [uploadingDrinkImage, setUploadingDrinkImage] = useState(false);

  // modals
  const [openAddonModal, setOpenAddonModal] = useState(false);
  const [openDrinkModal, setOpenDrinkModal] = useState(false);

  // menu wizard: null = closed, { menu: null } = create, { menu } = edit
  const [wizard, setWizard] = useState(null);
  const [highlightMenuId, setHighlightMenuId] = useState("");

  // set form
  // sets: form { set } (null set = create), detail view, delete confirm
  const [setForm, setSetForm] = useState(null);
  const [viewSetId, setViewSetId] = useState("");
  const [deletingSet, setDeletingSet] = useState(null);
  const [highlightSetId, setHighlightSetId] = useState("");

  // OS-2 option sets: form { setId } ("" = create), attach / delete by id
  const [optionSets, setOptionSets] = useState([]);
  const [loadingOptionSets, setLoadingOptionSets] = useState(false);
  const [osForm, setOsForm] = useState(null);
  const [osAttachId, setOsAttachId] = useState("");
  const [osDeleteId, setOsDeleteId] = useState("");
  const [highlightOptionSetId, setHighlightOptionSetId] = useState("");

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
      const items = await loadList(
        `/api/admin/food/menu?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      setMenus(items);
    } catch (err) {
      // keep the current list; never write an error body into state
      console.error(err);
      toast.error(err?.message || "โหลดรายการเมนูไม่สำเร็จ");
    } finally {
      setLoadingMenus(false);
    }
  }

  async function fetchSets() {
    setLoadingSets(true);
    try {
      const items = await loadList(
        `/api/admin/food/sets?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      setSets(items);
    } catch (err) {
      // keep the current list; never write an error body into state
      console.error(err);
      toast.error(err?.message || "โหลดชุดเมนูไม่สำเร็จ");
    } finally {
      setLoadingSets(false);
    }
  }

  // per-set usage (linked menus + price overrides) comes from the server
  async function fetchOptionSets() {
    setLoadingOptionSets(true);
    try {
      const items = await loadList(
        `/api/admin/food/option-sets?restaurant=${encodeURIComponent(restaurantId)}&withUsage=1`,
      );
      setOptionSets(items);
    } catch (err) {
      // keep the current list; never write an error body into state
      console.error(err);
      toast.error(err?.message || "โหลดชุดตัวเลือกไม่สำเร็จ");
    } finally {
      setLoadingOptionSets(false);
    }
  }

  async function fetchAddons() {
    setLoadingAddons(true);
    try {
      const items = await loadList(
        `/api/admin/food/addons?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      setAddonsList(items);
    } catch (err) {
      // keep the current list; never write an error body into state
      console.error(err);
      toast.error(err?.message || "โหลด Add-on ไม่สำเร็จ");
    } finally {
      setLoadingAddons(false);
    }
  }

  async function fetchDrinks() {
    setLoadingDrinks(true);
    try {
      const items = await loadList(
        `/api/admin/food/drinks?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      setDrinksList(items);
    } catch (err) {
      // keep the current list; never write an error body into state
      console.error(err);
      toast.error(err?.message || "โหลด Drink ไม่สำเร็จ");
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
    fetchOptionSets();
    fetchAddons();
    fetchDrinks();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  /* ---------------- derived ---------------- */

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

  /* ---------------- menu actions ---------------- */
  function openNewMenu() {
    setWizard({ menu: null });
  }

  function openEditMenu(m) {
    setWizard({ menu: m });
  }

  async function handleWizardSaved(menuId) {
    setWizard(null);
    await fetchMenus();
    setHighlightMenuId(menuId);
    setTimeout(() => setHighlightMenuId(""), 2500);
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
    setSetForm({ set: null });
  }

  async function handleSetSaved(setId) {
    setSetForm(null);
    await fetchSets();
    setHighlightSetId(setId);
    setTimeout(() => setHighlightSetId(""), 2500);
  }

  async function handleSetDeleted() {
    setDeletingSet(null);
    setViewSetId("");
    await fetchSets();
  }

  /* ---------------- option set actions (OS-2) ---------------- */
  // a save / attach / delete can change menus (embedded groups), so both lists reload
  async function refreshOptionSetsAndMenus() {
    await Promise.all([fetchOptionSets(), fetchMenus()]);
  }

  async function handleOptionSetSaved(setId) {
    setOsForm(null);
    await refreshOptionSetsAndMenus();
    setHighlightOptionSetId(setId);
    setTimeout(() => setHighlightOptionSetId(""), 2500);
  }

  async function handleOptionSetDeleted() {
    setOsForm(null);
    setOsDeleteId("");
    await refreshOptionSetsAndMenus();
  }

  async function handleOptionSetAttached() {
    setOsAttachId("");
    await refreshOptionSetsAndMenus();
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
  // defensive: a bad value must never blank the page
  const menuById = new Map((Array.isArray(menus) ? menus : []).map((m) => [String(m._id), m]));
  const viewSet = viewSetId ? sets.find((s) => String(s._id) === viewSetId) : null;
  const tabCounts = {
    menus: menus.length,
    sets: sets.length,
    addons: addonsList.length,
    drinks: drinksList.length,
    optionsets: optionSets.length,
  };
  // live rows (with usage) so open modals see refreshed linked menus
  const optionSetById = (id) => optionSets.find((s) => String(s._id) === id) || null;
  const osFormSet = osForm?.setId ? optionSetById(osForm.setId) : null;
  const osAttachSet = osAttachId ? optionSetById(osAttachId) : null;
  const osDeleteSet = osDeleteId ? optionSetById(osDeleteId) : null;

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

        <div className="flex flex-wrap items-center gap-2">
          <MerchantShopButton
            restaurantId={restaurantId}
            restaurantName={restaurant?.name || ""}
            refreshKey={[
              restaurant?.isActive,
              restaurant?.couponEnabled,
              restaurant?.usesCouponStock,
              restaurant?.stockFallbackToECoupon,
            ].join("|")}
          />
          {/* coupon settings live in a drawer; the pill shows the current coupon status */}
          <CouponSettingsButton
            restaurant={restaurant}
            adminKey={adminKey}
            menus={menus}
            onSaved={(item) => setRestaurant(item)}
          />
          {listParams.tab === "sets" ? (
            <PrimaryButton onClick={openNewSet}>
              <Plus className="h-4 w-4" />
              เพิ่มชุดอาหาร
            </PrimaryButton>
          ) : listParams.tab === "optionsets" ? (
            <PrimaryButton onClick={() => setOsForm({ setId: "" })}>
              <Plus className="h-4 w-4" />
              สร้างชุดตัวเลือก
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={openNewMenu}>
              <Plus className="h-4 w-4" />
              เพิ่มเมนู
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-4 rounded-2xl bg-admin-surface p-4 shadow-sm">
        <RestaurantTabs
          tab={listParams.tab}
          counts={tabCounts}
          onChange={(tab) =>
            setListParams({ tab: tab === "menus" ? "" : tab, q: "", cat: "", status: "", sort: "" })
          }
        />

        {listParams.tab === "menus" && (
          <MenuTab
            menus={menus}
            categories={categories}
            loading={loadingMenus}
            params={listParams}
            setParams={setListParams}
            onAdd={openNewMenu}
            onEdit={openEditMenu}
            onDelete={(m) => handleDeleteMenu(m._id)}
            onToggleActive={handleToggleMenuActive}
            highlightId={highlightMenuId}
            onManageCategories={() => setCategoryManagerOpen(true)}
          />
        )}
        {listParams.tab === "sets" && (
          <SetsTab
            sets={sets}
            menus={menus}
            loading={loadingSets}
            params={listParams}
            setParams={setListParams}
            highlightId={highlightSetId}
            onNew={openNewSet}
            onView={(s) => setViewSetId(String(s._id))}
            onEdit={(s) => setSetForm({ set: s })}
            onDelete={(s) => setDeletingSet(s)}
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
        {listParams.tab === "optionsets" && (
          <OptionSetsTab
            optionSets={optionSets}
            loading={loadingOptionSets}
            params={listParams}
            setParams={setListParams}
            highlightId={highlightOptionSetId}
            onNew={() => setOsForm({ setId: "" })}
            onEdit={(s) => setOsForm({ setId: String(s._id) })}
            onAttach={(s) => setOsAttachId(String(s._id))}
            onDelete={(s) => setOsDeleteId(String(s._id))}
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

      {wizard && (
        <MenuWizard
          restaurantId={restaurantId}
          menu={wizard.menu}
          nextSortOrder={
            menus.reduce((max, m) => Math.max(max, Number(m.sortOrder) || 0), 0) + 1
          }
          couponEnabled={!!restaurant?.couponEnabled}
          categories={categories}
          addons={activeAddons}
          drinks={activeDrinks}
          uploadImage={uploadImage}
          onClose={() => setWizard(null)}
          onSaved={handleWizardSaved}
        />
      )}

      {setForm && (
        <SetFormModal
          restaurantId={restaurantId}
          set={setForm.set}
          sets={sets}
          menus={menus}
          categories={categories}
          onClose={() => setSetForm(null)}
          onSaved={handleSetSaved}
        />
      )}
      {viewSet && !setForm && !deletingSet && (
        <SetDetailModal
          set={viewSet}
          items={menusInSet(viewSet, menuById)}
          onClose={() => setViewSetId("")}
          onEdit={() => {
            setViewSetId("");
            setSetForm({ set: viewSet });
          }}
          onDelete={() => setDeletingSet(viewSet)}
        />
      )}
      {deletingSet && (
        <SetDeleteDialog
          set={deletingSet}
          menuCount={menusInSet(deletingSet, menuById).length}
          onClose={() => setDeletingSet(null)}
          onDeleted={handleSetDeleted}
        />
      )}

      {/* OS-2: an edit form whose set disappeared (deleted elsewhere) closes itself */}
      {osForm && (!osForm.setId || osFormSet) && (
        <OptionSetFormModal
          restaurantId={restaurantId}
          set={osFormSet}
          menus={menus}
          categories={categories}
          onClose={() => setOsForm(null)}
          onSaved={handleOptionSetSaved}
          onChanged={refreshOptionSetsAndMenus}
          onDeleted={handleOptionSetDeleted}
        />
      )}
      {osAttachSet && (
        <OptionSetAttachModal
          set={osAttachSet}
          menus={menus}
          categories={categories}
          onClose={() => setOsAttachId("")}
          onAttached={handleOptionSetAttached}
        />
      )}
      {osDeleteSet && (
        <OptionSetDeleteDialog
          set={osDeleteSet}
          onClose={() => setOsDeleteId("")}
          onDeleted={handleOptionSetDeleted}
        />
      )}

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
