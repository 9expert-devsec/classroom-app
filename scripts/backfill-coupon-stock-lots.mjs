#!/usr/bin/env node
// scripts/backfill-coupon-stock-lots.mjs
//
// R5-1: สร้าง CouponStockLot ให้รหัสคูปองกระดาษที่ยังไม่มี lotId แล้วผูก lotId ให้รหัสเหล่านั้น
//
// จัดกลุ่มรหัสที่ยังไม่มี lotId ด้วย (restaurant, importBatch, expiresYMD)
//   - ล็อตมีชื่อ: 1 ชื่อ (ไม่สนตัวพิมพ์) ต่อร้าน = 1 ล็อต
//     ถ้าชื่อเดียวกันมีวันหมดอายุ (หรือตัวสะกด) มากกว่า 1 แบบ -> ไม่เดา พิมพ์รายการแล้วข้ามกลุ่มนั้น
//   - ล็อตไม่มีชื่อ: แยกล็อตด้วยวันหมดอายุ (ตรงกับ resolveImportLot)
//   - รันซ้ำได้: เจอล็อตที่ตรงกันอยู่แล้วจะใช้ล็อตนั้น ไม่สร้างใหม่ · ไม่แตะรหัสที่มี lotId แล้ว
//   - --apply ยังสร้าง index ของ couponstocklots / couponstockcodes.lotId ให้ด้วย
//     (ต้องมีก่อน import แบบใหม่ เพราะสร้าง collection ใน transaction)
//
// ไม่ลบอะไร ไม่แตะ expiresYMD / importBatch / status ของรหัส
//
//   node scripts/backfill-coupon-stock-lots.mjs --db=classroom_phase2
//   node scripts/backfill-coupon-stock-lots.mjs --db=classroom_phase2 --apply
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
const CREATED_BY = "backfill R5-1";

/* ---------------- args ---------------- */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dbArg = args.find((a) => a.startsWith("--db="));
const REQUESTED_DB = dbArg ? dbArg.slice("--db=".length).trim() : "";

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/* ---------------- env ---------------- */

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

function maskUri(uri) {
  return String(uri)
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@]*@/i, "$1***:***@")
    .replace(/\?.*$/, "");
}

// ตรงกับ lotNameKey() ใน src/models/CouponStockLot.js
function lotNameKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

/* ---------------- main ---------------- */

console.log("─".repeat(72));
console.log("CouponStockLot backfill (R5-1)");
console.log(`  host : ${maskUri(URI)}`);
console.log(`  db   : ${DBNAME}`);
console.log(`  mode : ${APPLY ? "APPLY (เขียนจริง)" : "DRY RUN (อ่านอย่างเดียว)"}`);
console.log("─".repeat(72));

const client = new MongoClient(URI);
await client.connect();
const db = client.db(DBNAME);
if (db.databaseName !== ALLOWED_DB) die(`connected db = ${db.databaseName}`);

const codesCol = db.collection("couponstockcodes");
const lotsCol = db.collection("couponstocklots");
const restCol = db.collection("restaurants");

const nameOf = new Map(
  (await restCol.find({}, { projection: { name: 1 } }).toArray()).map((r) => [String(r._id), r.name || ""]),
);

async function snapshot(label) {
  const [lots, codes, withLot] = await Promise.all([
    lotsCol.countDocuments(),
    codesCol.countDocuments(),
    codesCol.countDocuments({ lotId: { $type: "objectId" } }),
  ]);
  console.log(`${label}: lots=${lots}  codes=${codes}  codesWithLot=${withLot}  codesWithoutLot=${codes - withLot}`);
}

await snapshot("BEFORE");

// ทุกรหัส (ไม่ใช่เฉพาะที่ยังไม่มีล็อต) ใช้ตรวจว่าชื่อเดียวกันมีหลายวันหมดอายุไหม
const allCodes = await codesCol
  .find({}, { projection: { restaurant: 1, importBatch: 1, expiresYMD: 1, lotId: 1, note: 1, createdAt: 1 } })
  .toArray();

const variantsByName = new Map(); // `${restaurant}|${nameKey}` -> { exps:Set, names:Set }
for (const c of allCodes) {
  const key = lotNameKey(c.importBatch);
  if (!key) continue;
  const k = `${c.restaurant}|${key}`;
  if (!variantsByName.has(k)) variantsByName.set(k, { exps: new Set(), names: new Set() });
  variantsByName.get(k).exps.add(c.expiresYMD);
  variantsByName.get(k).names.add(c.importBatch);
}

const groups = new Map(); // `${restaurant}|${importBatch}|${expiresYMD}` -> group
for (const c of allCodes) {
  if (c.lotId) continue;
  const batch = c.importBatch || "";
  const k = `${c.restaurant}|${batch}|${c.expiresYMD}`;
  if (!groups.has(k)) {
    groups.set(k, { restaurant: c.restaurant, batch, expiresYMD: c.expiresYMD, ids: [], notes: new Set(), firstAt: null });
  }
  const g = groups.get(k);
  g.ids.push(c._id);
  g.notes.add(c.note || "");
  if (c.createdAt && (!g.firstAt || c.createdAt < g.firstAt)) g.firstAt = c.createdAt;
}

if (APPLY) {
  await lotsCol.createIndex({ restaurant: 1 }, { name: "restaurant_1" });
  await lotsCol.createIndex(
    { restaurant: 1, nameKey: 1 },
    { unique: true, partialFilterExpression: { nameKey: { $gt: "" } }, name: "restaurant_nameKey_unique_named" },
  );
  await codesCol.createIndex({ lotId: 1 }, { name: "lotId_1" });
}

const rows = [];
const skipped = [];

for (const g of [...groups.values()].sort((a, b) => `${a.batch}|${a.expiresYMD}`.localeCompare(`${b.batch}|${b.expiresYMD}`))) {
  const key = lotNameKey(g.batch);
  const shop = nameOf.get(String(g.restaurant)) || String(g.restaurant);
  const row = { shop, batch: g.batch || "(ไม่ระบุ)", expiresYMD: g.expiresYMD, codes: g.ids.length, action: "", lotId: "" };

  if (key) {
    const v = variantsByName.get(`${g.restaurant}|${key}`);
    if (v.exps.size > 1 || v.names.size > 1) {
      skipped.push({ ...row, why: `ชื่อนี้มี ${[...v.names].join(" / ")} · หมดอายุ ${[...v.exps].sort().join(" / ")}` });
      continue;
    }
  }

  const existing = await lotsCol.findOne(
    key ? { restaurant: g.restaurant, nameKey: key } : { restaurant: g.restaurant, nameKey: "", expiresYMD: g.expiresYMD, status: "active" },
  );
  if (existing && existing.expiresYMD !== g.expiresYMD) {
    skipped.push({ ...row, why: `ล็อตเดิม ${existing._id} หมดอายุ ${existing.expiresYMD}` });
    continue;
  }

  let lotId = existing?._id || null;
  row.action = existing ? "reuse" : "create";

  if (APPLY) {
    if (!lotId) {
      const now = new Date();
      const notes = [...g.notes];
      const res = await lotsCol.insertOne({
        restaurant: g.restaurant,
        name: g.batch,
        nameKey: key,
        expiresYMD: g.expiresYMD,
        note: notes.length === 1 ? notes[0] : "",
        status: "active",
        cancelledAt: null,
        cancelledBy: "",
        cancelReason: "",
        createdBy: CREATED_BY,
        createdAt: g.firstAt || now,
        updatedAt: now,
        __v: 0,
      });
      lotId = res.insertedId;
    }
    const upd = await codesCol.updateMany(
      { _id: { $in: g.ids }, $or: [{ lotId: null }, { lotId: { $exists: false } }] },
      { $set: { lotId } },
    );
    row.linked = upd.modifiedCount;
  }
  row.lotId = lotId ? String(lotId) : "(new)";
  rows.push(row);
}

console.log("\nกลุ่มที่ยังไม่มีล็อต:");
if (rows.length === 0) console.log("  (ไม่มี — no-op)");
else console.table(rows);

if (skipped.length) {
  console.log("\n⚠ ข้าม (ไม่เดา):");
  console.table(skipped);
}

await snapshot("\nAFTER ");
await client.close();
