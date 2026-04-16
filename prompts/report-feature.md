# Goal

Build a coupon usage Report feature for the merchant history page (`/m/history`) that produces a professional multi-page PDF (and a summary PNG) with per-coupon actual-deducted amounts. This requires persisting the allocation data to the database during redemption so reports and audits never have to recompute it.

Business context: a single bill may use multiple coupons (each with face value 180 ฿). The last coupon applied may deduct LESS than its face value if the remaining bill amount is smaller. Example: bill 340 ฿ + 2 × 180 ฿ coupons → first coupon deducts 180, second deducts 160. The report must show this clearly, per coupon, for accounting reconciliation.

Since the coupon system is not yet in production, schema changes are safe. No migration or backfill is needed beyond the forward path.

## Context — files to read before editing

- `src/models/CouponRecord.js` — Coupon schema.
- `src/app/api/merchant/coupons/redeem/route.js` — single-coupon redeem (still in use). `findOneAndUpdate` based.
- `src/app/api/merchant/coupons/redeem-batch/route.js` — multi-coupon bill redeem. Uses `mongoose.startSession` + `bulkWrite`. This is where allocation implicitly happens today (via the `spentAmount: isFirst ? billTotal : 0` trick) but per-coupon allocation is NOT persisted yet.
- `src/app/m/redeem/_components/RedeemBillDetailView.jsx` — contains the reference implementation of the allocation algorithm: `sortRowsForDisplay` (lines ~36-50) and `buildAppliedRows` (lines ~52-68). Extract these verbatim into a shared helper — the algorithm is correct and proven.
- `src/app/api/merchant/history/route.js` — returns history (summary + items grouped by redeemedAt). We do not need to change its behavior, but `items[].appliedAmount` will flow through automatically once stored (additive).
- `src/app/m/history/HistoryPageClient.jsx` — merchant history page with `groupedDays` state (days → bills → items[]).
- `src/app/api/merchant/me/route.js` — merchant identity (used by `/m/dashboard` at lines ~61-88 — copy that fetch pattern).
- `src/lib/couponCode.js` — has `formatCouponCodeForDisplay`, `normalizeCouponCode`. Reuse.
- `public/fonts/LINESeedSansTH_W_Rg.woff2` — Thai font already loaded by the merchant layout (browser renders Thai fine).
- `package.json` has `html-to-image`, `@radix-ui/react-dialog`. Does NOT have `jspdf` — add it.

## Locked design decisions

### Schema (forward-only change, safe because not in production)

Add one field to `CouponRecord`:

    appliedAmount: { type: Number, default: null, min: 0 }

- `null` = unknown / legacy (distinguishes from a real `0`).
- Not required. Not indexed.
- Do NOT remove, rename, or re-type any existing field.
- Keep the existing dev hot-reload pattern (`mongoose.models.CouponRecord || mongoose.model(...)`).

### Allocation algorithm (extract to shared helper)

Business rule (verbatim from `RedeemBillDetailView.jsx`):
- Sort coupons in a bill by `redeemedAt` ascending; tiebreak by `displayCode` alphabetic.
- Walk sorted list. For each coupon: `appliedAmount = min(faceValue, remainingBillTotal)`; `remainingBillTotal -= appliedAmount`.
- `faceValue = couponPrice ?? 180`.
- Coupons after the bill is fully covered get `appliedAmount = 0` (rare, but guard).

Create `src/lib/couponAllocation.js` (client/server safe; no Node-only imports). Export:

- `DEFAULT_COUPON_FACE_VALUE = 180`
- `sortCouponsForAllocation(items)` — pure, returns new sorted array, does NOT mutate input. Sort: redeemedAt asc, then displayCode alpha asc.
- `allocateBillAmounts(sortedItems, billTotal)` — input must already be sorted. Returns each item annotated with `_order` (1-based), `_faceValue`, `_appliedAmount`, `_remainingAfter`. Does not mutate input.
- `sortAndAllocate(items, billTotal)` — convenience: sort + allocate in one call.

Include JSDoc on each function. Note that `couponPrice` is a raw DB value that may live on `item.couponPrice` OR `item.item.couponPrice` (the redeem view's `rows` are shaped differently). Support both read paths via a small internal helper, or require the caller to normalise first. Decide and document in a comment.

### Redeem logic — persist appliedAmount

**A. `redeem-batch/route.js`**

After loading `rows` and computing `couponTotal` + `payMore`, compute per-row `appliedAmount` BEFORE the bulkWrite. The ordering must match the order of `ciphers` in the request payload (since `redeemedAt` is identical for all rows in a batch — they all get `now`). Use the payload order as the primary sort, then `displayCode` as tiebreaker to match the UI's later sort behavior.

Concretely:
1. Build an index: `ciphersHashOrder: tokenHashes.indexOf(row.redeemTokenHash)`.
2. Sort `rows` by that index asc; tiebreak by `displayCode` asc.
3. Run the allocation algorithm to get `appliedAmount` per row.
4. Assert invariant: `sum(appliedAmount) === Math.min(billTotal, couponTotal)`. If not, throw an Error inside the transaction — the transaction will roll back.
5. In the `bulkWrite` updateOne blocks, add `appliedAmount: <the computed value for that row>` to the `$set`.
6. Keep existing `spentAmount`, `diffAmount`, `billTotal`, `billCouponTotal`, `billPayMore`, `billCouponCount` as they are — they are still used by the history summary aggregation elsewhere.

**B. `redeem/route.js`** (single-coupon)

- Compute `appliedAmount = Math.min(couponPrice ?? 180, spentAmount)`.
- To do this correctly, you need the coupon's `couponPrice` BEFORE the update. Use the two-step atomic approach: findOneAndUpdate with the current logic, then a second updateOne setting `appliedAmount` based on the returned document's `couponPrice`. The coupon is already locked (status: redeemed) after step 1, so the second update is safe. Document this choice in a comment.

### Report — UI entry point

Keep EVERYTHING on `/m/history` unchanged EXCEPT:
1. Add `me` state and fetch `/api/merchant/me` on mount (mirror the dashboard pattern exactly, including 401 → `/m/login` redirect).
2. Add `reportOpen` state.
3. Add a full-width "ดูรายงาน" button IMMEDIATELY AFTER the "ช่วงที่เลือก" div (current lines ~440-449):

```jsx
<button
  type="button"
  onClick={() => setReportOpen(true)}
  disabled={loading || !!error || groupedDays.length === 0 || !me}
  className="mt-4 h-12 w-full rounded-2xl bg-[#2B6CFF] font-semibold text-white hover:bg-[#255DE0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
>
  <FileText className="h-4 w-4" />
  ดูรายงาน
</button>
```

4. Render `<ReportDialog ... />` at the end of the component tree.
5. Preserve every other part of the page exactly as it is — presets, date grid, summary card, history list.

### Report — Dialog & exports

- Radix Dialog from `@radix-ui/react-dialog` (already installed). Proper ESC / backdrop / X close with focus management.
- Two export buttons: "บันทึกเป็นรูป (PNG)" and "บันทึกเป็น PDF".
- Busy state text "กำลังสร้างไฟล์…" disables both buttons during generation. Red error box on failure.
- Report ID = random 6-char code from `23456789A-HJ-NP-Z`, generated once per dialog session and stable across both PNG and PDF exports of that session.
- Filenames via `src/lib/reportFilename.js`:
  - `9expert-report-<slug>-<startYMD>-to-<endYMD>.png`
  - `9expert-report-<slug>-<startYMD>-to-<endYMD>.pdf`
  - Slug: restaurant name, lowercased, whitespace → `-`, Thai kept, other non-alphanumerics stripped (except `-`). Fallback "merchant" if empty.
- Rendering strategy: use `html-to-image.toPng(ref, { pixelRatio: 2, backgroundColor: "#ffffff" })`. For PDF, after capturing PNGs, use `jsPDF` A4 portrait with ~10mm margins and `addImage` to embed. Paginate for long content. Document your paging approach (canvas-slice-via-negative-y OR section-by-section render — either is acceptable; pick whichever produces cleaner page breaks).
- Do NOT use jsPDF text APIs for Thai content. All Thai goes through html-to-image first.

### Report — Content

**PNG content (summary only — also rendered as PDF page 1):**

1. Header row
   - Restaurant logo (48×48 rounded, if `me.restaurant.logoUrl`).
   - Restaurant name (large, bold).
   - Subtitle "รายงานการใช้คูปอง 9Expert".
   - Right side: date range "ช่วง: 9 - 16 เม.ย. 2569 (8 วัน)" and "ออก ณ: 16 เม.ย. 2569 14:32 น." (now, BKK).
2. Three summary cards (same style as existing history page cards):
   - "คูปองที่ใช้" — count of coupons
   - "หักจริงรวม" — SUM of appliedAmount across all days (fallback to computed via sortAndAllocate when legacy). Renamed from "ยอดคูปอง" to "หักจริง" to match what it actually represents.
   - "ยอดรวม" — sum of distinct billTotal (existing logic).
3. Derived metrics (single muted line):
   - "ลูกค้าจ่ายเพิ่ม: +X ฿" (totalAmount − หักจริงรวม; clamp ≥ 0).
   - "เฉลี่ย: X.X ใบ/วัน" (couponCount / dayCount, 1 decimal).
4. Daily summary table
   - Columns: วันที่ | จำนวน | หักจริง | ยอดรวม | ส่วนต่าง
   - All days in the report period (no truncation).
   - Each row: date + day name, count of coupons that day, sum of appliedAmount that day, sum of distinct billTotal that day, diff = ยอดรวม − หักจริง (show "+N" or "0", never "-N").
   - Last row: bold "รวม" with grand totals.
5. Footer (small, muted)
   - "* สำหรับรายละเอียดคูปอง ดูในไฟล์ PDF"
   - "Report ID: RPT-XXXXXX · สร้างโดย: <username>"
   - "9Expert Training"

**PDF content (additional pages — "รายละเอียดคูปอง"):**

Rendered from a separate off-screen ref (`pdfDetailRef`). For each day, newest first:

- Day header (gray-bg band):
  `16 เมษายน 2569 (อังคาร)        5 คูปอง · หักจริง 860 ฿ · ยอดรวม 890 ฿`

- For each bill in that day, newest first:
  - Bill header line (plain, above the table, spanning its width):
    `บิล B001 · 14:32 น.        Face 360 ฿ · หักจริง 340 ฿ · ยอดบิล 340 ฿ · ส่วนต่าง 0 ฿`
    If there is no `billCode`, show "ไม่มีรหัสบิล" instead of B001.

  - Then a **table** with these columns:
    | # | รหัสคูปอง | เวลา | Face | หักจริง |
    - `#` — 1-based order within the bill.
    - `รหัสคูปอง` — monospace, via `formatCouponCodeForDisplay`.
    - `เวลา` — HH:MM:SS in Asia/Bangkok (show seconds so scan order is visible).
    - `Face` — `couponPrice` (or 180).
    - `หักจริง` — `appliedAmount` (from DB if present; otherwise computed via `sortAndAllocate` client-side).
    - If `หักจริง < Face`, render that cell with warning color (use Tailwind's `text-amber-600` or equivalent from the page's palette — match whatever existing warning color the code uses). Other cells stay normal.

  - Bill subtotal row (shaded):
    | colspan 3: "รวม N คูปอง" | Face sum | หักจริง sum |

- Small gap (~8-12px) between bills; larger gap (~18-24px) between days.

### Privacy

- DO NOT show `holderName`, `courseName`, or `roomName` anywhere in the report (PNG or PDF).
- DO NOT include `redeemCipher` anywhere.
- DO NOT include internal IDs (`_id`).

### Styling (for html-to-image capture)

- White bg, dark text.
- Use Tailwind classes consistent with the existing merchant UI (`text-slate-*`, `border-slate-*`, `rounded-2xl`, blue `#2B6CFF`).
- No emojis. Separators allowed: `·`, `•`, `—`, `→`.
- No `box-shadow` on captured containers — borders only.
- Font: inherit from the merchant layout (LINE Seed Sans TH).
- Tables: visible borders, light header row bg, alternating row bg optional. Subtotal row shaded (e.g. `bg-slate-50`).

## Required changes — summary

1. **Deps**: install `jspdf` (latest).
2. **Edit** `src/models/CouponRecord.js` — add `appliedAmount` field.
3. **Create** `src/lib/couponAllocation.js` with `sortCouponsForAllocation`, `allocateBillAmounts`, `sortAndAllocate`.
4. **Refactor** `src/app/m/redeem/_components/RedeemBillDetailView.jsx` to import from the new helper (remove local duplicates). Behavior must be bit-for-bit identical.
5. **Edit** `src/app/api/merchant/coupons/redeem-batch/route.js` to compute and persist per-row `appliedAmount` with invariant assertion.
6. **Edit** `src/app/api/merchant/coupons/redeem/route.js` to persist `appliedAmount` via the two-step atomic approach.
7. **Create** `src/lib/reportFilename.js` with `buildReportFilename`.
8. **Create** `src/app/m/history/ReportDialog.jsx` with the full dialog + export logic.
9. **Edit** `src/app/m/history/HistoryPageClient.jsx` — add `me` fetch, add `reportOpen` state, add the button, render the dialog.

## Constraints

- DO NOT modify `src/lib/couponCipher.server.js`.
- DO NOT modify `src/app/api/merchant/coupons/verify/route.js` or `src/app/api/merchant/coupons/by-ref/route.js`.
- DO NOT change the history API response shape (additive is fine).
- DO NOT remove or rename any existing CouponRecord field.
- DO NOT change `spentAmount` / `diffAmount` semantics.
- DO NOT include `holderName`, `courseName`, `roomName`, `redeemCipher`, or internal `_id` in any rendered report content.
- DO NOT use emojis anywhere in the report.
- DO NOT use jsPDF text APIs for Thai content.
- DO NOT add PDF libraries beyond `jspdf`.
- DO NOT add a backfill script for legacy records in this change.
- DO NOT change anything else on `/m/history` outside the three edits specified.
- Preserve all existing Thai copy.
- Preserve the modal accessibility guarantees.

## Acceptance criteria

### Schema + redeem logic
1. `CouponRecord` has a new optional `appliedAmount: Number` field with `default: null`.
2. Single-coupon redeem sets `appliedAmount = min(couponPrice ?? 180, spentAmount)` via a two-step atomic update.
3. Batch redeem persists per-coupon `appliedAmount` such that across the bill: `sum(appliedAmount) === min(billTotal, couponTotal)` and each is `≤ that coupon's couponPrice`.
4. **Test vector A** — Seed a batch redeem with billTotal=340 and 2 ciphers whose coupons have couponPrice=180 each, in payload order [cA, cB]. After redeem, querying those two CouponRecord documents: the first receives `appliedAmount=180`, the second receives `appliedAmount=160`. Paste proof into deliverables.
5. **Test vector B** — billTotal=500, 2 × 180 coupons → both records get `appliedAmount=180`; `billPayMore=140` remains as computed.
6. Batch redeem throws and transaction rolls back if the invariant `sum(appliedAmount) === min(billTotal, couponTotal)` fails.

### Refactor
7. `RedeemBillDetailView` now imports from `couponAllocation.js` and no longer defines its own sort/allocate helpers. Behavior is identical: open a multi-coupon bill in the redeem view before/after — numbers match. Describe what you compared.

### UI & report
8. `/m/history` shows exactly one new element: a full-width blue "ดูรายงาน" button immediately after "ช่วงที่เลือก". Disabled when loading, error, empty, or `me` not yet loaded.
9. Dialog opens/closes via ESC, backdrop, and X. Focus is moved to the close button on open, and returns to the trigger on close.
10. PNG export downloads a summary image matching the on-screen preview. Thai renders correctly. Filename follows the spec.
11. PDF export downloads a multi-page A4-portrait file:
    - Page 1 = summary (same content as PNG).
    - Pages 2+ = "รายละเอียดคูปอง" section with day headers, bill headers, per-bill tables (columns: # · รหัสคูปอง · เวลา · Face · หักจริง), and bill subtotals. Days newest first; bills within a day newest first; coupons within a bill by redeemedAt asc.
    - Thai renders correctly on every page.
    - Page breaks do not cut through a table mid-cell.
12. Per-coupon rows where `appliedAmount < faceValue` are rendered in warning color (amber) in the "หักจริง" column only. Full-face coupons stay in normal text color.
13. Legacy coupon records (no `appliedAmount` in DB) still render correctly in the report via the `sortAndAllocate` fallback — no visible "legacy" badge, just the computed value.
14. No `holderName`, `courseName`, `roomName`, `redeemCipher`, or `_id` appears anywhere in the rendered PNG or PDF content.
15. The daily "หักจริง" total equals the sum of per-coupon `appliedAmount` values shown in that day's bills.
16. The top-of-report "หักจริงรวม" card equals the sum of all daily "หักจริง" values. During development, a `console.warn` fires if this differs from `summary.couponAmount` (from the API) by more than 1 ฿.
17. 100-bill stress test: report modal opens, PNG + PDF both export, no browser freeze >5s. Describe what dataset you tested with.

### Quality
18. `npm run build` passes, no new lint/type errors.
19. Only the files listed in "Required changes" are modified. No scope creep.

## Deliverables

- One-line summary per created/modified file with reason.
- Full diff of every changed file.
- Multi-page PDF paging approach used + 1-sentence reason.
- Before/after comparison proving `RedeemBillDetailView` is unchanged (numbers, layout — describe precisely, screenshots if possible).
- Output proof of test vectors A and B (the two specific redeem scenarios, with the resulting `appliedAmount` values from DB).
- Description of how page breaks were kept clean in the PDF.
- Any TODOs intentionally deferred with a one-line reason each.