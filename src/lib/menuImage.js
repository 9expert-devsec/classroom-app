// src/lib/menuImage.js
//
// เกณฑ์ความกว้างรูปเมนู ใช้ที่หน้า admin (เตือนตอนอัพโหลด)
// หน้ารายละเอียดแสดงรูปกว้างเต็มจอ (390px x DPR 3) รูปที่แคบกว่านี้จะเบลอเมื่อขยาย

export const MIN_MENU_IMAGE_W = 800;

// Hero ของหน้ารายละเอียดเมนู (กรอบ 4:3): ให้ Cloudinary ขยายด้วย AI แล้วตัดเต็มกรอบ
//   e_upscale            : AI super-resolution x4 ต่อด้าน (รับรูป < 4.2MP, ไม่รองรับภาพเคลื่อนไหว/remote fetch)
//   c_fill,ar_4:3,w_1200 : ตัดเต็มกรอบ 4:3 กว้าง 1200px (g_auto = เลือกจุดสนใจเอง)
//   f_auto,q_auto        : ฟอร์แมต/คุณภาพตามเบราว์เซอร์
// ไม่รู้ขนาดรูปก่อนโหลด จึงใช้ chain เดียวกันทุกรูป (รูปใหญ่ < 4.2MP ก็ถูก upscale ก่อนย่อ — ไม่ error)
// ถ้าโหลดไม่ได้ (เช่น 423 ระหว่างสร้าง, เกินขีดจำกัด, plan ไม่รองรับ) หน้าเว็บ fallback ไปรูปต้นฉบับ
export const MENU_HERO_TRANSFORM =
  "e_upscale/c_fill,ar_4:3,w_1200,g_auto/f_auto,q_auto";

// เฉพาะรูปต้นฉบับใน folder classroom-food (ยังไม่มี transformation ใน path)
const CLOUDINARY_MENU_RE =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)((?:v\d+\/)?classroom-food\/[^?#]+)$/;

/** URL ของ hero ที่ผ่าน AI upscale แล้ว หรือ "" ถ้าไม่ใช่รูปเมนูบน Cloudinary */
export function menuHeroSrc(url) {
  const m = CLOUDINARY_MENU_RE.exec(String(url || "").trim());
  return m ? `${m[1]}${MENU_HERO_TRANSFORM}/${m[2]}` : "";
}
