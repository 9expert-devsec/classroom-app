"use client";

import { useRef, useState } from "react";
import { FileUp, Info, PlusCircle, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  MAX_IMPORT_CODES,
  MAX_IMPORT_NOTE,
  normalizeStockCode,
  STOCK_CODE_REGEX,
} from "@/lib/couponStockCode";
import { lotKey, parseLotKey } from "./stockUi";

const inputCls =
  "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-admin-text outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

function Label({ children, required }) {
  return (
    <span className="text-sm font-medium text-admin-text">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}

/* ================= Step 1 — lot ================= */

export function StepLot({ form, setForm, restaurants, lots, today, errors, touched, touch }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const show = (k) => (touched[k] ? errors[k] : "");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">1. ข้อมูลล็อต</h3>
        <p className="text-xs text-admin-textMuted">
          ระบุข้อมูลร้านและรายละเอียดล็อตสำหรับคูปองที่ต้องการนำเข้า
        </p>
      </div>

      <label className="block">
        <Label required>ร้านที่ใช้คูปอง</Label>
        <select
          value={form.restaurantId}
          onChange={(e) => set({ restaurantId: e.target.value, existingLot: "" })}
          className={`${inputCls} border-admin-border`}
        >
          {restaurants.map((r) => (
            <option key={String(r._id)} value={String(r._id)}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>
          <Label required>ประเภทการนำเข้า</Label>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[
            {
              v: "new",
              icon: PlusCircle,
              title: "สร้างล็อตใหม่",
              desc: "สร้างล็อตใหม่สำหรับคูปองชุดนี้",
            },
            {
              v: "existing",
              icon: Upload,
              title: "เพิ่มในล็อตเดิม",
              desc: "เพิ่มคูปองเข้าในล็อตที่มีอยู่แล้ว",
            },
          ].map(({ v, icon: Icon, title, desc }) => {
            const active = form.importType === v;
            return (
              <label
                key={v}
                className={[
                  "relative cursor-pointer rounded-2xl border p-3 transition",
                  active
                    ? "border-brand-primaryDark bg-brand-primary/10 ring-1 ring-brand-primaryDark"
                    : "border-admin-border hover:border-brand-primary",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="importType"
                  value={v}
                  checked={active}
                  onChange={() => set({ importType: v })}
                  className="absolute right-3 top-3 accent-[#0099CC]"
                />
                <Icon className={`h-5 w-5 ${active ? "text-brand-primaryDark" : "text-admin-textMuted"}`} />
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <div className="text-xs text-admin-textMuted">{desc}</div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {form.importType === "new" ? (
        <>
          <label className="block">
            <Label required>ชื่อล็อต</Label>
            <input
              value={form.batchName}
              onChange={(e) => set({ batchName: e.target.value })}
              onBlur={() => touch("batchName")}
              placeholder="เช่น CASA-2026-10"
              maxLength={60}
              className={`${inputCls} ${show("batchName") ? "border-red-400" : "border-admin-border"}`}
            />
            {show("batchName") ? (
              <FieldError>{show("batchName")}</FieldError>
            ) : (
              <p className="mt-1 text-xs text-admin-textMuted">
                ตั้งชื่อเพื่อใช้อ้างอิง เช่น ชื่อร้าน + ปี/เดือน
              </p>
            )}
          </label>

          <label className="block">
            <Label required>วันหมดอายุ</Label>
            <input
              type="date"
              value={form.expiresYMD}
              min={today}
              onChange={(e) => set({ expiresYMD: e.target.value })}
              onBlur={() => touch("expiresYMD")}
              className={`${inputCls} ${show("expiresYMD") ? "border-red-400" : "border-admin-border"}`}
            />
            {show("expiresYMD") ? (
              <FieldError>{show("expiresYMD")}</FieldError>
            ) : (
              <p className="mt-1 text-xs text-admin-textMuted">ระบุวันหมดอายุของคูปองในล็อตนี้</p>
            )}
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <Label required>ล็อตที่มีอยู่</Label>
            <select
              value={form.existingLot}
              onChange={(e) => set({ existingLot: e.target.value })}
              onBlur={() => touch("existingLot")}
              className={`${inputCls} ${show("existingLot") ? "border-red-400" : "border-admin-border"}`}
            >
              <option value="">— เลือกล็อต —</option>
              {lots.map((b) => {
                const expired = b.expiresYMD < today;
                return (
                  <option
                    key={lotKey(b.importBatch, b.expiresYMD)}
                    value={lotKey(b.importBatch, b.expiresYMD)}
                    disabled={expired}
                  >
                    {b.importBatch} · หมดอายุ {b.expiresYMD}
                    {expired ? " (หมดอายุแล้ว)" : ` · ${b.total} ใบ`}
                  </option>
                );
              })}
            </select>
            {lots.length === 0 ? (
              <p className="mt-1 text-xs text-admin-textMuted">
                ร้านนี้ยังไม่มีล็อต — เลือก &quot;สร้างล็อตใหม่&quot;
              </p>
            ) : (
              <FieldError>{show("existingLot")}</FieldError>
            )}
          </label>

          <div>
            <Label>วันหมดอายุ</Label>
            <div className="mt-1 rounded-xl border border-admin-border bg-admin-surfaceMuted px-3 py-2 text-sm text-admin-textMuted">
              {parseLotKey(form.existingLot)?.expiresYMD || "— เลือกล็อตก่อน —"}
            </div>
            <p className="mt-1 text-xs text-admin-textMuted">ใช้วันหมดอายุเดียวกับล็อตที่เลือก</p>
          </div>
        </>
      )}

      <label className="block">
        <Label>หมายเหตุ (ไม่บังคับ)</Label>
        <textarea
          value={form.note}
          onChange={(e) => set({ note: e.target.value.slice(0, MAX_IMPORT_NOTE) })}
          rows={4}
          placeholder="เช่น รายละเอียดเพิ่มเติมเกี่ยวกับล็อตนี้..."
          className={`${inputCls} resize-y border-admin-border`}
        />
        <div className="mt-1 text-right text-xs text-admin-textMuted">
          {form.note.length}/{MAX_IMPORT_NOTE}
        </div>
      </label>
    </div>
  );
}

/* ================= Step 2 — codes ================= */

// first column of each row; skip a header row that isn't a valid code
export function parseCodeFile(text) {
  const rows = String(text || "")
    .replace(/^﻿/, "")
    .split(/\r\n|\r|\n/)
    .map((line) => line.split(/[,;\t]/)[0].trim().replace(/^"(.*)"$/, "$1").trim())
    .filter(Boolean);
  if (rows.length > 0 && !STOCK_CODE_REGEX.test(normalizeStockCode(rows[0]))) {
    rows.shift();
  }
  return rows;
}

export function StepCodes({ codesText, setCodesText, mode, setMode, fileName, setFileName, local, tooMany }) {
  const fileRef = useRef(null);
  const [fileError, setFileError] = useState("");

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(txt|csv)$/i.test(file.name)) {
      setFileError("รองรับเฉพาะไฟล์ .txt หรือ .csv");
      return;
    }
    try {
      const codes = parseCodeFile(await file.text());
      setFileError(codes.length ? "" : "ไม่พบรหัสคูปองในไฟล์นี้");
      setFileName(file.name);
      setCodesText(codes.join("\n"));
    } catch (err) {
      console.error(err);
      setFileError("อ่านไฟล์ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">2. วางรหัสคูปอง</h3>
        <p className="text-xs text-admin-textMuted">วางรหัสคูปองทีละบรรทัด หรืออัปโหลดไฟล์</p>
      </div>

      <div className="grid grid-cols-2 rounded-xl bg-admin-surfaceMuted p-1 text-sm">
        {[
          ["paste", "วางทีละรหัส"],
          ["file", "อัปโหลดไฟล์"],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMode(v)}
            className={[
              "rounded-lg py-2 transition",
              mode === v
                ? "bg-brand-primary font-semibold text-[#0D1B2A] shadow-sm"
                : "text-admin-textMuted hover:text-admin-text",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <label className="block">
          <Label required>วางรหัสคูปอง (1 รหัสต่อ 1 บรรทัด)</Label>
          <textarea
            value={codesText}
            onChange={(e) => setCodesText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={"ABCDSA0-1001\nABCDSA0-1002\nABCDSA0-1003\n..."}
            className={`${inputCls} border-admin-border font-mono`}
          />
        </label>
      ) : (
        <div>
          <Label required>วางรหัสคูปอง (1 รหัสต่อ 1 บรรทัด)</Label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-1 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-white px-4 py-8 text-sm text-admin-textMuted hover:border-brand-primary"
          >
            <FileUp className="h-6 w-6" />
            {fileName ? (
              <span className="text-admin-text">
                {fileName} — คลิกเพื่อเปลี่ยนไฟล์
              </span>
            ) : (
              <span>คลิกเพื่อเลือกไฟล์ .txt หรือ .csv</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" onChange={onFile} className="hidden" />
          <FieldError>{fileError}</FieldError>
          <p className="mt-1 text-xs text-admin-textMuted">
            ใช้คอลัมน์แรกของแต่ละแถว · แถวหัวตารางจะถูกข้ามอัตโนมัติ · ดู/แก้รหัสได้ที่แท็บ &quot;วางทีละรหัส&quot;
          </p>
        </div>
      )}

      <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
        <div className="mb-1 flex items-center gap-1.5 font-semibold">
          <Info className="h-4 w-4" />
          คำแนะนำ
        </div>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>วางรหัสคูปองทีละ 1 บรรทัด</li>
          <li>รองรับไฟล์ข้อความ / CSV</li>
          <li>ระบบจะตรวจสอบรูปแบบและรหัสซ้ำให้อัตโนมัติ</li>
        </ul>
      </div>

      {local.lines.length > 0 &&
        (tooMany ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            นำเข้าได้ครั้งละไม่เกิน {MAX_IMPORT_CODES.toLocaleString()} รหัส (ตอนนี้{" "}
            {local.lines.length.toLocaleString()} รหัส)
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ตรวจพบ {local.lines.length.toLocaleString()} รายการ • ซ้ำกันเอง{" "}
            {local.duplicates.toLocaleString()} รายการ
          </div>
        ))}
    </div>
  );
}

/* ================= Step 3 — review ================= */

export const RESULT_META = {
  ok: { label: "ผ่าน", pill: "bg-green-100 text-green-700", reason: "" },
  exists: { label: "ซ้ำในระบบ", pill: "bg-amber-100 text-amber-700", reason: "มีในระบบแล้ว" },
  duplicate: { label: "ซ้ำกันเอง", pill: "bg-red-100 text-red-700", reason: "ซ้ำในไฟล์นี้" },
  invalid: { label: "ไม่ถูกต้อง", pill: "bg-red-100 text-red-700", reason: "รูปแบบไม่ถูกต้อง" },
};

const TILES = [
  { key: "", label: "ทั้งหมด", cls: "bg-blue-50 text-blue-700" },
  { key: "ok", label: "ผ่าน", cls: "bg-green-50 text-green-700" },
  { key: "exists", label: "ซ้ำในระบบ", cls: "bg-amber-50 text-amber-700" },
  { key: "duplicate", label: "ซ้ำกันเอง", cls: "bg-red-50 text-red-700" },
  { key: "invalid", label: "ไม่ถูกต้อง", cls: "bg-red-50 text-red-700" },
];

export function StepReview({ preview, recap, error }) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const rows = preview?.rows || [];
  const counts = {
    "": rows.length,
    ok: preview?.counts?.valid ?? 0,
    exists: preview?.counts?.exists ?? 0,
    duplicate: preview?.counts?.duplicate ?? 0,
    invalid: preview?.counts?.invalid ?? 0,
  };
  const filtered = filter ? rows.filter((r) => r.result === filter) : rows;
  const visible = showAll ? filtered : filtered.slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">3. ตรวจสอบและยืนยัน</h3>
        <p className="text-xs text-admin-textMuted">{recap}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-semibold">สรุปผลการตรวจสอบ</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TILES.map((t) => (
            <button
              key={t.key || "all"}
              type="button"
              onClick={() => {
                setFilter(t.key);
                setShowAll(false);
              }}
              aria-pressed={filter === t.key}
              className={[
                "rounded-xl p-3 text-left transition",
                t.cls,
                filter === t.key ? "ring-2 ring-current" : "hover:brightness-95",
              ].join(" ")}
            >
              <div className="text-xs">{t.label}</div>
              <div className="text-2xl font-bold">{counts[t.key].toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">
            ตัวอย่างรายการ{" "}
            <span className="font-normal text-admin-textMuted">
              ({showAll ? `ทั้งหมด ${filtered.length}` : `${visible.length} จาก ${filtered.length}`} รายการ)
            </span>
          </span>
          {filtered.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-brand-primaryDark hover:underline"
            >
              {showAll ? "แสดง 10 รายการแรก" : "แสดงทั้งหมด"}
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-admin-border">
          <table className="w-full text-sm">
            <thead className="bg-admin-surfaceMuted text-left text-xs text-admin-textMuted">
              <tr>
                <th className="px-3 py-2 font-medium">รหัสคูปอง</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const m = RESULT_META[r.result];
                return (
                  <tr key={`${i}-${r.raw}`} className="border-t border-admin-border/60">
                    <td className="px-3 py-1.5 font-mono text-xs">{r.code || r.raw}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.pill}`}>
                        {m.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-admin-textMuted">{m.reason || "—"}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-xs text-admin-textMuted">
                    ไม่มีรายการในกลุ่มนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
