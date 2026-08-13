# 9Expert Classroom — External API Integration Guide (v1)

คู่มือสำหรับนักพัฒนาเว็บไซต์พาร์ทเนอร์ในเครือ 9Expert ที่ต้องการดึง **ตารางสอน (class schedule)**
พร้อม **ชื่ออาจารย์และลายเซ็นอาจารย์** และ **อีเวนต์ (events)** ไปแสดงบนเว็บไซต์ของตนเอง

API นี้เป็น **read-only** ทั้งหมด ไม่มี endpoint สำหรับเขียนข้อมูล และ **ไม่มีข้อมูลผู้เรียนใด ๆ**
(ไม่มีรายชื่อนักเรียน จำนวนผู้เรียน ผู้ลงทะเบียนอีเวนต์ การเช็คอิน ข้อมูลอาหาร หรือใบรับเอกสาร)

> ต้องการ **ปฏิทินรวมคลาส + อีเวนต์ ในลิสต์เดียว**? ข้ามไปที่ [`GET /schedule`](#34-get-schedule--ปฏิทินรวม-คลาส--อีเวนต์) ได้เลย

---

## 1. Base URL

| Environment | Base URL |
| --- | --- |
| Production | `https://register.9expert.app/api/ext/v1` |
| Local dev | `http://localhost:3000/api/ext/v1` |

ทุก endpoint อยู่ภายใต้ base URL นี้ เช่น `GET https://register.9expert.app/api/ext/v1/classes`

---

## 2. Authentication

ใช้ **API key** ที่ทีม 9Expert ออกให้ ส่งมากับทุก request ผ่าน header `x-api-key`

```
x-api-key: 9xc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

รองรับรูปแบบ `Authorization: Bearer` ด้วย (ผลลัพธ์เหมือนกันทุกประการ)

```
Authorization: Bearer 9xc_live_xxxxxxxxxxxx...
```

### ข้อควรระวังเรื่อง API key

- คีย์จะแสดง **เพียงครั้งเดียว** ตอนสร้าง ระบบเก็บเฉพาะค่า hash — ถ้าทำหายต้องยกเลิกแล้วออกใหม่
- **ห้ามฝังคีย์ไว้ใน JavaScript ฝั่ง client** ที่ผู้ใช้ทั่วไปเปิดดูได้
  ให้เรียกจากฝั่งเซิร์ฟเวอร์ของท่าน (SSR / API route / cron) แล้วส่งผลลัพธ์ต่อให้หน้าเว็บ
- คีย์อาจถูกจำกัด **origin** และ/หรือ **IP** ตามที่ตกลงกันไว้
- ข้อยกเว้นเดียวคือ `GET /signature/{token}` ซึ่ง **ไม่ต้องใช้ API key** (ดูข้อ 6)

---

## 3. Endpoints

| Method | Path | Scope | คำอธิบาย |
| --- | --- | --- | --- |
| `GET` | `/health` | – | ตรวจสอบว่าคีย์ใช้งานได้ และดู scope ของคีย์ |
| `GET` | `/classes` | `classes.read` | รายการคลาส (มี filter + paging) |
| `GET` | `/classes/{idOrName}` | `classes.read` | คลาสเดียว ระบุด้วย `class_id` หรือ `class_name` |
| `GET` | `/schedule` | `classes.read` (+ `events.read`) | **ปฏิทินรวม** คลาส + อีเวนต์ ในลิสต์เดียว |
| `GET` | `/signature/{token}` | – | รูปลายเซ็นอาจารย์ (ใช้ token แทน API key) |

ทุก endpoint รองรับ `OPTIONS` สำหรับ CORS preflight

### Scope ที่มี

| Scope | ให้สิทธิ์อะไร |
| --- | --- |
| `classes.read` | `/classes`, `/classes/{idOrName}` และรายการ **class** ใน `/schedule` |
| `events.read` | รายการ **event** ใน `/schedule` เท่านั้น (ไม่มี endpoint แยกสำหรับอีเวนต์) |

`events.read` ไม่ได้ให้อัตโนมัติ ถ้าต้องการอีเวนต์ด้วยกรุณาแจ้งทีม 9Expert
คีย์ที่ออกไปแล้วจะไม่ถูกเปลี่ยน scope เองโดยระบบ

### 3.1 `GET /health`

```bash
curl -H "x-api-key: $KEY" "https://register.9expert.app/api/ext/v1/health"
```

```json
{
  "ok": true,
  "service": "classroom-app external api",
  "version": "v1",
  "key": {
    "name": "Partner: 9expert.com",
    "prefix": "9xc_live_a1b2c3d4",
    "scopes": ["classes.read"]
  },
  "server_time": "2026-08-04T09:09:33.288Z"
}
```

ใช้ตรวจสุขภาพระบบและยืนยันว่าคีย์ยังไม่ถูกยกเลิก/หมดอายุ

### 3.2 `GET /classes`

```bash
curl -H "x-api-key: $KEY" \
  "https://register.9expert.app/api/ext/v1/classes?date=2026-08-04"
```

```json
{
  "ok": true,
  "version": "v1",
  "count": 3,
  "total": 3,
  "page": 1,
  "limit": 50,
  "items": [ /* class objects — ดูข้อ 5 */ ]
}
```

| ฟิลด์ | ความหมาย |
| --- | --- |
| `count` | จำนวนรายการใน `items` ของหน้านี้ |
| `total` | จำนวนรายการทั้งหมดที่ตรงเงื่อนไข (ใช้คำนวณจำนวนหน้า) |
| `page` | หน้าปัจจุบัน (เริ่มที่ 1) |
| `limit` | จำนวนต่อหน้าที่ใช้จริง |

### 3.3 `GET /classes/{idOrName}`

รับได้ทั้ง `class_id` (Mongo ObjectId) และ `class_name` (ไม่สนตัวพิมพ์เล็ก/ใหญ่)

```bash
curl -H "x-api-key: $KEY" \
  "https://register.9expert.app/api/ext/v1/classes/CR-PUB-N8N-L1-04-08-69-1"
```

```json
{ "ok": true, "version": "v1", "item": { /* class object */ } }
```

ถ้าไม่พบ จะได้ `404` พร้อม `error.code = "class_not_found"`

### 3.4 `GET /schedule` — ปฏิทินรวม (คลาส + อีเวนต์)

endpoint นี้ตอบเป็น **ลิสต์เดียว** ที่มีทั้งคลาสอบรมและอีเวนต์ปนกัน เรียงตามวันเริ่ม
เหมาะกับหน้า "ปฏิทินกิจกรรมของ 9Expert" ที่ต้องแสดงทุกอย่างของวันนั้นรวมกัน

```bash
curl -H "x-api-key: $KEY" \
  "https://register.9expert.app/api/ext/v1/schedule?date=2026-08-13"
```

```json
{
  "ok": true,
  "version": "v1",
  "included_types": ["class", "event"],
  "date_from": "2026-08-13",
  "date_to": "2026-08-13",
  "count": 3,
  "total": 3,
  "page": 1,
  "limit": 50,
  "items": [ /* class objects และ event objects ปนกัน */ ]
}
```

| ฟิลด์ | ความหมาย |
| --- | --- |
| `included_types` | **ชนิดข้อมูลที่ผลลัพธ์ชุดนี้อาจมีได้** — ดูข้อ 3.4.1 |
| `date_from` / `date_to` | ช่วงวันที่ระบบใช้จริง (มีประโยชน์มากเมื่อไม่ได้ส่งพารามิเตอร์วันที่มา) |
| `count` | จำนวนรายการใน `items` ของหน้านี้ |
| `total` | จำนวน **คลาส + อีเวนต์รวมกัน** ที่ตรงเงื่อนไข (ไม่ใช่ของชนิดใดชนิดหนึ่ง) |
| `page` / `limit` | หน้าปัจจุบัน / จำนวนต่อหน้า |

#### 3.4.1 `included_types` — กติกาเรื่องสิทธิ์ (สำคัญ)

`/schedule` **ต้องมี `classes.read` เสมอ** ส่วนอีเวนต์จะรวมมาให้ก็ต่อเมื่อคีย์มี `events.read` ด้วย
และระบบจะ **บอกเสมอว่ารอบนี้รวมอะไรบ้าง** ไม่มีการซ่อนเงียบ ๆ

| สถานะของคีย์ / คำขอ | ผลลัพธ์ |
| --- | --- |
| มี `classes.read` อย่างเดียว | `200` + `"included_types": ["class"]` — ไม่มีอีเวนต์ในลิสต์ |
| มีทั้ง `classes.read` และ `events.read` | `200` + `"included_types": ["class", "event"]` |
| มี `events.read` แต่**ไม่มี** `classes.read` | `403` `scope_denied` |
| ส่ง `type=event` แต่คีย์ไม่มี `events.read` | `403` `scope_denied` — **ไม่ใช่** ลิสต์ว่าง |
| ส่ง `type=class` (คีย์มีครบ) | `200` + `"included_types": ["class"]` |
| ส่ง `type=event` (คีย์มีครบ) | `200` + `"included_types": ["event"]` |

พูดสั้น ๆ: `included_types` = **สิทธิ์ของคีย์** ∩ **สิ่งที่ท่านขอผ่าน `type`**
ถ้าไม่ส่ง `type` มาเลย (ค่าเริ่มต้น `all`) ค่านี้จะสะท้อนสิทธิ์ของคีย์ตรง ๆ

> **แนะนำ:** อ่าน `included_types` ทุกครั้งก่อนสรุปว่า "วันนี้ไม่มีอีเวนต์"
> ถ้าค่าเป็น `["class"]` แปลว่า **ไม่ได้ถาม** ไม่ใช่ **ไม่มี**

#### 3.4.2 `type` — ตัวแยกชนิดในแต่ละรายการ

ทุกรายการใน `items` มีคีย์ `"type"` เป็น **คีย์แรกเสมอ** ค่าเป็น `"class"` หรือ `"event"`

```js
for (const item of data.items) {
  if (item.type === "class") renderClass(item);
  else renderEvent(item);
}
```

- รายการ `type: "class"` คือ **class object ชุดเดิมทุกประการ** ที่ `/classes` ส่งกลับ (ข้อ 5.1)
  เพียงแต่มี `"type": "class"` นำหน้า — ใช้ตัว render เดิมได้เลย
- รายการ `type: "event"` คือ event object (ข้อ 5.4)

---

## 4. Query Parameters

### 4.1 `/classes`

| Parameter | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | – | คลาสที่ **มีการสอนในวันนั้น** |
| `from` | `YYYY-MM-DD` | – | ต้นช่วง (รวมวันนั้น) |
| `to` | `YYYY-MM-DD` | – | ปลายช่วง (รวมวันนั้น) |
| `course` | string | – | `course_code` แบบตรงตัว ไม่สนตัวพิมพ์เล็ก/ใหญ่ |
| `q` | string | – | ค้นหาบางส่วนใน `class_name`, `course_code`, `course_name`, `custom_course_name`, `room`, ชื่ออาจารย์ (ภาษาไทย) |
| `room` | string | – | ชื่อห้องแบบตรงตัว ไม่สนตัวพิมพ์เล็ก/ใหญ่ |
| `limit` | number | `50` | จำนวนต่อหน้า สูงสุด `200` |
| `page` | number | `1` | เลขหน้า เริ่มที่ 1 |
| `sort` | `date_asc` \| `date_desc` | `date_asc` | เรียงตามวันเริ่มคลาส |
| `signature` | `1` \| `0` | `1` | `0` = ไม่สร้าง signature URL |

> **สำคัญเรื่องวันที่:** `date` และ `from`/`to` จะ match **ทุกวันที่มีการสอน** ไม่ใช่เฉพาะวันแรก
> คลาส 3 วันที่เริ่ม `2026-08-03` จะถูกดึงมาด้วยเมื่อค้นด้วย `date=2026-08-04`
> ถ้าส่งทั้ง `date` และ `from`/`to` มาพร้อมกัน ระบบจะใช้ `date` เป็นหลัก

### ตัวอย่าง

```bash
# คลาสของวันนี้
curl -H "x-api-key: $KEY" ".../classes?date=2026-08-04"

# คลาสทั้งเดือนสิงหาคม
curl -H "x-api-key: $KEY" ".../classes?from=2026-08-01&to=2026-08-31"

# เฉพาะหลักสูตรเดียว ในช่วงเวลาหนึ่ง
curl -H "x-api-key: $KEY" ".../classes?from=2026-08-01&to=2026-08-31&course=N8N-L1"

# ค้นหาอิสระ
curl -H "x-api-key: $KEY" ".../classes?q=excel"

# แบ่งหน้า + เรียงจากใหม่ไปเก่า
curl -H "x-api-key: $KEY" ".../classes?limit=20&page=2&sort=date_desc"

# ไม่ต้องการลายเซ็น (เร็วขึ้นเล็กน้อย)
curl -H "x-api-key: $KEY" ".../classes?date=2026-08-04&signature=0"
```

### 4.2 `/schedule`

| Parameter | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | **วันนี้** | ทุกอย่างที่เกิดขึ้นในวันนั้น |
| `from` | `YYYY-MM-DD` | – | ต้นช่วง (รวมวันนั้น) |
| `to` | `YYYY-MM-DD` | – | ปลายช่วง (รวมวันนั้น) |
| `type` | `class` \| `event` \| `all` | `all` | กรองชนิดรายการ — ดูข้อ 3.4.1 |
| `q` | string | – | ค้นหาบางส่วน: คลาสค้นเหมือน `/classes`, อีเวนต์ค้นที่ `title`, `location`, `note` |
| `limit` | number | `50` | จำนวนต่อหน้า สูงสุด `200` (นับรวมทั้งสองชนิด) |
| `page` | number | `1` | เลขหน้า เริ่มที่ 1 |
| `sort` | `date_asc` \| `date_desc` | `date_asc` | เรียงตาม `date_start` |
| `signature` | `1` \| `0` | `1` | มีผลกับรายการ `type: "class"` เท่านั้น (อีเวนต์ไม่มีลายเซ็น) |

**ไม่มี** `course` และ `room` ที่นี่ — สองอย่างนี้มีเฉพาะกับคลาส ถ้าต้องกรองด้วยให้ใช้ `/classes`

> **ถ้าไม่ส่งพารามิเตอร์วันที่มาเลย** ระบบจะใช้ **วันนี้ตามเวลาไทย** ให้อัตโนมัติ
> ไม่ใช่การส่งข้อมูลทั้งหมดที่มีกลับไป — `/schedule` เป็น feed รายวันโดยเจตนา
> ค่าที่ใช้จริงจะปรากฏใน `date_from` / `date_to` ของผลลัพธ์เสมอ
>
> `date` มาก่อน `from`/`to` เหมือน `/classes` และเช่นเดียวกัน — คลาสหลายวันและอีเวนต์หลายวัน
> จะถูก match **ทุกวันที่มันกินพื้นที่** ไม่ใช่เฉพาะวันแรก

#### การเรียงลำดับ

เรียงตาม `date_start` → ถ้าตรงกันเอา **`class` ก่อน `event`** → ถ้ายังตรงกันเรียงตามชื่อ
(`class_name` / `title`) → สุดท้ายตาม id ผลลัพธ์จึงคงที่และแบ่งหน้าได้ปลอดภัย

`page` / `limit` ทำงานกับ **ลิสต์ที่รวมกันแล้ว** ดังนั้นหน้าหนึ่งอาจมีทั้งคลาสและอีเวนต์ปนกัน
และ `total` คือผลรวมของทั้งสองชนิดเสมอ

### ตัวอย่าง

```bash
# ทุกอย่างของวันนี้ (ไม่ต้องส่งวันที่)
curl -H "x-api-key: $KEY" ".../schedule"

# ปฏิทินทั้งเดือน
curl -H "x-api-key: $KEY" ".../schedule?from=2026-08-01&to=2026-08-31"

# เฉพาะอีเวนต์ (ต้องมี events.read ไม่งั้นได้ 403)
curl -H "x-api-key: $KEY" ".../schedule?from=2026-08-01&to=2026-08-31&type=event"

# เฉพาะคลาส
curl -H "x-api-key: $KEY" ".../schedule?date=2026-08-13&type=class"

# ค้นหาข้ามทั้งสองชนิด
curl -H "x-api-key: $KEY" ".../schedule?from=2026-01-01&to=2026-12-31&q=power+bi"
```

---

## 5. Response Schema

### 5.1 Class object

| Field | Type | คำอธิบาย | อาจว่างได้ |
| --- | --- | --- | --- |
| `class_id` | string | รหัสภายในของคลาส (Mongo ObjectId) | ไม่ |
| `class_name` | string | ชื่อ/รหัสคลาส เช่น `CR-PUB-N8N-L1-04-08-69-1` | ไม่ |
| `course_code` | string | รหัสหลักสูตร เช่น `N8N-L1` | ได้ |
| `course_name` | string | ชื่อหลักสูตร (ถ้าว่างจะใช้ `custom_course_name`) | ได้ |
| `custom_course_name` | string | ชื่อหลักสูตรที่ตั้งเอง (คลาส in-house) | **มักว่าง** |
| `day_count` | number | จำนวนวันอบรม | ไม่ |
| `dates` | string[] | วันอบรมทุกวัน `YYYY-MM-DD` เรียงจากน้อยไปมาก | ไม่ |
| `date_start` | string | วันแรกใน `dates` | ไม่ |
| `date_end` | string | วันสุดท้ายใน `dates` | ไม่ |
| `start_time` | string | เวลาเริ่ม `HH:mm` (ค่าเริ่มต้น `09:00`) | ไม่ |
| `end_time` | string | เวลาเลิก `HH:mm` (ค่าเริ่มต้น `16:00`) | ไม่ |
| `room` | string | ห้องอบรม เช่น `Mars` | ได้ |
| `training_type` | string | `classroom` \| `hybrid` \| `""` | ได้ |
| `channel` | string | ช่องทาง เช่น `PUB` | ได้ |
| `program` | object | `{ program_id, program_name }` — **ดูหมายเหตุ 5.3** | **ว่างเสมอในตอนนี้** |
| `class_image_url` | string | รูปหน้าปกคลาส | **มักว่าง** |
| `instructors` | array | รายชื่ออาจารย์ ดู 5.2 | ไม่ |
| `updated_at` | string \| null | เวลาที่แก้ไขล่าสุด (ISO 8601) | ได้ |

`dates.length === day_count` เสมอ — ใช้ `dates` เป็นแหล่งความจริงเรื่องวันอบรม

### 5.2 Instructor object

| Field | Type | คำอธิบาย | อาจว่างได้ |
| --- | --- | --- | --- |
| `name` | string | **ชื่อที่ควรนำไปแสดง** = ชื่ออังกฤษ ถ้าไม่มีจะ fallback เป็นชื่อไทย | ไม่ |
| `name_en` | string | ชื่ออังกฤษ | **ได้ — ดูหมายเหตุ 5.3** |
| `name_th` | string | ชื่อไทย (มีค่าเสมอ) | ไม่ |
| `email` | string | อีเมลอาจารย์ | **มักว่าง** |
| `code` | string | รหัสอาจารย์ | **ว่างเสมอในตอนนี้ — ดู 5.3** |
| `signature_url` | string \| null | URL รูปลายเซ็น (มีอายุจำกัด) — `null` เมื่อยังไม่มีลายเซ็น | ได้ |
| `signature_expires_at` | string \| null | เวลาหมดอายุของ `signature_url` (ISO 8601) | ได้ |

### 5.3 ข้อจำกัดของข้อมูลจริง ณ ปัจจุบัน (สิงหาคม 2026) — โปรดอ่าน

หัวข้อนี้อธิบายสภาพข้อมูลจริง ไม่ใช่สิ่งที่ตั้งใจจะเป็น เพื่อให้ท่านออกแบบหน้าเว็บได้ถูกต้อง

1. **`name` อาจเป็นภาษาไทย**
   `name` = `name_en` โดยมี `name_th` เป็น fallback ปัจจุบันอาจารย์ที่มีคลาส 9 ท่าน
   มี **8 ท่าน** ที่มีชื่ออังกฤษ อีก **1 ท่าน** (`อ.ณัฐดนัย ปราณีณัฐวีร์`) ยังไม่มี `name_en`
   ในระบบต้นทาง จึงจะได้ชื่อไทยกลับไป
   → **อย่าออกแบบ layout โดยสมมติว่า `name` เป็นภาษาอังกฤษเสมอ** ต้องรองรับข้อความไทยด้วย
   (ข้อมูลนี้แก้ที่ระบบ MSDB ต้นทาง เมื่อกรอกแล้ว API จะส่งชื่ออังกฤษให้เองโดยอัตโนมัติ)

2. **`code` เป็น `""` เสมอในตอนนี้**
   รหัสอาจารย์ยังไม่ถูกกรอกในระบบต้นทาง (0 จาก 10 ท่าน)
   → **ห้ามใช้ `code` เป็น key ในการจับคู่ข้อมูล** ให้ใช้ `name_th` หรือ `name_en` แทน

3. **`program` เป็น `{"program_id": "", "program_name": ""}` เสมอในตอนนี้**
   ฟิลด์นี้สงวนไว้สำหรับอนาคต (0 จาก 127 คลาสมีข้อมูล)
   → **ห้ามเขียน logic ที่พึ่งพา `program`** เช่น จัดกลุ่มหรือกรองตาม program

4. **`email` มักเป็น `""`**
   มีเพียง 1 จาก 127 คลาสที่มีอีเมลอาจารย์

5. **`signature_url` เป็น `null` ได้ และไม่ใช่ error**
   หมายความว่าอาจารย์ท่านนั้นยังไม่มีลายเซ็นในระบบ
   → ให้ซ่อนพื้นที่ลายเซ็นไป ไม่ต้องแสดงข้อความผิดพลาด

6. **`signature=0` ส่งค่าเป็น `null` ไม่ใช่ตัดฟิลด์ทิ้ง**
   `signature_url` และ `signature_expires_at` จะยังอยู่ในผลลัพธ์เสมอ แต่มีค่าเป็น `null`
   เพื่อให้โครงสร้าง JSON คงที่

### 5.4 Event object (เฉพาะใน `/schedule`)

```json
{
  "type": "event",
  "event_id": "6a7d43ab5bd1c2c71f77332c",
  "title": "Tricks & Talk EP.6",
  "location": "9Expert Training",
  "note": "",
  "day_count": 1,
  "dates": ["2026-03-20"],
  "date_start": "2026-03-20",
  "date_end": "2026-03-20",
  "start_time": "17:00",
  "end_time": "20:30",
  "cover_image_url": "https://res.cloudinary.com/.../cover.png",
  "updated_at": "2026-03-16T08:12:03.114Z"
}
```

| Field | Type | คำอธิบาย | อาจว่างได้ |
| --- | --- | --- | --- |
| `type` | string | `"event"` เสมอ — เป็นคีย์แรกของ object | ไม่ |
| `event_id` | string | รหัสภายในของอีเวนต์ (Mongo ObjectId) | ไม่ |
| `title` | string | ชื่ออีเวนต์ | ไม่ |
| `location` | string | สถานที่ | **ได้** |
| `note` | string | หมายเหตุที่ทีมงานใส่ไว้ | **มักว่าง** |
| `day_count` | number | จำนวนวันที่อีเวนต์กินพื้นที่ | ไม่ |
| `dates` | string[] | ทุกวันที่อีเวนต์กินพื้นที่ `YYYY-MM-DD` | ไม่ |
| `date_start` / `date_end` | string | วันแรก / วันสุดท้ายใน `dates` | ไม่ |
| `start_time` | string | เวลาเริ่ม `HH:mm` **เวลาไทย** | **ได้ — ดูหมายเหตุ** |
| `end_time` | string | เวลาจบ `HH:mm` **เวลาไทย** | **ได้ — ดูหมายเหตุ** |
| `cover_image_url` | string | รูปหน้าปกอีเวนต์ (ใช้ได้ตรง ๆ ไม่หมดอายุ ต่างจาก signature) | ได้ |
| `updated_at` | string \| null | เวลาที่แก้ไขล่าสุด (ISO 8601) | ได้ |

**หมายเหตุเรื่องเวลาของอีเวนต์**

- `end_time` เป็น `""` เมื่ออีเวนต์นั้น **ไม่ได้ระบุเวลาจบ** ในระบบ (เป็น optional)
- `start_time` / `end_time` เป็น `""` เมื่อเวลานั้นตรงกับ **00:00 เวลาไทย**
  ซึ่งหมายถึง "มีแต่วัน ไม่ได้ระบุเวลา" ไม่ใช่ "เริ่มเที่ยงคืน"
  → ถ้าได้ `""` ให้แสดงเป็นกิจกรรมแบบทั้งวัน อย่าพิมพ์ `00:00`
- อีเวนต์ที่**ยกเลิก/ปิดใช้งาน** จะไม่ปรากฏใน API เลย
- อีเวนต์ **ไม่มี** `course_code`, `room`, `instructors`, `channel`, `program`
  ถ้าโค้ดฝั่งท่านอ่านฟิลด์เหล่านี้ ต้องเช็ค `type` ก่อนเสมอ

### 5.5 หกฟิลด์ที่ class และ event ใช้ร่วมกัน — จุดสำคัญของ `/schedule`

class object และ event object **จงใจ** ให้ 6 ฟิลด์นี้ชื่อเดียวกันและความหมายเดียวกัน

```
day_count   dates   date_start   date_end   start_time   end_time
```

ท่านจึง **เรนเดอร์มุมมองรายวันได้โดยไม่ต้องเช็ค `type` เลย**

```js
// ทำงานได้กับทั้งคลาสและอีเวนต์
function renderRow(item) {
  const when = item.start_time
    ? `${item.start_time}–${item.end_time || "?"}`
    : "ทั้งวัน";
  const title = item.class_name || item.title;   // ตรงนี้ค่อยต่างกัน
  return `${item.date_start} ${when}  ${title}`;
}

// จัดกลุ่มตามวัน: ใช้ dates[] ของทั้งสองชนิดได้เหมือนกัน
const byDay = {};
for (const item of data.items) {
  for (const d of item.dates) (byDay[d] ||= []).push(item);
}
```

ส่วนที่เหลือต่างกันหมดและต้องดู `type`:

| | class | event |
| --- | --- | --- |
| id | `class_id` | `event_id` |
| ชื่อ | `class_name` | `title` |
| เฉพาะตัว | `course_code`, `course_name`, `room`, `training_type`, `channel`, `program`, `instructors`, `class_image_url` | `location`, `note`, `cover_image_url` |

### 5.6 วันที่และเขตเวลา — ทุกอย่างเป็นเวลาไทย

ทุก `date*` และ `*_time` ในผลลัพธ์ถูกคำนวณใน **`Asia/Bangkok`** แล้วเรียบร้อย
ท่าน **ไม่ต้องแปลงเขตเวลาเอง** และไม่ควรแปลง

เรื่องนี้สำคัญกับอีเวนต์เป็นพิเศษ เพราะอีเวนต์เก็บเป็น timestamp (UTC) ในฐานข้อมูล
ไม่ใช่ข้อความวันที่แบบคลาส ตัวอย่างจริง:

| ค่าที่เก็บจริง (UTC) | ระบบตอบเป็น | ถ้าอ่านแบบ UTC จะได้ (ผิด) |
| --- | --- | --- |
| `2026-03-20T10:00:00Z` | `2026-03-20` `17:00` | `2026-03-20` `10:00` |
| `2026-08-04T17:00:00Z` | `2026-08-05` `00:00` → `start_time: ""` | `2026-08-04` `17:00` |

อีเวนต์ตอนเย็นของไทยอยู่คนละวันกับ UTC เสมอ — ระบบจัดการให้แล้ว
ถ้าท่านเอา `updated_at` (ซึ่งเป็น ISO/UTC โดยเจตนา) ไปคำนวณวันเอง จะได้ผลผิด
**ให้ใช้ `dates` / `date_start` / `date_end` เป็นแหล่งความจริงเรื่องวันเสมอ**

---

## 6. Signature URL — พฤติกรรมและอายุการใช้งาน

`instructors[].signature_url` **ไม่ใช่** URL ของ Cloudinary โดยตรง แต่เป็น URL ที่ผ่านระบบ proxy
ของเราพร้อม token ที่เซ็นกำกับไว้

```
https://register.9expert.app/api/ext/v1/signature/eyJ1IjoiaHR0cHM6...ZTk1MX0.m1c7ga7whVc...
```

| หัวข้อ | รายละเอียด |
| --- | --- |
| ต้องใช้ API key ไหม | **ไม่ต้อง** — token ใน URL คือหลักฐานยืนยันสิทธิ์ในตัวเอง |
| อายุ (TTL) | **15 นาที** (900 วินาที) นับจากตอนที่ API สร้าง URL ให้ |
| รู้เวลาหมดอายุได้อย่างไร | ดูที่ `signature_expires_at` ในผลลัพธ์เดียวกัน |
| Content-Type | `image/png` (หรือชนิดรูปจริงของไฟล์) |
| Cache-Control | `private, max-age=300` |
| หมดอายุแล้วได้อะไร | `401` พร้อม `error.code = "signature_token_invalid"` |

เพราะไม่ต้องใช้ header ท่านจึงใส่ค่านี้ลงใน `<img src="...">` ได้ตรง ๆ

```html
<img src="{{ instructor.signature_url }}" alt="ลายเซ็น {{ instructor.name }}" />
```

### ข้อควรปฏิบัติ

- **อย่า cache `signature_url` ไว้นานเกิน 15 นาที** — ให้เรียก `/classes` ใหม่เพื่อรับ URL ชุดใหม่
- ถ้าต้องเก็บรูปไว้นาน (เช่น ทำ PDF) ให้ **ดาวน์โหลดไฟล์รูป** ภายใน 15 นาที แล้วเก็บไฟล์เอง
  อย่าเก็บแค่ URL
- ถ้า `signature_url` เป็น `null` แปลว่ายังไม่มีลายเซ็น ให้ข้ามไป

---

## 7. Error Handling

ทุก error ใช้โครงสร้างเดียวกัน

```json
{
  "ok": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid or missing API key"
  }
}
```

ตรวจสอบด้วย `response.ok === false` แล้วอ่าน `error.code` (ค่าคงที่ เหมาะกับการเขียน logic)
ส่วน `error.message` เป็นข้อความอ่านง่ายสำหรับ log — อาจเปลี่ยนถ้อยคำได้ อย่านำไปเทียบใน code

| HTTP | `error.code` | ความหมาย | วิธีแก้ |
| --- | --- | --- | --- |
| `400` | `bad_request` | พารามิเตอร์ไม่ถูกต้อง เช่น `from` มาหลัง `to` หรือ `type` ไม่ใช่ `class`/`event`/`all` | แก้พารามิเตอร์ |
| `400` | `invalid_date` | รูปแบบวันที่ไม่ใช่ `YYYY-MM-DD` | แก้รูปแบบวันที่ |
| `401` | `unauthorized` | ไม่ได้ส่งคีย์ หรือคีย์ไม่ถูกต้อง | ตรวจ header `x-api-key` |
| `401` | `key_revoked` | คีย์ถูกยกเลิกแล้ว | ติดต่อ 9Expert เพื่อออกคีย์ใหม่ |
| `401` | `key_expired` | คีย์หมดอายุ | ติดต่อ 9Expert เพื่อต่ออายุ |
| `401` | `signature_token_invalid` | signature URL หมดอายุหรือถูกแก้ไข | เรียก `/classes` ใหม่เพื่อรับ URL ใหม่ |
| `403` | `scope_denied` | คีย์ไม่มี scope ที่ต้องใช้ — บน `/schedule` เกิดได้ 2 กรณี: ไม่มี `classes.read`, หรือส่ง `type=event` ทั้งที่ไม่มี `events.read` | ติดต่อ 9Expert เพื่อขอเพิ่ม scope |
| `403` | `ip_not_allowed` | เรียกจาก IP ที่ไม่อยู่ในรายการอนุญาต | แจ้ง IP ที่จะใช้ให้ 9Expert |
| `404` | `class_not_found` | ไม่พบคลาสตาม id/ชื่อที่ระบุ | ตรวจ `class_id` / `class_name` |
| `429` | `rate_limited` | เรียกถี่เกินกำหนด | รอตาม header `Retry-After` แล้วลองใหม่ |
| `500` | `server_error` | ข้อผิดพลาดฝั่งเซิร์ฟเวอร์ | ลองใหม่ภายหลัง แจ้ง 9Expert ถ้าเกิดซ้ำ |

> หมายเหตุด้านความปลอดภัย: กรณี "ไม่ได้ส่งคีย์" กับ "คีย์ผิด" จะได้คำตอบเหมือนกันทุกประการ
> เป็นความตั้งใจ เพื่อไม่ให้ใช้ API เดารหัสคีย์ได้

---

## 8. Rate Limit

- ค่าเริ่มต้น **60 requests/นาที ต่อคีย์** (ปรับได้ตามข้อตกลง)
- เมื่อเกินจะได้ `429` พร้อม header `Retry-After` (หน่วยวินาที)
- การนับเป็นแบบ best-effort ต่อ instance จึงเป็นการ **กันการยิงถี่ผิดปกติ** มากกว่าโควตาที่แม่นยำ

**แนะนำ:** ดึงข้อมูลเป็นรอบ (เช่น ทุก 5–15 นาที) แล้ว cache ไว้ฝั่งท่าน อย่าเรียก API ทุกครั้ง
ที่มีผู้เข้าชมเว็บ

```js
if (res.status === 429) {
  const wait = Number(res.headers.get("retry-after") || 60);
  await new Promise((r) => setTimeout(r, wait * 1000));
  // แล้วลองใหม่
}
```

---

## 9. CORS

- API ตอบ CORS header เฉพาะเมื่อ `Origin` ของ request **ตรงกับรายการ allowed origins ของคีย์นั้น**
- ถ้าคีย์ไม่ได้กำหนด allowed origins ไว้ = ใช้จากเบราว์เซอร์ไม่ได้ (server-to-server เท่านั้น)
- ต้องการเรียกจากเบราว์เซอร์ กรุณาแจ้ง origin ที่แน่นอน เช่น `https://9expert.com`

**คำแนะนำ:** ถึงเปิด CORS ให้ก็ไม่ควรเรียกจากเบราว์เซอร์โดยตรง เพราะจะทำให้ API key
ปรากฏใน browser ให้เรียกจากเซิร์ฟเวอร์ของท่านแทน

---

## 10. ตัวอย่างโค้ด

### 10.1 Node.js

```js
const BASE_URL = "https://register.9expert.app/api/ext/v1";
const API_KEY = process.env.NINEEXPERT_API_KEY; // อย่า hardcode

async function request(path, params = {}) {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: { "x-api-key": API_KEY },
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(`[${data.error.code}] ${data.error.message}`);
  }
  return data;
}

// รายการคลาสของเดือนนี้
async function getMonthlySchedule(from, to) {
  const all = [];
  let page = 1;

  while (true) {
    const data = await request("/classes", { from, to, limit: 200, page });
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page += 1;
  }
  return all;
}

// คลาสเดียว
async function getClass(classNameOrId) {
  const data = await request(`/classes/${encodeURIComponent(classNameOrId)}`);
  return data.item;
}

// ปฏิทินรวม คลาส + อีเวนต์
async function getCalendar(from, to) {
  const data = await request("/schedule", { from, to, limit: 200 });

  if (!data.included_types.includes("event")) {
    console.warn("คีย์นี้ไม่มี events.read — ผลลัพธ์มีแต่คลาส");
  }

  // จัดกลุ่มตามวัน โดยใช้ dates[] ซึ่งมีเหมือนกันทั้งสองชนิด
  const byDay = {};
  for (const item of data.items) {
    for (const d of item.dates) (byDay[d] ||= []).push(item);
  }
  return byDay;
}

(async () => {
  const byDay = await getCalendar("2026-08-01", "2026-08-31");

  for (const [day, items] of Object.entries(byDay).sort()) {
    console.log(day);
    for (const it of items) {
      const when = it.start_time ? `${it.start_time}-${it.end_time || "?"}` : "ทั้งวัน";
      const where = it.type === "class" ? it.room : it.location;
      console.log(`   [${it.type}] ${when}  ${it.class_name || it.title}  @${where || "-"}`);
    }
  }
})();

(async () => {
  const classes = await getMonthlySchedule("2026-08-01", "2026-08-31");

  for (const c of classes) {
    const teachers = c.instructors.map((i) => i.name).join(", ");
    console.log(`${c.date_start} → ${c.date_end}  ${c.course_name}  [${c.room}]  ${teachers}`);

    for (const i of c.instructors) {
      if (i.signature_url) {
        console.log(`   signature: ${i.signature_url} (expires ${i.signature_expires_at})`);
      }
    }
  }
})();
```

### 10.2 Python

```python
import os
import requests
from urllib.parse import quote

BASE_URL = "https://register.9expert.app/api/ext/v1"
API_KEY = os.environ["NINEEXPERT_API_KEY"]  # อย่า hardcode

session = requests.Session()
session.headers.update({"x-api-key": API_KEY})


def request(path, **params):
    params = {k: v for k, v in params.items() if v not in (None, "")}
    res = session.get(f"{BASE_URL}{path}", params=params, timeout=30)
    data = res.json()

    if not data.get("ok"):
        err = data.get("error", {})
        raise RuntimeError(f"[{err.get('code')}] {err.get('message')}")
    return data


def get_monthly_schedule(date_from, date_to):
    items, page = [], 1
    while True:
        data = request("/classes", **{"from": date_from, "to": date_to, "limit": 200, "page": page})
        items.extend(data["items"])
        if len(items) >= data["total"] or not data["items"]:
            break
        page += 1
    return items


def get_class(name_or_id):
    return request(f"/classes/{quote(name_or_id, safe='')}")["item"]


def download_signature(url, path):
    """signature_url ไม่ต้องใช้ API key และมีอายุ 15 นาที"""
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    with open(path, "wb") as f:
        f.write(r.content)


if __name__ == "__main__":
    for c in get_monthly_schedule("2026-08-01", "2026-08-31"):
        teachers = ", ".join(i["name"] for i in c["instructors"])
        print(f'{c["date_start"]} → {c["date_end"]}  {c["course_name"]}  [{c["room"]}]  {teachers}')

        for i in c["instructors"]:
            if i["signature_url"]:
                download_signature(i["signature_url"], f'sig_{c["class_id"]}.png')
```

### 10.3 PHP (WordPress / เว็บทั่วไป)

```php
<?php
function nineexpert_request(string $path, array $params = []): array {
    $url = 'https://register.9expert.app/api/ext/v1' . $path;
    if ($params) {
        $url .= '?' . http_build_query($params);
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => ['x-api-key: ' . getenv('NINEEXPERT_API_KEY')],
    ]);
    $body = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($body, true);
    if (empty($data['ok'])) {
        throw new RuntimeException("[{$data['error']['code']}] {$data['error']['message']}");
    }
    return $data;
}

$data = nineexpert_request('/classes', ['date' => '2026-08-04']);
foreach ($data['items'] as $c) {
    echo $c['date_start'] . ' ' . $c['course_name'] . ' @ ' . $c['room'] . PHP_EOL;
}
```

---

## 11. ทดสอบด้วย Postman

มี collection พร้อมใช้อยู่ที่ [`docs/postman/9expert-classroom-api.postman_collection.json`](./postman/9expert-classroom-api.postman_collection.json)

**วิธีใช้**

1. เปิด Postman → **Import** → เลือกไฟล์ collection ข้างต้น
2. คลิกชื่อ collection → แท็บ **Variables**
3. วาง API key ลงในตัวแปร `apiKey` (ช่อง *Current value*)
4. ถ้าทดสอบ production ให้แก้ `baseUrl` เป็น `https://register.9expert.app/api/ext/v1`
5. กด **Send** ได้ทันที

Collection มีคำขอครบทุก endpoint และทุก filter รวมถึงเคสที่ต้อง error ด้วย
(`401 - no api key`, `400 - invalid date`, `400 - invalid type`, `404 - unknown class`,
`401 - invalid signature token`, `403 - events.read missing`)

**ทดสอบ `/schedule`:** โฟลเดอร์ *Schedule* มีคำขอสำหรับวันนี้, ช่วงวันที่, `type=class`,
`type=event` และเคส `403` สำหรับคีย์ที่ไม่มี `events.read`
เคส `403` ใช้ตัวแปร `apiKeyNoEvents` แยกต่างหาก — ให้ใส่คีย์ที่มีแต่ `classes.read` ลงไป
(ถ้าปล่อยว่างจะได้ `401` แทน `403` ซึ่งก็ยังพิสูจน์ได้ว่าถูกปฏิเสธ แต่คนละสาเหตุ)

**ทดสอบ signature:** เรียก `GET /classes/{className}` ก่อน → คัดลอกค่า
`items[0].instructors[0].signature_url` แล้วเปิดใน browser ได้เลย (ไม่ต้องใส่ header)
หรือคัดลอกเฉพาะส่วน token ไปวางในตัวแปร `signatureToken` แล้วยิงคำขอ `GET /signature/{token}`

### ทดสอบเร็วด้วย curl

```bash
KEY="9xc_live_xxxxxxxx"
BASE="https://register.9expert.app/api/ext/v1"

curl -i -H "x-api-key: $KEY" "$BASE/health"
curl -s -H "x-api-key: $KEY" "$BASE/classes?date=2026-08-04" | jq
curl -s -H "x-api-key: $KEY" "$BASE/schedule" | jq '.included_types, .total'
curl -s -H "x-api-key: $KEY" "$BASE/schedule?date=2026-08-13" | jq '.items[] | {type, date_start, start_time}'
curl -i "$BASE/classes"   # ไม่ใส่คีย์ -> ต้องได้ 401
```

---

## 12. สรุป

| หัวข้อ | สาระสำคัญ |
| --- | --- |
| Base URL | `https://register.9expert.app/api/ext/v1` |
| Authentication | header `x-api-key` (หรือ `Authorization: Bearer`) |
| Endpoints | `/health`, `/classes`, `/classes/{idOrName}`, `/schedule`, `/signature/{token}` |
| สิทธิ์ | อ่านอย่างเดียว — `classes.read` (บังคับ) และ `events.read` (ทางเลือก, ให้เฉพาะที่ตกลงกัน) |
| ข้อมูลที่ได้ | ตารางสอน ชื่อหลักสูตร ห้อง เวลา ชื่ออาจารย์ ลายเซ็นอาจารย์ และอีเวนต์ (ผ่าน `/schedule`) |
| ข้อมูลที่ **ไม่มี** | รายชื่อ/จำนวนผู้เรียน ผู้ลงทะเบียนอีเวนต์ การเช็คอิน ข้อมูลอาหาร ใบรับเอกสาร |
| ปฏิทินรวม | `/schedule` — `included_types` บอกเสมอว่ารอบนี้รวมอะไร, `type` เป็นคีย์แรกของทุกรายการ |
| ฟิลด์วันที่ที่ใช้ร่วมกัน | `day_count`, `dates`, `date_start`, `date_end`, `start_time`, `end_time` — เหมือนกันทั้ง class และ event |
| เขตเวลา | ทุก `date*` / `*_time` เป็น `Asia/Bangkok` แล้ว ห้ามแปลงซ้ำ |
| Signature URL | ไม่ต้องใช้ API key แต่มีอายุ **15 นาที** |
| Rate limit | ค่าเริ่มต้น 60 ครั้ง/นาที ต่อคีย์ |
| ข้อควรระวัง | `code` และ `program` ยังว่างเสมอ, `name` อาจเป็นภาษาไทย, `signature_url` เป็น `null` ได้, `start_time` ของอีเวนต์เป็น `""` ได้ |
| ติดต่อ | ทีมพัฒนา 9Expert |

---

*เอกสารฉบับนี้อ้างอิงข้อมูลจริง ณ สิงหาคม 2026 — หัวข้อ 5.3 ระบุข้อจำกัดของข้อมูลที่มีอยู่จริง
ไม่ใช่สิ่งที่ตั้งใจจะให้เป็น กรุณาอ่านก่อนออกแบบหน้าเว็บ*
