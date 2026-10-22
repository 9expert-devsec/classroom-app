#!/usr/bin/env node
// scripts/backfill-order-handout.mjs
//
// R5-3e: การส่งมอบคูปองกระดาษเป็นเหตุการณ์ของ "ออเดอร์" (LunchOrder.handedOutAt/By)
// ไม่ใช่ของรหัส — CouponStockCode.handedOutAt บอกแค่ผู้ถือปัจจุบัน
//
// 1) เติม handedOutAt/By ให้ออเดอร์ที่มีรหัส stock แต่ยังไม่มีค่า จาก
//      (a) audit "lunch.handout" ของออเดอร์นั้น (เวลาใน diff หรือเวลาที่บันทึก)
//      (b) handedOutAt ของรหัส — เฉพาะเมื่อรหัสยังผูกกับออเดอร์นี้ และสถานะยังเป็น handed_out / awaiting_return
//    ไม่เข้าเงื่อนไข = ไม่เติม (พิมพ์รายการไว้)
// 2) ล้าง handedOutAt ที่ค้างอยู่บนรหัสที่ไม่มีผู้ถือแล้ว (available / void) และรหัสที่แค่จองไว้ (assigned)
//    — ค่านั้นรั่วมาจากผู้ถือคนก่อน
//
// ไม่ลบอะไร ไม่แตะ field อื่น · รันซ้ำได้ (ครั้งที่สองต้องไม่มีอะไรให้ทำ)
//
//   node scripts/backfill-order-handout.mjs --db=classroom_phase2
//   node scripts/backfill-order-handout.mjs --db=classroom_phase2 --apply
//
// ค่าเริ่มต้นคือ DRY RUN · รอบนี้ล็อกไว้ให้รันกับ classroom_phase2 เท่านั้น

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { MongoClient } = require(path.join(REPO_ROOT, "node_modules/mongodb"));

const ALLOWED_DB = "classroom_phase2";
const HELD = new Set(["handed_out", "awaiting_return"]);
const NO_HOLDER = ["available", "void", "assigned"];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dbArg = args.find((a) => a.startsWith("--db="));
const REQUESTED_DB = dbArg ? dbArg.slice("--db=".length).trim() : "";

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

const envPath = path.join(REPO_ROOT, ".env.local");
if (!fs.existsSync(envPath)) die(`ไม่พบไฟล์ ${envPath}`);
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);
const URI = env.MONGODB_URI || "";
const DBNAME = env.MONGODB_DBNAME || "";
if (!URI) die("ไม่พบ MONGODB_URI ใน .env.local");
if (DBNAME !== ALLOWED_DB) die(`MONGODB_DBNAME = ${DBNAME || "(ว่าง)"} — สคริปต์นี้รันได้กับ ${ALLOWED_DB} เท่านั้น`);
if (REQUESTED_DB !== DBNAME) die(`ต้องระบุ --db=${DBNAME} ให้ตรงกับ MONGODB_DBNAME เพื่อยืนยันปลายทาง`);

const maskUri = (uri) => String(uri).replace(/(mongodb(?:\+srv)?:\/\/)[^@]*@/i, "$1***:***@").replace(/\?.*$/, "");

console.log("─".repeat(72));
console.log("Order handout backfill (R5-3e)");
console.log(`  host : ${maskUri(URI)}`);
console.log(`  db   : ${DBNAME}`);
console.log(`  mode : ${APPLY ? "APPLY (เขียนจริง)" : "DRY RUN (อ่านอย่างเดียว)"}`);
console.log("─".repeat(72));

const client = new MongoClient(URI);
await client.connect();
const db = client.db(DBNAME);
if (db.databaseName !== ALLOWED_DB) die(`connected db = ${db.databaseName}`);
const orders = db.collection("lunchorders");
const codes = db.collection("couponstockcodes");
const audits = db.collection("auditlogs");

/* ---------- 1) orders ---------- */

const todo = await orders
  .find(
    { stockCodeId: { $ne: null }, $or: [{ handedOutAt: null }, { handedOutAt: { $exists: false } }] },
    { projection: { _id: 1, dayYMD: 1, status: 1, holderName: 1, couponCode: 1, stockCodeId: 1 } },
  )
  .toArray();

const ids = todo.map((o) => o._id);
const auditRows = ids.length
  ? await audits
      .find(
        { action: "lunch.handout", entityType: "LunchOrder", entityId: { $in: ids.map(String) } },
        { projection: { entityId: 1, createdAt: 1, diffs: 1, actor: 1 } },
      )
      .sort({ createdAt: 1 })
      .toArray()
  : [];
const auditByOrder = new Map();
for (const a of auditRows) if (!auditByOrder.has(a.entityId)) auditByOrder.set(a.entityId, a);

const codeDocs = todo.length
  ? await codes
      .find({ _id: { $in: todo.map((o) => o.stockCodeId) } }, { projection: { code: 1, status: 1, orderId: 1, handedOutAt: 1 } })
      .toArray()
  : [];
const codeById = new Map(codeDocs.map((c) => [String(c._id), c]));

const fill = [];
const unset = [];
for (const o of todo) {
  const a = auditByOrder.get(String(o._id));
  if (a) {
    const d = (a.diffs || []).find((x) => x.path === "handedOutAt" && x.after);
    fill.push({ o, source: "audit", at: new Date(d?.after || a.createdAt), by: a.actor?.name || a.actor?.username || "" });
    continue;
  }
  const c = codeById.get(String(o.stockCodeId));
  if (c?.handedOutAt && String(c.orderId || "") === String(o._id) && HELD.has(c.status)) {
    fill.push({ o, source: "code", at: c.handedOutAt, by: "" });
    continue;
  }
  unset.push({
    order: String(o._id),
    day: o.dayYMD,
    status: o.status,
    learner: o.holderName || "",
    code: c?.code || o.couponCode || "",
    codeStatus: c?.status || "(missing)",
    linked: c ? String(c.orderId || "") === String(o._id) : false,
  });
}

console.log(`\nออเดอร์ที่มีรหัส stock แต่ยังไม่มี handedOutAt: ${todo.length}`);
console.log(`  เติมจาก audit : ${fill.filter((f) => f.source === "audit").length}`);
console.log(`  เติมจากรหัส  : ${fill.filter((f) => f.source === "code").length}`);
console.log(`  ไม่เติม       : ${unset.length}`);
if (fill.length) console.table(fill.map((f) => ({ order: String(f.o._id), day: f.o.dayYMD, source: f.source, at: f.at.toISOString() })));
if (unset.length) {
  console.log("\nไม่เติม (ไม่มีหลักฐานการส่งมอบของออเดอร์นี้):");
  console.table(unset);
}

/* ---------- 2) leaked handedOutAt on codes without a holder ---------- */

const leaked = await codes
  .find({ status: { $in: NO_HOLDER }, handedOutAt: { $ne: null } }, { projection: { code: 1, status: 1, handedOutAt: 1 } })
  .toArray();
console.log(`\nรหัสที่มี handedOutAt ค้าง (สถานะ ${NO_HOLDER.join("/")}): ${leaked.length}`);
if (leaked.length) console.table(leaked.map((c) => ({ code: c.code, status: c.status, handedOutAt: c.handedOutAt.toISOString() })));

if (APPLY) {
  let filled = 0;
  for (const f of fill) {
    const r = await orders.updateOne(
      { _id: f.o._id, $or: [{ handedOutAt: null }, { handedOutAt: { $exists: false } }] },
      { $set: { handedOutAt: f.at, handedOutBy: f.by } },
    );
    filled += r.modifiedCount;
  }
  const cleared = leaked.length
    ? (await codes.updateMany(
        { _id: { $in: leaked.map((c) => c._id) }, status: { $in: NO_HOLDER } },
        { $set: { handedOutAt: null } },
      )).modifiedCount
    : 0;
  console.log(`\nAPPLY: เติม handedOutAt ให้ออเดอร์ ${filled} ใบ · ล้าง handedOutAt บนรหัส ${cleared} ใบ`);
}

await client.close();
