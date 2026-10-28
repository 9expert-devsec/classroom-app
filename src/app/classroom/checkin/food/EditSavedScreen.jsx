// src/app/classroom/checkin/food/EditSavedScreen.jsx
"use client";

// K1: หน้ายืนยันหลังบันทึกการแก้ไข (edit-user -> แก้ไขเมนูอาหาร)
// K1c: เหลือแค่ไอคอน + หัวข้อ + ชื่อผู้เรียน · ไปต่อ = หน้าค้นหา edit-user (โหมดเจ้าหน้าที่ยังเปิดอยู่)
// นับถอยหลัง 10 วินาทีแล้วกลับหน้าค้นหา · แตะตรงไหนก็ได้ = เริ่มนับใหม่
// "กลับเมนูหลัก" = /classroom (เมนูล็อกโหมดเจ้าหน้าที่เองเหมือนเดิม)
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserButton from "@/components/ui/UserButton";
import AnimatedCheck from "@/components/icons/check-success";
import { KioskScroll } from "../../KioskCardBody";

const AUTO_NEXT_SEC = 10;
const HOME_HREF = "/classroom";

export default function EditSavedScreen({ name, nextHref }) {
  const router = useRouter();
  const searchHref = nextHref || "/classroom/edit-user";
  const [left, setLeft] = useState(AUTO_NEXT_SEC);
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
    deadlineRef.current = Date.now() + AUTO_NEXT_SEC * 1000;
    setLeft(AUTO_NEXT_SEC);
  }, []);

  useEffect(() => {
    deadlineRef.current = Date.now() + AUTO_NEXT_SEC * 1000;
    const t = setInterval(() => {
      const sec = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      if (sec <= 0) {
        clearInterval(t);
        setLeft(0);
        go(searchHref);
        return;
      }
      setLeft(sec);
    }, 250);
    return () => clearInterval(t);
  }, [go, searchHref]);

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

          <p className="mt-6 sm:text-base lg:text-sm text-front-textMuted">
            กลับหน้าค้นหาอัตโนมัติใน {left} วินาที (แตะหน้าจอเพื่อเริ่มนับใหม่)
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          {/* UserButton appends className without a space */}
          <UserButton className=" min-h-14 w-full" onClick={() => go(searchHref)}>
            แก้ไขคนถัดไป
          </UserButton>
          <button
            type="button"
            onClick={() => go(HOME_HREF)}
            className="min-h-11 px-4 sm:text-lg lg:text-sm text-front-textMuted underline underline-offset-4 hover:text-front-text"
          >
            กลับเมนูหลัก
          </button>
        </div>
      </KioskScroll>
    </div>
  );
}
