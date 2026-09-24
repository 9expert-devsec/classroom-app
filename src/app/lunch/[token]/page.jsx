// src/app/lunch/[token]/page.jsx
//
// Stub ของหน้าสั่งอาหารบนมือถือ — P3d จะแทนที่ทั้งหน้า
// ตั้งใจให้เรียก lib ตรง ๆ ไม่ยิง HTTP กลับมาที่ API ของตัวเอง
import dbConnect from "@/lib/mongoose";
import { getLunchSession } from "@/lib/lunchOrders.server";

export const dynamic = "force-dynamic";

const PHASE_LABEL = {
  open: "เปิดรับออเดอร์",
  closing: "ใกล้ปิดรับ",
  closed: "ปิดรับแล้ว",
};

const STATUS_LABEL = {
  pending: "ยังไม่ได้สั่ง",
  unassigned: "หมดเวลาโดยยังไม่ได้สั่ง",
  ordered: "สั่งแล้ว",
  at_shop: "ไปสั่งเองที่ร้าน",
  cancelled: "ยกเลิกแล้ว",
};

const STATE_LABEL = {
  open: "เปิดรับ",
  closed: "ปิด",
  sold_out: "คูปองหมด",
};

function Shell({ children }) {
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto w-full max-w-[390px]">{children}</div>
    </div>
  );
}

function Notice({ title, detail }) {
  return (
    <Shell>
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        {detail ? (
          <p className="mt-2 text-sm text-slate-500">{detail}</p>
        ) : null}
      </div>
    </Shell>
  );
}

function fmtThaiDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}

export default async function LunchStubPage({ params }) {
  await dbConnect();

  const token = String(params?.token || "");
  const session = await getLunchSession(token, new Date());

  if (!session) {
    return <Notice title="QR ไม่ถูกต้อง" detail="กรุณาตรวจสอบ QR อีกครั้ง" />;
  }
  if (session.gone) {
    return (
      <Notice
        title="QR นี้ถูกแทนที่แล้ว"
        detail="กรุณาติดต่อเจ้าหน้าที่"
      />
    );
  }

  const w = session.window || {};

  return (
    <Shell>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">
          {session.learner?.fullName || "-"}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          สั่งอาหารกลางวัน
        </p>

        <div className="mt-4">
          <Row label="คลาส" value={session.class?.name || "-"} />
          <Row label="ห้อง" value={session.class?.room || "-"} />
          <Row label="วันที่" value={session.class?.dayYMD || "-"} />
          <Row label="งบคูปอง" value={`${session.budget} บาท`} />
          <Row
            label="สถานะการสั่ง"
            value={STATUS_LABEL[session.status] || session.status}
          />
          <Row
            label="ช่วงเวลา"
            value={PHASE_LABEL[w.phase] || w.phase || "-"}
          />
          <Row label="ปิดรับเวลา" value={fmtThaiDateTime(w.deadlineAt)} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">
          ร้านที่เลือกได้
        </h2>

        <ul className="mt-3 space-y-2">
          {(session.restaurants || []).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-slate-800">
                {r.name}
              </span>
              <span
                className={[
                  "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  r.state === "open"
                    ? "bg-green-100 text-green-700"
                    : r.state === "sold_out"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {STATE_LABEL[r.state] || r.state}
              </span>
            </li>
          ))}

          {(session.restaurants || []).length === 0 && (
            <li className="text-sm text-slate-500">
              วันนี้ยังไม่มีร้านคูปอง
            </li>
          )}
        </ul>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        หน้านี้เป็นเวอร์ชันทดสอบ ระบบสั่งอาหารจริงจะมาในขั้นถัดไป
      </p>
    </Shell>
  );
}
