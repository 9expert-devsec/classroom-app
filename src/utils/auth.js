// src/utils/auth.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}
 
// สร้าง token สำหรับ admin
export function signAdminToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

// ตรวจสอบ token
export function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
