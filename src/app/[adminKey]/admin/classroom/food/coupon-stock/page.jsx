"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Plus, Store } from "lucide-react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import StockKpis from "./_components/StockKpis";
import LotCards from "./_components/LotCards";
import CouponTable from "./_components/CouponTable";
import ImportDrawer from "./_components/ImportDrawer";
import LotEditDrawer from "./_components/LotEditDrawer";
import LotRemoveDialog from "./_components/LotRemoveDialog";
import LotRestoreDialog from "./_components/LotRestoreDialog";
import LotStaleDialog from "./_components/LotStaleDialog";
import { lotKey, safeJson } from "./_components/stockUi";
import { bangkokTodayYMD } from "@/lib/classDates";

function CouponStockPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [restaurants, setRestaurants] = useState(null);

  // selected shop lives in the URL (?shop=); fall back to the first stock shop
  const shopParam = searchParams.get("shop") || "";
  const restaurantId =
    restaurants?.find((r) => String(r._id) === shopParam)
      ? shopParam
      : restaurants?.[0]
        ? String(restaurants[0]._id)
        : "";

  const [summary, setSummary] = useState(null);

  // lot filter is per shop: switching shop clears it without an effect
  const [lotState, setLotState] = useState({ shop: "", key: "" });
  const activeLot = lotState.shop === restaurantId ? lotState.key : "";
  const setActiveLot = (key) => setLotState({ shop: restaurantId, key });

  // R5-3i: แท็บสถานะของตาราง — ต่อร้านเหมือนตัวกรองล็อต (เปลี่ยนร้าน = กลับไป "ทั้งหมด")
  const [statusState, setStatusState] = useState({ shop: "", status: "" });
  const tableStatus = statusState.shop === restaurantId ? statusState.status : "";
  const setTableStatus = (status) => setStatusState({ shop: restaurantId, status });

  // ชิป "รอคืน n" บนการ์ดล็อต -> ตารางกรองล็อตนั้น + แท็บรอคืน
  function showAwaitingReturn(lot) {
    setActiveLot(lotKey(lot.importBatch, lot.expiresYMD));
    setTableStatus("awaiting_return");
  }

  const [reloadKey, setReloadKey] = useState(0);

  /* ---------- restaurants (stock shops only) ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/food/restaurants", {
          cache: "no-store",
        });
        const data = await safeJson(res);
        // stock flag is kept when coupon is off, so a stock shop needs both
        setRestaurants(
          (data.items || []).filter((r) => r.couponEnabled && r.usesCouponStock),
        );
      } catch (err) {
        console.error(err);
        setRestaurants([]);
        toast.error("โหลดรายชื่อร้านไม่สำเร็จ");
      }
    })();
  }, []);

  function selectShop(id) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("shop", id);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!restaurantId) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/food/coupon-stock/summary?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        );
        const data = await safeJson(res);
        if (ignore) return;
        if (!res.ok) {
          console.error(data);
          toast.error(data.error || "โหลดสรุปคลังคูปองไม่สำเร็จ");
          return;
        }
        setSummary(data);
      } catch (err) {
        console.error(err);
        if (!ignore) toast.error("โหลดสรุปคลังคูปองไม่สำเร็จ");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId, reloadKey]);

  // summary of the shop on screen (ignore a previous shop's data while loading)
  const shopSummary =
    summary && summary.restaurant?._id === restaurantId ? summary : null;

  const refreshAll = useCallback(() => setReloadKey((k) => k + 1), []);

  /* ---------- import drawer ---------- */
  const [importOpen, setImportOpen] = useState(false);
  const [highlight, setHighlight] = useState({ shop: "", key: "" });
  const highlightTimer = useRef(null);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  function handleImported({ restaurantId: shopId, lotKey }) {
    setImportOpen(false);
    if (shopId !== restaurantId) selectShop(shopId);
    refreshAll();
    setHighlight({ shop: shopId, key: lotKey });
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(
      () => setHighlight({ shop: "", key: "" }),
      4000,
    );
  }

  /* ---------- R5-3: lot actions (card menu) ---------- */
  // { kind: "edit" | "remove" | "restore", lot } — lot = การ์ดจาก summary (มี lotId)
  const [lotAction, setLotAction] = useState(null);
  const closeLotAction = () => setLotAction(null);

  function handleLotSaved({ oldKey, newKey }) {
    setLotAction(null);
    // ตัวกรองตารางผูกกับ key ของการ์ด (ชื่อ|วันหมดอายุ) — ตามไปที่ key ใหม่
    if (activeLot && activeLot === oldKey) setActiveLot(newKey);
    refreshAll();
  }

  function handleLotRemoved({ decision }) {
    const key = lotAction?.lot ? lotKey(lotAction.lot.importBatch, lotAction.lot.expiresYMD) : "";
    setLotAction(null);
    if (decision === "delete" && activeLot && activeLot === key) setActiveLot("");
    refreshAll();
  }

  // R5-3d: รับคืนคูปองค้างจอง (ทั้งล็อตจากการ์ด หรือใบเดียวจากตาราง)
  function handleStaleReleased() {
    setLotAction(null);
    refreshAll();
  }

  function handleLotRestored() {
    setLotAction(null);
    refreshAll();
  }

  return (
    <div className="h-full space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">คลังคูปอง Stock</h1>
          <p className="text-sm text-admin-textMuted">
            จัดการคูปองอาหารตามร้าน เลขล็อต และวันหมดอายุ
          </p>
        </div>

        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
          <label className="block min-w-0 flex-1 text-xs sm:w-64 sm:flex-none">
            <span className="text-admin-textMuted">ร้านที่ใช้คูปอง</span>
            <div className="relative mt-1">
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
              <select
                value={restaurantId}
                onChange={(e) => selectShop(e.target.value)}
                disabled={!restaurants?.length}
                className="w-full rounded-xl border border-admin-border bg-white py-2 pl-9 pr-3 text-sm text-admin-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              >
                {(restaurants || []).map((r) => (
                  <option key={String(r._id)} value={String(r._id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <PrimaryButton
            onClick={() => setImportOpen(true)}
            disabled={!restaurantId}
          >
            <Plus className="h-4 w-4" />
            นำเข้าคูปอง
          </PrimaryButton>
        </div>
      </div>

      {importOpen && (
        <ImportDrawer
          restaurants={restaurants || []}
          initialRestaurantId={restaurantId}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        />
      )}

      {lotAction?.kind === "edit" && (
        <LotEditDrawer
          lot={lotAction.lot}
          today={shopSummary?.today || bangkokTodayYMD()}
          onClose={closeLotAction}
          onSaved={handleLotSaved}
        />
      )}
      {lotAction?.kind === "remove" && (
        <LotRemoveDialog lot={lotAction.lot} onClose={closeLotAction} onDone={handleLotRemoved} />
      )}
      {lotAction?.kind === "stale" && (
        <LotStaleDialog
          restaurantId={restaurantId}
          lot={lotAction.lot}
          codeId={lotAction.codeId || ""}
          onClose={closeLotAction}
          onDone={handleStaleReleased}
        />
      )}
      {lotAction?.kind === "restore" && (
        <LotRestoreDialog
          lot={lotAction.lot}
          today={shopSummary?.today || bangkokTodayYMD()}
          onClose={closeLotAction}
          onDone={handleLotRestored}
        />
      )}

      {restaurants && restaurants.length === 0 && (
        <div className="rounded-2xl bg-admin-surface p-6 text-sm text-admin-textMuted shadow-sm">
          ยังไม่มีร้านที่เปิด &quot;ร้านนี้ใช้คูปอง stock&quot; — ไปเปิดได้ที่หน้า
          Food Menu → เลือกร้าน → การใช้งานคูปอง
        </div>
      )}

      {restaurantId && (
        <>
          {shopSummary?.isLow && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <div className="font-semibold">คูปองใกล้หมด</div>
                <div className="mt-0.5">
                  เหลือพร้อมใช้ {shopSummary.availableNotExpired} ใบ (เกณฑ์เตือนคือ{" "}
                  {shopSummary.restaurant.couponStockLowThreshold} ใบ) — ควรรับล็อตใหม่จากร้าน
                </div>
              </div>
            </div>
          )}

          <StockKpis summary={shopSummary} />

          <LotCards
            batches={shopSummary?.batches}
            today={shopSummary?.today}
            activeLot={activeLot}
            highlightLot={highlight.shop === restaurantId ? highlight.key : ""}
            onSelect={setActiveLot}
            onShowAwaiting={showAwaitingReturn}
            onAction={(kind, lot) => setLotAction({ kind, lot })}
            onImport={() => setImportOpen(true)}
          />

          <CouponTable
            key={restaurantId}
            restaurantId={restaurantId}
            summary={shopSummary}
            activeLot={activeLot}
            onLotChange={setActiveLot}
            status={tableStatus}
            onStatusChange={setTableStatus}
            reloadKey={reloadKey}
            onChanged={refreshAll}
            onReleaseStale={(row) =>
              setLotAction({
                kind: "stale",
                lot: { lotId: String(row.lotId), importBatch: row.importBatch, lotStatus: row.lotStatus },
                codeId: String(row._id),
              })
            }
          />
        </>
      )}
    </div>
  );
}

export default function CouponStockPage() {
  return (
    <Suspense fallback={null}>
      <CouponStockPageInner />
    </Suspense>
  );
}
