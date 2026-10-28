// src/app/classroom/checkin/food/EditSavedScreen.jsx
"use client";

// K1: หน้ายืนยันหลังบันทึกการแก้ไข (edit-user -> แก้ไขเมนูอาหาร)
// แสดงเฉพาะ "ชื่อฟิลด์" ที่เปลี่ยน ไม่แสดงค่าเก่า/ใหม่ (จอ kiosk มีคนอื่นเห็น)
// นับถอยหลัง 10 วินาทีแล้วกลับหน้าหลัก · แตะตรงไหนก็ได้ = เริ่มนับใหม่
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserButton from "@/components/ui/UserButton";
import AnimatedCheck from "@/components/icons/check-success";
import { KioskScroll } from "../../KioskCardBody";

const AUTO_HOME_SEC = 10;
const HOME_HREF = "/classroom";

export default function EditSavedScreen({ name, changedLabels = [], nextHref }) {
  const router = useRouter();
  const [left, setLeft] = useState(AUTO_HOME_SEC);
  const deadlineRef = useRef(0);
  const leavingRef = useRef(false);

  const go = useCallback(
    (href) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      router.push(href);
    },
    [router],
  );

  const restart = useCallback(() => {
    deadlineRef.current = Date.now() + AUTO_HOME_SEC * 1000;
    setLeft(AUTO_HOME_SEC);
  }, []);

  useEffect(() => {
    deadlineRef.current = Date.now() + AUTO_HOME_SEC * 1000;
    const t = setInterval(() => {
      const sec = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      if (sec <= 0) {
        clearInterval(t);
        setLeft(0);
        go(HOME_HREF);
        return;
      }
      setLeft(sec);
    }, 250);
    return () => clearInterval(t);
  }, [go]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onPointerDown={restart}
      data-testid="edit-saved"
    >
      <KioskScroll className="px-6 py-10 flex flex-col items-center text-center gap-6">
        <div className="p-4">
          <AnimatedCheck size={140} className="mx-auto" />
        </div>

        <div className="w-full max-w-md">
          <h2 className="sm:text-2xl lg:text-xl font-semibold text-front-text">
            บันทึกการแก้ไขเรียบร้อย
          </h2>

          <p className="mt-2 break-words sm:text-xl lg:text-lg font-medium text-front-text">
            {name || "-"}
          </p>

          <div className="mt-5 rounded-2xl border border-brand-border bg-front-bgSoft px-5 py-4 text-left">
            {changedLabels.length > 0 ? (
              <>
                <div className="sm:text-base lg:text-sm text-front-textMuted">
                  ข้อมูลที่เปลี่ยนแปลง
                </div>
                <ul className="mt-2 flex flex-wrap gap-2" data-testid="edit-saved-fields">
                  {changedLabels.map((l) => (
                    <li
                      key={l}
                      className="rounded-xl border border-brand-border bg-white px-3 py-1.5 sm:text-lg lg:text-sm font-medium text-front-text"
                    >
                      {l}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div
                className="text-center sm:text-lg lg:text-sm text-front-textMuted"
                data-testid="edit-saved-fields"
              >
                ไม่มีข้อมูลที่เปลี่ยนแปลง
              </div>
            )}
          </div>

          <p className="mt-6 sm:text-base lg:text-sm text-front-textMuted">
            กลับหน้าหลักอัตโนมัติใน {left} วินาที (แตะหน้าจอเพื่อเริ่มนับใหม่)
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => go(nextHref || "/classroom/edit-user")}
            className="min-h-14 flex-1 rounded-xl border border-brand-border bg-white px-4 py-2 sm:text-2xl lg:text-base text-front-text shadow-sm hover:bg-front-bgSoft"
          >
            แก้ไขคนถัดไป
          </button>
          {/* UserButton appends className without a space */}
          <UserButton className=" min-h-14 flex-1" onClick={() => go(HOME_HREF)}>
            กลับหน้าหลัก
          </UserButton>
        </div>
      </KioskScroll>
    </div>
  );
}
