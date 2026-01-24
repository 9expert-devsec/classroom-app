// src/components/receive/SignaturePad.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function SignaturePad({
  className = "",
  height = 220,
  onChangeDataUrl,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const [hasInk, setHasInk] = useState(false);

  const dpr = useMemo(() => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1), []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(height * dpr);

    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);

    // background white
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, height);

    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, [dpr, height]);

  function getPos(e) {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const p = "touches" in e ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;

    drawingRef.current = true;
    const p = getPos(e);
    lastRef.current = p;

    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    e.preventDefault();
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;

    const p = getPos(e);
    const ctx = c.getContext("2d");

    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastRef.current = p;
    if (!hasInk) setHasInk(true);
  }

  function end(e) {
    e.preventDefault();
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const c = canvasRef.current;
    if (!c) return;

    // ส่ง dataUrl กลับ
    const dataUrl = c.toDataURL("image/png");
    onChangeDataUrl?.(dataUrl);
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // reset size again (keep crisp)
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(height * dpr);

    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, height);

    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";

    setHasInk(false);
    onChangeDataUrl?.("");
  }

  return (
    <div className={cx("w-full", className)}>
      <div className="rounded-xl border bg-white p-2">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none rounded-lg"
          style={{ height }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {hasInk ? "พร้อมยืนยันลายเซ็น" : "กรุณาเซ็นชื่อในกรอบด้านบน"}
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          ล้างลายเซ็น
        </button>
      </div>
    </div>
  );
}
