import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || "classroom";

if (!MONGODB_URI) {
  // ทำให้ fail ตั้งแต่ import (เห็นชัดใน logs)
  throw new Error("❌ Missing MONGODB_URI");
}

// Global cache (สำคัญมากบน Next/Vercel)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      dbName: MONGODB_DBNAME,

      // fail fast (ไม่ค้างนาน)
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,

      // ปิด buffer เพื่อให้ error โผล่ทันที ไม่รอ 10 วิ
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
