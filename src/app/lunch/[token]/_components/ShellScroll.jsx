"use client";

// src/app/lunch/[token]/_components/ShellScroll.jsx
//
// กล่องเนื้อหาของ app shell — ตัวเลื่อนแนวตั้ง "ตัวเดียว" ของทุกหน้าสั่งอาหาร
//   Shell (สูงเท่าจอ, overflow hidden)
//     [แถบบน flex-none]  [ShellScroll]  [StickyBottom flex-none]
// บรรทัด TEST TIMES (preview/dev) ต่อท้ายเนื้อหาในกล่องนี้ — ค่ามาจาก layout ผ่าน context
// (คิดฝั่ง server ที่ layout ครั้งเดียว ไม่ต้องส่ง prop ผ่านทุกหน้า)
import { createContext, forwardRef, useContext } from "react";

const TestTimesContext = createContext("");

export function TestTimesProvider({ value = "", children }) {
  return <TestTimesContext.Provider value={value}>{children}</TestTimesContext.Provider>;
}

const ShellScroll = forwardRef(function ShellScroll({ children, className = "", ...rest }, ref) {
  const testTimes = useContext(TestTimesContext);
  return (
    <div
      ref={ref}
      data-testid="lunch-scroll"
      className={`flex min-h-0 flex-auto flex-col overflow-y-auto overflow-x-hidden overscroll-contain ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
      {...rest}
    >
      {children}
      {testTimes ? (
        <p
          data-testid="lunch-test-times"
          className="shrink-0 pb-1 pt-2 text-center font-mono text-[10px] text-slate-400"
        >
          {testTimes}
        </p>
      ) : null}
    </div>
  );
});

export default ShellScroll;
