import mongoose from "mongoose";

export default async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DBNAME || "classroom";

  if (!uri) {
    throw new Error("❌ Missing MONGODB_URI");
  }

  // ถ้ามีการเชื่อมต่ออยู่แล้ว ไม่ต้อง connect ใหม่
  if (mongoose.connection.readyState >= 1) return;

  return mongoose.connect(uri, {
    dbName,
  });
}