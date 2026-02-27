// src/lib/password.server.js
import bcrypt from "bcryptjs";

export async function hashPassword(password) {
  const p = String(password || "");
  if (p.length < 8) throw new Error("Password must be at least 8 characters");
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(p, salt);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password || ""), String(hash || ""));
}